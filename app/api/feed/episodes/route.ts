import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { queryPodcastEpisodesPage } from "@/lib/feedEpisodes";

export async function GET(request: NextRequest) {
  try {
    const cursor = String(request.nextUrl.searchParams.get("cursor") ?? "").trim() || null;
    const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "12");
    const limit = Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 12;
    const data = await queryPodcastEpisodesPage(supabaseServer(), cursor, limit);

    return NextResponse.json(
      { ok: true, ...data },
      {
        headers: {
          "Cache-Control": cursor
            ? "public, s-maxage=20, stale-while-revalidate=60"
            : "public, s-maxage=45, stale-while-revalidate=120"
        }
      }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
