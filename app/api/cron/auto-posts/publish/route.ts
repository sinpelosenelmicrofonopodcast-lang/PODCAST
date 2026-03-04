import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { publishScheduledPostToFacebook } from "@/lib/autoPosts";
import { withScheduledPostsMigrationHint } from "@/lib/supabaseErrorHints";

type ScheduledPost = {
  id: string;
  message: string;
  scheduled_for: string;
  status: string;
};

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !serviceKey) throw new Error("Faltan variables de Supabase para cron.");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function isCronAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return false;
  const auth = request.headers.get("authorization") ?? "";
  if (auth === `Bearer ${secret}`) return true;
  if ((request.headers.get("x-cron-secret") ?? "") === secret) return true;
  if ((request.nextUrl.searchParams.get("secret") ?? "") === secret) return true;
  return false;
}

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized cron call." }, { status: 401 });
  }

  const service = getServiceClient();
  const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "5");
  const limit = Number.isFinite(limitRaw) ? Math.min(20, Math.max(1, Math.floor(limitRaw))) : 5;

  try {
    const claim = await service.rpc("claim_due_scheduled_posts", { p_limit: limit });
    if (claim.error) return NextResponse.json({ ok: false, error: withScheduledPostsMigrationHint(claim.error) }, { status: 400 });

    const rows = (claim.data ?? []) as ScheduledPost[];
    let posted = 0;
    let failed = 0;
    const results: Array<{ id: string; status: "posted" | "failed"; remoteId?: string | null; error?: string }> = [];

    for (const row of rows) {
      try {
        const message = String(row.message ?? "").trim();
        if (!message) throw new Error("Mensaje vacío para publicar.");

        const publish = await publishScheduledPostToFacebook({ message });
        const postedAt = new Date().toISOString();

        await service
          .from("scheduled_posts")
          .update({
            status: "posted",
            posted_at: postedAt,
            remote_id: publish.postId || null,
            error: null
          })
          .eq("id", row.id)
          .eq("status", "publishing");

        await service.from("external_posts").upsert(
          {
            platform: "Facebook",
            external_id: publish.postId || `scheduled-${row.id}`,
            title: "Auto Post",
            caption: message,
            media_url: null,
            metrics: null,
            posted_at: postedAt,
            source_url: null
          },
          { onConflict: "platform,external_id", ignoreDuplicates: true }
        );

        posted += 1;
        results.push({ id: row.id, status: "posted", remoteId: publish.postId || null });
      } catch (e: any) {
        const errorMessage = String(e?.message ?? "Error publicando en Facebook");
        await service
          .from("scheduled_posts")
          .update({ status: "failed", error: errorMessage })
          .eq("id", row.id)
          .eq("status", "publishing");
        failed += 1;
        results.push({ id: row.id, status: "failed", error: errorMessage });
      }
    }

    return NextResponse.json({
      ok: true,
      claimed: rows.length,
      posted,
      failed,
      limit,
      results
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export const GET = POST;
