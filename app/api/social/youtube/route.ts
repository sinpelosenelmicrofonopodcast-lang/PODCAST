import { NextResponse } from "next/server";
import { fetchYouTubeVideos, isShorts } from "@/lib/youtube";

export async function GET() {
  try {
    const videos = await fetchYouTubeVideos(25);
    const payload = videos.map((video) => ({
      id: video.id,
      title: video.title,
      description: video.description,
      publishedAt: video.publishedAt,
      thumbnailUrl: video.thumbnailUrl,
      viewCount: video.viewCount,
      likeCount: video.likeCount,
      commentCount: video.commentCount,
      durationSeconds: video.durationSeconds,
      isShort: isShorts(video.durationSeconds)
    }));
    return NextResponse.json({ ok: true, items: payload });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unknown error" }, { status: 500 });
  }
}
