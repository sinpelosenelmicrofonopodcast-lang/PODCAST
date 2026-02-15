import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const placement = (url.searchParams.get("placement") ?? "toast").trim();
    const section = (url.searchParams.get("section") ?? "").trim();
    const limit = Math.min(10, Math.max(1, Number(url.searchParams.get("limit") ?? 10)));
    // If we need to pick a section-targeted promo, query a bit more then filter.
    const dbLimit = section ? Math.min(30, Math.max(limit, limit * 6)) : limit;
    const nowIso = new Date().toISOString();

    const supabase = supabaseServer();
    // Avoid Supabase "schema cache" hard-fail if promo_type hasn't been migrated yet.
    // We'll try with promo_type first; fallback to a column-safe select on older schemas.
    const run = async (selectCols: string) => {
      const q = supabase
        .from("promotions")
        .select(selectCols)
        .eq("is_active", true)
        .eq("placement", placement)
        .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
        .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(dbLimit);
      return q;
    };

    let { data, error } = await run(
      "id, title, description, image_url, cta_label, cta_url, placement, display_order, starts_at, ends_at, promo_type, target_sections"
    );
    if (error && /(promo_type|target_sections)/i.test(error.message)) {
      const fallback = await run("id, title, description, image_url, cta_label, cta_url, placement, display_order, starts_at, ends_at");
      data = fallback.data;
      error = fallback.error;
    }

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    let items = (data ?? []) as any[];
    if (section && Array.isArray(items) && items.length) {
      const sec = section.toLowerCase();
      const isAll = (v: any) => String(v ?? "").toLowerCase() === "all";

      const targeted: any[] = [];
      const global: any[] = [];
      for (const p of items) {
        const ts = (p as any).target_sections;
        if (!ts || (Array.isArray(ts) && ts.length === 0)) {
          global.push(p);
          continue;
        }
        if (!Array.isArray(ts)) {
          global.push(p);
          continue;
        }
        const lower = ts.map((x) => String(x).toLowerCase());
        if (lower.includes(sec)) targeted.push(p);
        else if (lower.some(isAll)) global.push(p);
      }

      const chosen = targeted.length ? targeted : global;
      items = chosen.slice(0, limit);
    }

    return NextResponse.json({ ok: true, items: items.slice(0, limit) });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
