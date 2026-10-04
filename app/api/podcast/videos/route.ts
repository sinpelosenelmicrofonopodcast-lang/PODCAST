import { NextResponse } from "next/server";
import { getPublishedEpisodes } from "@/lib/seo/content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(value: unknown, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

export async function GET() {
  try {
    const videos = await getPublishedEpisodes(1200);
    const episodes = videos
      .map((video) => ({
        id: video.slug,
        title: clean(video.title, 300),
        description: clean(video.description, 4000),
        publishedAt: video.published_at,
        durationSeconds: video.duration_seconds,
        thumbnailUrl: video.thumbnail_url,
        youtubeUrl: video.youtube_url
      }));

    return NextResponse.json(
      { ok: true, count: episodes.length, episodes },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          "X-Robots-Tag": "noindex, nofollow"
        }
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: clean(error?.message ?? "No se pudo cargar YouTube.", 500) },
      { status: 500, headers: { "X-Robots-Tag": "noindex, nofollow" } }
    );
  }
}
