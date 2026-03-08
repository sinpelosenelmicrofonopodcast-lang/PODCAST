import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(request: NextRequest) {
  try {
    const region = String(request.nextUrl.searchParams.get("region") ?? "").trim();
    const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? 20);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(40, Math.floor(limitRaw))) : 20;

    const supabase = supabaseServer();
    let query = supabase
      .from("news_articles")
      .select("id, slug, title, summary, category, region, cover_image_url, published_at, trending_score, discover_score, controversy_score")
      .eq("status", "published")
      .order("trending_score", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(limit);

    if (region) query = query.eq("region", region);

    const { data, error } = await query;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json(
      {
        ok: true,
        items: data ?? []
      },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=180" } }
    );
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unknown error" }, { status: 500 });
  }
}
