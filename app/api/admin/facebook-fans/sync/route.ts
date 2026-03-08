import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/adminAuth";
import { syncFacebookFans } from "@/lib/facebookFans";
import { getRequestAuditMeta, logAdminAudit } from "@/lib/adminAudit";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminApi(request);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const body = await request.json().catch(() => ({}));
    const days = Number(body?.days ?? 30);
    const maxPosts = Number(body?.maxPosts ?? 40);

    const summary = await syncFacebookFans(auth.service, { days, maxPosts });
    const reqMeta = getRequestAuditMeta(request);

    await logAdminAudit(auth.service, {
      actorId: auth.userId,
      action: "admin.facebook_fans.sync",
      targetTable: "facebook_sync_runs",
      targetId: summary.syncRunId,
      meta: {
        page_id: summary.pageId,
        posts_synced: summary.postsSynced,
        comments_synced: summary.commentsSynced,
        reactions_synced: summary.reactionsSynced,
        fans_updated: summary.fansUpdated
      },
      ...reqMeta
    });

    return NextResponse.json({ ok: true, summary });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

