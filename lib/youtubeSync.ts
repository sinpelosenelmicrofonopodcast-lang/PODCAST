import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchYouTubeVideosForSync, isShorts, isFullPodcastEpisode, YouTubeProviderError } from "@/lib/youtube";

type SyncOptions = {
  limit?: number;
};

type SyncResult = {
  totalFetched: number;
  inserted: number;
  updated: number;
  skipped?: boolean;
  reason?: string;
};

export async function syncYouTubeToExternalPosts(service: SupabaseClient, options?: SyncOptions): Promise<SyncResult> {
  const limit = Math.min(Math.max(Number(options?.limit ?? 50), 1), 50);
  const { data: token, error: guardError } = await service.rpc("claim_youtube_sync");
  if (guardError) throw new Error(guardError.message); // Fail closed: no guard, no provider call.
  if (!token) return { totalFetched: 0, inserted: 0, updated: 0, skipped: true, reason: "cooldown_or_quota_budget" };
  try {
  const videos = await fetchYouTubeVideosForSync(limit, { noStore: true });
  const { data: knownEpisodes } = await service.from("episodes").select("slug,is_published");
  const knownPublic = new Set((knownEpisodes ?? []).filter((e: any) => e.is_published).map((e: any) => e.slug));
  const publicVideos = new Set(knownPublic);
  for (const video of videos.filter(isFullPodcastEpisode)) {
    if (knownPublic.has(video.id)) continue;
    // A new upload may be members-only or an upcoming premiere. Verify exact public identity once.
    try {
      const r = await fetch(`https://www.youtube.com/watch?v=${video.id}&hl=es`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
      const html = await r.text();
      const raw = html.match(/var ytInitialPlayerResponse\s*=\s*(\{.*?\});/)?.[1];
      if (!raw) continue;
      const player = JSON.parse(raw);
      if (player.playabilityStatus?.status === "OK" && !player.videoDetails?.isUpcoming &&
          player.videoDetails?.channelId === process.env.YOUTUBE_CHANNEL_ID) publicVideos.add(video.id);
    } catch { /* Keep the last valid archive; unverified items never become public. */ }
  }
  const ids = videos.map((video) => video.id);

  if (ids.length === 0) {
    await service.rpc("finish_youtube_sync", { p_token: token });
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
        visibility: publicVideos.has(video.id) || !isFullPodcastEpisode(video) ? "public" : "members",
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

  const episodeRows = videos.filter((v) => isFullPodcastEpisode(v) && publicVideos.has(v.id)).map((v) => ({
    slug: v.id, title: v.title, description: v.description, youtube_url: `https://www.youtube.com/watch?v=${v.id}`,
    thumbnail_url: v.thumbnailUrl, duration_seconds: v.durationSeconds, is_published: true, published_at: v.publishedAt
  }));
  if (episodeRows.length) {
    const { error } = await service.from("episodes").upsert(episodeRows, { onConflict: "slug" });
    if (error) throw new Error(error.message);
  }
  const { error: finishError } = await service.rpc("finish_youtube_sync", { p_token: token });
  if (finishError) throw new Error(finishError.message);
  const inserted = rows.filter((row) => !existingIds.has(row.external_id)).length;
  const updated = rows.length - inserted;
  return { totalFetched: rows.length, inserted, updated };
  } catch (error) {
    await service.rpc("finish_youtube_sync", { p_token: token, p_error: error instanceof Error ? error.message : "Sync failed",
      p_quota: error instanceof YouTubeProviderError && error.quotaExhausted });
    throw error;
  }
}
