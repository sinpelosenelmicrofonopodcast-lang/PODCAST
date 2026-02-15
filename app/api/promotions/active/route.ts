import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const placement = (url.searchParams.get("placement") ?? "toast").trim();
    const limit = Math.min(10, Math.max(1, Number(url.searchParams.get("limit") ?? 10)));
    const nowIso = new Date().toISOString();

    const supabase = supabaseServer();
    // Avoid Supabase "schema cache" hard-fail if promo_type hasn't been migrated yet.
    // We'll try with promo_type first; fallback to a column-safe select on older schemas.
    const run = async (selectCols: string) =>
      supabase
        .from("promotions")
        .select(selectCols)
        .eq("is_active", true)
        .eq("placement", placement)
        .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
        .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(limit);

    let { data, error } = await run(
      "id, title, description, image_url, cta_label, cta_url, placement, display_order, starts_at, ends_at, promo_type"
    );
    if (error && /promo_type/i.test(error.message)) {
      const fallback = await run("id, title, description, image_url, cta_label, cta_url, placement, display_order, starts_at, ends_at");
      data = fallback.data;
      error = fallback.error;
    }

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, items: data ?? [] });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
