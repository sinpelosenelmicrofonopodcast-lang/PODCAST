import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/adminAuth";
import { getRequestAuditMeta, logAdminAudit } from "@/lib/adminAudit";

type SourcePayload = {
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

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaffApi(request, "manage_news_sources");
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const { data, error } = await auth.service
      .from("news_sources")
      .select(
        "id, name, rss_url, region, default_categories, is_active, auto_publish, auto_post_facebook, max_items_per_run, scan_every_min, trust_score, last_scanned_at, created_at, updated_at"
      )
      .order("is_active", { ascending: false })
      .order("updated_at", { ascending: false });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, items: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaffApi(request, "manage_news_sources");
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const reqMeta = getRequestAuditMeta(request);

    const payload = (await request.json().catch(() => ({}))) as SourcePayload;
    const name = String(payload.name ?? "").trim();
    const rssUrl = cleanUrl(String(payload.rss_url ?? ""));

    if (!name) return NextResponse.json({ ok: false, error: "Nombre requerido." }, { status: 400 });
    if (!rssUrl) return NextResponse.json({ ok: false, error: "RSS URL inválido." }, { status: 400 });

    const insert = {
      name,
      rss_url: rssUrl,
      region: payload.region ? String(payload.region).trim() : null,
      default_categories: Array.isArray(payload.default_categories)
        ? payload.default_categories.map((x) => String(x).trim()).filter(Boolean)
        : [],
      is_active: payload.is_active !== false,
      auto_publish: payload.auto_publish !== false,
      auto_post_facebook: payload.auto_post_facebook === true,
      max_items_per_run: Number.isFinite(Number(payload.max_items_per_run)) ? Number(payload.max_items_per_run) : 12,
      scan_every_min: Number.isFinite(Number(payload.scan_every_min)) ? Number(payload.scan_every_min) : 15,
      trust_score: Number.isFinite(Number(payload.trust_score)) ? Number(payload.trust_score) : 60,
      created_by: auth.userId
    };

    const { data, error } = await auth.service.from("news_sources").insert(insert).select("*").single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    await logAdminAudit(auth.service, {
      actorId: auth.userId,
      action: "admin.news_source.create",
      targetTable: "news_sources",
      targetId: String((data as any)?.id ?? ""),
      meta: { name, rss_url: rssUrl, is_active: insert.is_active },
      ...reqMeta
    });

    return NextResponse.json({ ok: true, item: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
