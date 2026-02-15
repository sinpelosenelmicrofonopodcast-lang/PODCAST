import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const placement = (url.searchParams.get("placement") ?? "toast").trim();
    const nowIso = new Date().toISOString();

    const supabase = supabaseServer();
    const { data, error } = await supabase
      .from("promotions")
      .select("id, title, description, image_url, cta_label, cta_url, placement, display_order, starts_at, ends_at")
      .eq("is_active", true)
      .eq("placement", placement)
      .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
      .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, items: data ?? [] });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

