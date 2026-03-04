import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/adminAuth";
import { publishScheduledPostToFacebook } from "@/lib/autoPosts";
import { getRequestAuditMeta, logAdminAudit } from "@/lib/adminAudit";
import { withScheduledPostsMigrationHint } from "@/lib/supabaseErrorHints";

type ScheduledPostRow = {
  id: string;
  message: string;
  status: string;
  scheduled_for: string;
};

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdminApi(request);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const reqMeta = getRequestAuditMeta(request);

    const id = String(params.id ?? "").trim();
    if (!isUuid(id)) return NextResponse.json({ ok: false, error: "ID inválido." }, { status: 400 });

    const claimResp = await auth.service
      .from("scheduled_posts")
      .update({ status: "publishing", error: null })
      .eq("id", id)
      .in("status", ["queued", "failed"])
      .select("id, message, status, scheduled_for")
      .maybeSingle();

    if (claimResp.error) {
      return NextResponse.json({ ok: false, error: withScheduledPostsMigrationHint(claimResp.error) }, { status: 400 });
    }

    if (!claimResp.data) {
      const rowResp = await auth.service
        .from("scheduled_posts")
        .select("id, status")
        .eq("id", id)
        .limit(1)
        .maybeSingle();
      const currentStatus = String((rowResp.data as any)?.status ?? "unknown");
      return NextResponse.json({ ok: false, error: `No disponible para post-now (status=${currentStatus}).` }, { status: 409 });
    }

    const row = claimResp.data as ScheduledPostRow;

    try {
      const posted = await publishScheduledPostToFacebook({ message: row.message });

      const postedAt = new Date().toISOString();
      await auth.service
        .from("scheduled_posts")
        .update({
          status: "posted",
          posted_at: postedAt,
          remote_id: posted.postId || null,
          error: null
        })
        .eq("id", row.id)
        .eq("status", "publishing");

      await auth.service.from("external_posts").upsert(
        {
          platform: "Facebook",
          external_id: posted.postId || `scheduled-${row.id}`,
          title: "Auto Post",
          caption: row.message,
          media_url: null,
          metrics: null,
          posted_at: postedAt,
          source_url: null
        },
        { onConflict: "platform,external_id", ignoreDuplicates: true }
      );

      await logAdminAudit(auth.service, {
        actorId: auth.userId,
        action: "admin.auto_posts.post_now",
        targetTable: "scheduled_posts",
        targetId: row.id,
        meta: { remote_id: posted.postId || null },
        ...reqMeta
      });

      return NextResponse.json({ ok: true, id: row.id, remoteId: posted.postId || null, postedAt });
    } catch (e: any) {
      const errorMessage = String(e?.message ?? "Error publicando en Facebook");
      await auth.service
        .from("scheduled_posts")
        .update({ status: "failed", error: errorMessage })
        .eq("id", row.id)
        .eq("status", "publishing");

      return NextResponse.json({ ok: false, error: errorMessage }, { status: 502 });
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
