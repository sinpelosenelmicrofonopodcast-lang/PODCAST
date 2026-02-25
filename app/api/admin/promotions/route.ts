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
};

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaffApi(request, "manage_promotions");
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const primary = await auth.service
      .from("promotions")
      .select("id, title, description, image_url, image_path, cta_label, cta_url, promo_type, target_sections, placement, display_order, is_active, starts_at, ends_at")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (primary.error && /(promo_type|target_sections)/i.test(primary.error.message)) {
      const fallback = await auth.service
        .from("promotions")
        .select("id, title, description, image_url, image_path, cta_label, cta_url, placement, display_order, is_active, starts_at, ends_at")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (fallback.error) return NextResponse.json({ ok: false, error: fallback.error.message }, { status: 400 });
      return NextResponse.json({ ok: true, items: fallback.data ?? [] });
    }

    if (primary.error) return NextResponse.json({ ok: false, error: primary.error.message }, { status: 400 });
    return NextResponse.json({ ok: true, items: primary.data ?? [] });
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
      target_sections: normalizedSections
    };

    const id = String(payload.id ?? "").trim();
    if (id) {
      let updateResp = await auth.service.from("promotions").update(writePayload).eq("id", id).select("*").single();
      if (updateResp.error && /(promo_type|target_sections)/i.test(updateResp.error.message)) {
        const fallbackPayload = { ...writePayload };
        delete fallbackPayload.promo_type;
        delete fallbackPayload.target_sections;
        updateResp = await auth.service.from("promotions").update(fallbackPayload).eq("id", id).select("*").single();
      }
      if (updateResp.error) return NextResponse.json({ ok: false, error: updateResp.error.message }, { status: 400 });

      await logAdminAudit(auth.service, {
        actorId: auth.userId,
        action: "admin.promotions.update",
        targetTable: "promotions",
        targetId: id,
        meta: { placement: writePayload.placement, is_active: writePayload.is_active, has_image: Boolean(writePayload.image_url) },
        ...reqMeta
      });

      return NextResponse.json({ ok: true, item: updateResp.data });
    }

    let insertResp = await auth.service.from("promotions").insert(writePayload).select("*").single();
    if (insertResp.error && /(promo_type|target_sections)/i.test(insertResp.error.message)) {
      const fallbackPayload = { ...writePayload };
      delete fallbackPayload.promo_type;
      delete fallbackPayload.target_sections;
      insertResp = await auth.service.from("promotions").insert(fallbackPayload).select("*").single();
    }
    if (insertResp.error) return NextResponse.json({ ok: false, error: insertResp.error.message }, { status: 400 });

    await logAdminAudit(auth.service, {
      actorId: auth.userId,
      action: "admin.promotions.create",
      targetTable: "promotions",
      targetId: String((insertResp.data as any)?.id ?? ""),
      meta: { placement: writePayload.placement, is_active: writePayload.is_active, has_image: Boolean(writePayload.image_url) },
      ...reqMeta
    });

    return NextResponse.json({ ok: true, item: insertResp.data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

