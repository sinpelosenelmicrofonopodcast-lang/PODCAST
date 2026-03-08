import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { mixForYouFeed } from "@/lib/news/score";

type FeedNewsRow = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  excerpt: string | null;
  category: string | null;
  region: string | null;
  cover_image_url: string | null;
  status: "published";
  published_at: string | null;
  created_at: string;
  trending_score: number;
  discover_score: number;
  controversy_score: number;
};

export async function GET(request: NextRequest) {
  try {
    const cursor = String(request.nextUrl.searchParams.get("cursor") ?? "").trim();
    const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? 20);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(40, Math.floor(limitRaw))) : 20;
    const before = cursor || new Date().toISOString();

    const supabase = supabaseServer();
    const { data, error } = await supabase
      .from("news_articles")
      .select(
        "id, title, slug, summary, excerpt, category, region, cover_image_url, status, published_at, created_at, trending_score, discover_score, controversy_score"
      )
      .eq("status", "published")
      .lt("published_at", before)
      .order("published_at", { ascending: false })
      .limit(Math.max(limit * 3, 30));

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    const mixed = mixForYouFeed((data ?? []) as FeedNewsRow[]).slice(0, limit);
    const nextCursor = mixed.length ? mixed[mixed.length - 1].published_at : null;

    return NextResponse.json(
      {
        ok: true,
        items: mixed,
        nextCursor,
        hasMore: mixed.length >= limit
      },
      { headers: { "Cache-Control": "public, s-maxage=45, stale-while-revalidate=120" } }
    );
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unknown error" }, { status: 500 });
  }
}
