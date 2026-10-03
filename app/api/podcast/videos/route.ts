import { NextResponse } from "next/server";
import { fetchYouTubeVideos, isShorts } from "@/lib/youtube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(value: unknown, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

export async function GET() {
  try {
    const videos = await fetchYouTubeVideos(250, { noStore: true });
    const episodes = videos
      .filter((video) => !isShorts(video.durationSeconds))
      .map((video) => ({
        id: video.id,
        title: clean(video.title, 300),
        description: clean(video.description, 4000),
        publishedAt: video.publishedAt,
        durationSeconds: video.durationSeconds,
        thumbnailUrl: video.thumbnailUrl,
        youtubeUrl: `https://www.youtube.com/watch?v=${video.id}`
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
