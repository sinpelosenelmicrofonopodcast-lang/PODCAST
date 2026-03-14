import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/adminAuth";
import { chicagoDateInputFromNow, chicagoDayBoundsUtc, chicagoLocalToUtcIso } from "@/lib/autoPosts";
import { getRequestAuditMeta, logAdminAudit } from "@/lib/adminAudit";
import { withScheduledPostsMigrationHint } from "@/lib/supabaseErrorHints";

const ALLOWED_STATUS = new Set(["queued", "publishing", "posted", "failed", "cancelled", "all"]);
const ALLOWED_PLATFORM = new Set(["facebook_page", "instagram_feed", "instagram_story", "all"]);
const CHICAGO_LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

type CreatePayload = {
  platform?: "facebook_page" | "instagram_feed" | "instagram_story";
  message?: string;
  mediaUrl?: string | null;
  linkUrl?: string | null;
  campaignKey?: string | null;
  campaignLabel?: string | null;
  publishAs?: "feed" | "story";
  scheduledFor?: string;
};

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminApi(request);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const date = String(request.nextUrl.searchParams.get("date") ?? chicagoDateInputFromNow()).trim();
    const status = String(request.nextUrl.searchParams.get("status") ?? "all").trim().toLowerCase();
    const platform = String(request.nextUrl.searchParams.get("platform") ?? "all").trim().toLowerCase();
    if (!ALLOWED_STATUS.has(status)) {
      return NextResponse.json({ ok: false, error: "Filtro status inválido." }, { status: 400 });
    }
    if (!ALLOWED_PLATFORM.has(platform)) {
      return NextResponse.json({ ok: false, error: "Filtro platform inválido." }, { status: 400 });
    }

    const { startUtc, endUtcExclusive } = chicagoDayBoundsUtc(date);

    let query = auth.service
      .from("scheduled_posts")
      .select(
        "id, platform, message, media_url, link_url, campaign_key, campaign_label, publish_as, scheduled_for, status, posted_at, remote_id, error, created_by, created_at, updated_at"
      )
      .gte("scheduled_for", startUtc)
      .lt("scheduled_for", endUtcExclusive)
      .order("scheduled_for", { ascending: true });

    if (status !== "all") query = query.eq("status", status);
    if (platform !== "all") query = query.eq("platform", platform);

    const { data, error } = await query;
    if (error) return NextResponse.json({ ok: false, error: withScheduledPostsMigrationHint(error) }, { status: 400 });

    const items = data ?? [];
    const summary = items.reduce(
      (acc: { total: number; byStatus: Record<string, number> }, row: any) => {
        const key = String(row.status ?? "queued");
        acc.total += 1;
        acc.byStatus[key] = (acc.byStatus[key] ?? 0) + 1;
        return acc;
      },
      { total: 0, byStatus: {} as Record<string, number> }
    );

    return NextResponse.json({
      ok: true,
      date,
      timezone: "America/Chicago",
      window: { startUtc, endUtcExclusive },
      platform,
      summary,
      items
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminApi(request);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const reqMeta = getRequestAuditMeta(request);

    const body = (await request.json().catch(() => ({}))) as CreatePayload;
    const platform = String(body?.platform ?? "facebook_page").trim().toLowerCase();
    const message = String(body?.message ?? "").trim();
    const mediaUrl = String(body?.mediaUrl ?? "").trim();
    const linkUrl = String(body?.linkUrl ?? "").trim();
    const campaignKey = String(body?.campaignKey ?? "").trim();
    const campaignLabel = String(body?.campaignLabel ?? "").trim();
    const publishAs = String(body?.publishAs ?? "").trim().toLowerCase() === "story" ? "story" : "feed";
    const scheduledForRaw = String(body?.scheduledFor ?? "").trim();

    if (!message) return NextResponse.json({ ok: false, error: "Mensaje requerido." }, { status: 400 });
    if (!ALLOWED_PLATFORM.has(platform) || platform === "all") {
      return NextResponse.json({ ok: false, error: "Platform inválida." }, { status: 400 });
    }
    if ((platform === "instagram_feed" || platform === "instagram_story") && !mediaUrl) {
      return NextResponse.json({ ok: false, error: "Instagram requiere image URL pública." }, { status: 400 });
    }
    if (!scheduledForRaw) {
      return NextResponse.json({ ok: false, error: "scheduledFor requerido." }, { status: 400 });
    }

    let scheduledForUtc = "";
    if (CHICAGO_LOCAL_DATE_TIME.test(scheduledForRaw)) {
      const [datePart, timePart] = scheduledForRaw.split("T");
      scheduledForUtc = chicagoLocalToUtcIso(datePart, timePart);
    } else {
      const parsed = new Date(scheduledForRaw);
      if (!Number.isFinite(parsed.getTime())) {
        return NextResponse.json({ ok: false, error: "Fecha inválida para schedule." }, { status: 400 });
      }
      scheduledForUtc = parsed.toISOString();
    }

    if (new Date(scheduledForUtc).getTime() <= Date.now() + 30_000) {
      return NextResponse.json({ ok: false, error: "La fecha programada debe ser futura (mínimo 30 segundos)." }, { status: 400 });
    }

    const insert = await auth.service
      .from("scheduled_posts")
      .insert({
        platform,
        message,
        media_url: mediaUrl || null,
        link_url: linkUrl || null,
        campaign_key: campaignKey || null,
        campaign_label: campaignLabel || null,
        publish_as: platform === "instagram_story" ? "story" : publishAs,
        scheduled_for: scheduledForUtc,
        status: "queued",
        created_by: auth.userId
      })
      .select(
        "id, platform, message, media_url, link_url, campaign_key, campaign_label, publish_as, scheduled_for, status, posted_at, remote_id, error, created_by, created_at, updated_at"
      )
      .limit(1)
      .maybeSingle();

    if (insert.error) {
      return NextResponse.json({ ok: false, error: withScheduledPostsMigrationHint(insert.error) }, { status: 400 });
    }
    if (!insert.data) {
      return NextResponse.json({ ok: false, error: "No se pudo crear el post programado." }, { status: 400 });
    }

    await logAdminAudit(auth.service, {
      actorId: auth.userId,
      action: "admin.auto_posts.create",
      targetTable: "scheduled_posts",
      targetId: insert.data.id,
      meta: { scheduled_for: scheduledForUtc, platform, campaign_key: campaignKey || null },
      ...reqMeta
    });

    return NextResponse.json({ ok: true, item: insert.data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
