import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/adminAuth";
import { buildCampaignRows } from "@/lib/autoPostCampaigns";
import type { ScheduledPostPlatform } from "@/lib/autoPosts";
import { getRequestAuditMeta, logAdminAudit } from "@/lib/adminAudit";
import { withScheduledPostsMigrationHint } from "@/lib/supabaseErrorHints";

type CampaignPayload = {
  campaignName?: string;
  campaignKey?: string | null;
  startDate?: string;
  dailyTime?: string;
  platforms?: ScheduledPostPlatform[];
  messages?: string[];
  mediaUrl?: string | null;
  linkUrl?: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminApi(request);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const reqMeta = getRequestAuditMeta(request);

    const body = (await request.json().catch(() => ({}))) as CampaignPayload;
    const campaignName = String(body?.campaignName ?? "").trim();
    const startDate = String(body?.startDate ?? "").trim();
    const dailyTime = String(body?.dailyTime ?? "").trim();
    const platforms = Array.isArray(body?.platforms) ? body.platforms : [];
    const messages = Array.isArray(body?.messages) ? body.messages.map((value) => String(value)) : [];

    if (!campaignName) {
      return NextResponse.json({ ok: false, error: "campaignName requerido." }, { status: 400 });
    }

    const rows = buildCampaignRows({
      campaignKey: body?.campaignKey ?? null,
      campaignLabel: campaignName,
      startDate,
      dailyTime,
      platforms,
      messages,
      mediaUrl: body?.mediaUrl ?? null,
      linkUrl: body?.linkUrl ?? null,
      createdBy: auth.userId
    });

    const insert = await auth.service
      .from("scheduled_posts")
      .upsert(rows, { onConflict: "platform,scheduled_for", ignoreDuplicates: true })
      .select("id, platform, scheduled_for, campaign_key, campaign_label, status");

    if (insert.error) {
      return NextResponse.json({ ok: false, error: withScheduledPostsMigrationHint(insert.error) }, { status: 400 });
    }

    await logAdminAudit(auth.service, {
      actorId: auth.userId,
      action: "admin.auto_posts.campaign_create",
      targetTable: "scheduled_posts",
      targetId: null,
      meta: {
        campaign_name: campaignName,
        campaign_key: body?.campaignKey ?? null,
        platforms,
        requested: rows.length,
        inserted: (insert.data ?? []).length
      },
      ...reqMeta
    });

    return NextResponse.json({
      ok: true,
      requested: rows.length,
      inserted: (insert.data ?? []).length,
      items: insert.data ?? []
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
