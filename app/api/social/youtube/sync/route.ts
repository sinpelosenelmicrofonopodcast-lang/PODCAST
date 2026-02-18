import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { fetchYouTubeVideos, isShorts } from "@/lib/youtube";
import { requireAdminApi } from "@/lib/adminAuth";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminApi(request);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const supabase = supabaseServer();
    const videos = await fetchYouTubeVideos(25);
    const ids = videos.map((video) => video.id);

    const { data: existing } = await supabase
      .from("external_posts")
      .select("external_id")
      .eq("platform", "YouTube")
      .in("external_id", ids);

    const existingIds = new Set((existing ?? []).map((row) => row.external_id));

    const inserts = videos
      .filter((video) => !existingIds.has(video.id))
      .map((video) => ({
        platform: "YouTube",
        external_id: video.id,
        title: video.title,
        caption: video.description,
        media_url: video.thumbnailUrl,
        metrics: {
          views: video.viewCount,
          likes: video.likeCount,
          comments: video.commentCount,
          durationSeconds: video.durationSeconds,
          isShort: isShorts(video.durationSeconds)
        },
        posted_at: video.publishedAt,
        source_url: isShorts(video.durationSeconds)
          ? `https://www.youtube.com/shorts/${video.id}`
          : `https://www.youtube.com/watch?v=${video.id}`
      }));

    if (inserts.length > 0) {
      await supabase.from("external_posts").insert(inserts);
    }

    return NextResponse.json({ ok: true, inserted: inserts.length });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unknown error" }, { status: 500 });
  }
}
