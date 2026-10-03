import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/adminAuth";
import { getRequestAuditMeta, logAdminAudit } from "@/lib/adminAudit";

type PromotionPayload = {
  id?: string;
  title?: string;
  description?: string | null;
  image_url?: string | null;
  image_path?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  promo_type?: "sponsor" | "internal" | "affiliate" | null;
  target_sections?: string[] | null;
  placement?: string;
  display_order?: number;
  is_active?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  updated_at?: string;
  campaign_id?: string | null;
  advertiser?: string | null;
  creative_id?: string | null;
  weight?: number;
  frequency_cap?: number | null;
  max_impressions?: number | null;
  daily_cap?: number | null;
  target_region?: string | null;
  device_target?: string | null;
  revenue_cents?: number;
};

const SELECT_COLUMNS = [
  "id",
  "title",
  "description",
  "image_url",
  "image_path",
  "cta_label",
  "cta_url",
  "promo_type",
  "target_sections",
  "placement",
  "display_order",
  "is_active",
  "starts_at",
  "ends_at",
  "campaign_id",
  "advertiser",
  "creative_id",
  "weight",
  "frequency_cap",
  "max_impressions",
  "daily_cap",
  "target_region",
  "device_target",
  "revenue_cents",
  "report_token"
].join(", ");

function nullablePositiveNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaffApi(request, "manage_promotions");
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const response = await auth.service
      .from("promotions")
      .select(SELECT_COLUMNS)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (response.error) return NextResponse.json({ ok: false, error: response.error.message }, { status: 400 });
    return NextResponse.json({ ok: true, items: response.data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaffApi(request, "manage_promotions");
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const reqMeta = getRequestAuditMeta(request);

    const payload = (await request.json().catch(() => ({}))) as PromotionPayload;
    const title = String(payload.title ?? "").trim();
    if (!title) return NextResponse.json({ ok: false, error: "Título requerido." }, { status: 400 });

    const normalizedSections = Array.isArray(payload.target_sections)
      ? Array.from(new Set(payload.target_sections.map((x) => String(x).trim()).filter(Boolean)))
      : null;

    const weight = Math.max(1, Math.min(10000, Math.floor(Number(payload.weight ?? 100) || 100)));
    const revenueCents = Math.max(0, Math.floor(Number(payload.revenue_cents ?? 0) || 0));

    const writePayload: Record<string, any> = {
      title,
      description: payload.description ?? null,
      image_url: payload.image_url ?? null,
      image_path: payload.image_path ?? null,
      cta_label: payload.cta_label ?? null,
      cta_url: payload.cta_url ?? null,
      placement: String(payload.placement ?? "top_banner"),
      display_order: Number(payload.display_order ?? 0) || 0,
      is_active: payload.is_active !== false,
      starts_at: payload.starts_at ?? null,
      ends_at: payload.ends_at ?? null,
      updated_at: payload.updated_at ?? new Date().toISOString(),
      promo_type: payload.promo_type ?? "sponsor",
      target_sections: normalizedSections,
      campaign_id: String(payload.campaign_id ?? "").trim() || null,
      advertiser: String(payload.advertiser ?? "").trim() || null,
      creative_id: String(payload.creative_id ?? "").trim() || null,
      weight,
      frequency_cap: nullablePositiveNumber(payload.frequency_cap),
      max_impressions: nullablePositiveNumber(payload.max_impressions),
      daily_cap: nullablePositiveNumber(payload.daily_cap),
      target_region: String(payload.target_region ?? "").trim() || null,
      device_target: String(payload.device_target ?? "all").trim().toLowerCase() || "all",
      revenue_cents: revenueCents
    };

    const id = String(payload.id ?? "").trim();
    if (id) {
      const updateResp = await auth.service.from("promotions").update(writePayload).eq("id", id).select("*").single();
      if (updateResp.error) return NextResponse.json({ ok: false, error: updateResp.error.message }, { status: 400 });

      await logAdminAudit(auth.service, {
        actorId: auth.userId,
        action: "admin.promotions.update",
        targetTable: "promotions",
        targetId: id,
        meta: {
          placement: writePayload.placement,
          is_active: writePayload.is_active,
          has_image: Boolean(writePayload.image_url),
          campaign_id: writePayload.campaign_id,
          advertiser: writePayload.advertiser,
          weight: writePayload.weight,
          frequency_cap: writePayload.frequency_cap,
          max_impressions: writePayload.max_impressions,
          daily_cap: writePayload.daily_cap
        },
        ...reqMeta
      });

      return NextResponse.json({ ok: true, item: updateResp.data });
    }

    const insertResp = await auth.service.from("promotions").insert(writePayload).select("*").single();
    if (insertResp.error) return NextResponse.json({ ok: false, error: insertResp.error.message }, { status: 400 });

    await logAdminAudit(auth.service, {
      actorId: auth.userId,
      action: "admin.promotions.create",
      targetTable: "promotions",
      targetId: String((insertResp.data as any)?.id ?? ""),
      meta: {
        placement: writePayload.placement,
        is_active: writePayload.is_active,
        has_image: Boolean(writePayload.image_url),
        campaign_id: writePayload.campaign_id,
        advertiser: writePayload.advertiser,
        weight: writePayload.weight
      },
      ...reqMeta
    });

    return NextResponse.json({ ok: true, item: insertResp.data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
