import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchYouTubeVideos, isShorts } from "@/lib/youtube";

type SyncOptions = {
  limit?: number;
};

type SyncResult = {
  totalFetched: number;
  inserted: number;
  updated: number;
};

export async function syncYouTubeToExternalPosts(service: SupabaseClient, options?: SyncOptions): Promise<SyncResult> {
  const limit = Math.min(Math.max(Number(options?.limit ?? 50), 1), 50);
  const videos = await fetchYouTubeVideos(limit, { noStore: true });
  const ids = videos.map((video) => video.id);

  if (ids.length === 0) {
    return { totalFetched: 0, inserted: 0, updated: 0 };
  }

  const { data: existing, error: existingError } = await service
    .from("external_posts")
    .select("external_id")
    .eq("platform", "YouTube")
    .in("external_id", ids);
  if (existingError) throw new Error(existingError.message);

  const existingIds = new Set((existing ?? []).map((row: any) => String(row.external_id)));

  const rows = videos.map((video) => {
    const short = isShorts(video.durationSeconds);
    return {
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
        isShort: short
      },
      posted_at: video.publishedAt,
      source_url: short ? `https://www.youtube.com/shorts/${video.id}` : `https://www.youtube.com/watch?v=${video.id}`
    };
  });

  const { error: upsertError } = await service.from("external_posts").upsert(rows, {
    onConflict: "platform,external_id"
  });
  if (upsertError) throw new Error(upsertError.message);

  const inserted = rows.filter((row) => !existingIds.has(row.external_id)).length;
  const updated = rows.length - inserted;
  return { totalFetched: rows.length, inserted, updated };
}
