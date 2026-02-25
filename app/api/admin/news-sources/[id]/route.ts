import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/adminAuth";
import { getRequestAuditMeta, logAdminAudit } from "@/lib/adminAudit";

type PatchPayload = {
  name?: string;
  rss_url?: string;
  region?: string | null;
  default_categories?: string[] | null;
  is_active?: boolean;
  auto_publish?: boolean;
  auto_post_facebook?: boolean;
  max_items_per_run?: number;
  scan_every_min?: number;
  trust_score?: number;
};

function cleanUrl(v: string) {
  const raw = String(v ?? "").trim();
  if (!raw) return "";
  try {
    const u = new URL(raw);
    return u.toString();
  } catch {
    return "";
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireStaffApi(request, "manage_news_sources");
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const reqMeta = getRequestAuditMeta(request);

    const id = String(params.id ?? "").trim();
    if (!id) return NextResponse.json({ ok: false, error: "ID inválido." }, { status: 400 });

    const payload = (await request.json().catch(() => ({}))) as PatchPayload;
    const update: Record<string, any> = {};

    if (payload.name !== undefined) update.name = String(payload.name ?? "").trim();
    if (payload.rss_url !== undefined) {
      const rssUrl = cleanUrl(String(payload.rss_url ?? ""));
      if (!rssUrl) return NextResponse.json({ ok: false, error: "RSS URL inválido." }, { status: 400 });
      update.rss_url = rssUrl;
    }
    if (payload.region !== undefined) update.region = payload.region ? String(payload.region).trim() : null;
    if (payload.default_categories !== undefined) {
      update.default_categories = Array.isArray(payload.default_categories)
        ? payload.default_categories.map((x) => String(x).trim()).filter(Boolean)
        : [];
    }
    if (payload.is_active !== undefined) update.is_active = payload.is_active === true;
    if (payload.auto_publish !== undefined) update.auto_publish = payload.auto_publish === true;
    if (payload.auto_post_facebook !== undefined) update.auto_post_facebook = payload.auto_post_facebook === true;
    if (payload.max_items_per_run !== undefined) update.max_items_per_run = Number(payload.max_items_per_run);
    if (payload.scan_every_min !== undefined) update.scan_every_min = Number(payload.scan_every_min);
    if (payload.trust_score !== undefined) update.trust_score = Number(payload.trust_score);

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ ok: false, error: "Nada para actualizar." }, { status: 400 });
    }

    const { data, error } = await auth.service.from("news_sources").update(update).eq("id", id).select("*").single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    await logAdminAudit(auth.service, {
      actorId: auth.userId,
      action: "admin.news_source.update",
      targetTable: "news_sources",
      targetId: id,
      meta: { fields: Object.keys(update) },
      ...reqMeta
    });
    return NextResponse.json({ ok: true, item: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireStaffApi(request, "manage_news_sources");
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const reqMeta = getRequestAuditMeta(request);

    const id = String(params.id ?? "").trim();
    if (!id) return NextResponse.json({ ok: false, error: "ID inválido." }, { status: 400 });

    const { error } = await auth.service.from("news_sources").delete().eq("id", id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    await logAdminAudit(auth.service, {
      actorId: auth.userId,
      action: "admin.news_source.delete",
      targetTable: "news_sources",
      targetId: id,
      meta: {},
      ...reqMeta
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
