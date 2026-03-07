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

async function recoverStalePublishing(service: any, staleMinutes = 20) {
  const staleBefore = new Date(Date.now() - staleMinutes * 60 * 1000).toISOString();
  const { data, error } = await service
    .from("scheduled_posts")
    .update({
      status: "queued",
      error: `Recovered stale publishing lock (${new Date().toISOString()})`
    })
    .eq("status", "publishing")
    .lt("updated_at", staleBefore)
    .select("id");
  if (error) return { recovered: 0, error: error.message };
  return { recovered: Array.isArray(data) ? data.length : 0, error: null as string | null };
}

async function claimDueScheduledPostsFallback(service: any, limit: number) {
  const nowIso = new Date().toISOString();
  const { data, error } = await service
    .from("scheduled_posts")
    .select("id, message, scheduled_for, status")
    .eq("status", "queued")
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  if (error) return { rows: [] as ScheduledPost[], error: error.message };
  const due = (data ?? []) as ScheduledPost[];
  const claimed: ScheduledPost[] = [];

  for (const row of due) {
    const lock = await service
      .from("scheduled_posts")
      .update({ status: "publishing", error: null })
      .eq("id", row.id)
      .eq("status", "queued")
      .select("id, message, scheduled_for, status")
      .maybeSingle();
    if (lock.error) continue;
    if (lock.data) claimed.push(lock.data as ScheduledPost);
  }

  return { rows: claimed, error: null as string | null };
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !serviceKey) throw new Error("Faltan variables de Supabase para cron.");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function isCronAuthorized(request: NextRequest) {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (!secret) return false;
  const auth = (request.headers.get("authorization") ?? "").trim();
  if (auth && auth === secret) return true;
  const bearerMatch = auth.match(/^bearer\s+(.+)$/i);
  const bearer = (bearerMatch?.[1] ?? "").trim();
  if (bearer && bearer === secret) return true;
  if ((request.headers.get("x-cron-secret") ?? "").trim() === secret) return true;
  if ((request.nextUrl.searchParams.get("secret") ?? "").trim() === secret) return true;
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
    const stale = await recoverStalePublishing(service, 20);
    let usedFallbackClaim = false;
    let rows: ScheduledPost[] = [];

    const claim = await service.rpc("claim_due_scheduled_posts", { p_limit: limit });
    if (claim.error) {
      usedFallbackClaim = true;
      const fallback = await claimDueScheduledPostsFallback(service, limit);
      if (fallback.error) {
        return NextResponse.json(
          {
            ok: false,
            error: withScheduledPostsMigrationHint(claim.error),
            fallbackError: fallback.error
          },
          { status: 400 }
        );
      }
      rows = fallback.rows;
    } else {
      rows = (claim.data ?? []) as ScheduledPost[];
    }
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
      usedFallbackClaim,
      recoveredStalePublishing: stale.recovered,
      staleRecoveryError: stale.error,
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
