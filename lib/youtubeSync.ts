import type { SupabaseClient } from "@supabase/supabase-js";
import { isShorts, isFullPodcastEpisode } from "@/lib/youtube";
import { fetchPublicUploadIds, fetchPublicVideo } from "@/lib/youtubePublic";

type SyncOptions = { limit?: number };
type SyncResult = { totalFetched: number; inserted: number; updated: number; skipped?: boolean; reason?: string; apiQuotaUnits: number };

/** Reuses the existing cron and database. No API calls, quota guard or paid services. */
export async function syncYouTubeToExternalPosts(service: SupabaseClient, _options?: SyncOptions): Promise<SyncResult> {
  const channelId = process.env.YOUTUBE_CHANNEL_ID ?? "";
  const feedIds = await fetchPublicUploadIds(channelId);
  const { data: recent, error } = await service.from("external_posts")
    .select("external_id,metrics,posted_at").eq("platform", "YouTube")
    .order("posted_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  const existing = new Map<string, any>((recent ?? []).map((r: any) => [r.external_id, r]));
  const due = (r: any) => !r?.metrics?.publicCheckedAt || Date.now() - Date.parse(r.metrics.publicCheckedAt) >= 6 * 3600000;
  // Recheck recent long uploads too: a members-only episode may become public after
  // its ID has fallen out of the small Atom feed. Shorts never qualify by title alone.
  const older = (recent ?? []).filter((r: any) => Number(r.metrics?.durationSeconds) >= 480 && due(r)).slice(0, 5);
  const ids = [...new Set([...feedIds.filter((id) => due(existing.get(id))), ...older.map((r: any) => r.external_id)])].slice(0, 20);
  const videos = [];
  for (let start = 0; start < ids.length; start += 4) {
    const batch = await Promise.all(ids.slice(start, start + 4).map((id) => fetchPublicVideo(id, channelId).catch(() => null)));
    videos.push(...batch.filter((v): v is NonNullable<typeof v> => v !== null));
  }
  if (!videos.length) return { totalFetched: 0, inserted: 0, updated: 0, skipped: true, reason: "no_verified_public_updates", apiQuotaUnits: 0 };
  const checkedAt = new Date().toISOString();
  const rows = videos.map((v) => ({
    platform: "YouTube", external_id: v.id, title: v.title, caption: v.description,
    media_url: v.thumbnailUrl, posted_at: v.publishedAt,
    source_url: `https://www.youtube.com/${isShorts(v.durationSeconds) ? "shorts/" : "watch?v="}${v.id}`,
    metrics: { ...(existing.get(v.id)?.metrics ?? {}), views: v.viewCount,
      // Public pages don't provide a dependable comments count. Keep the cached value.
      ...(v.likeCount > 0 ? { likes: v.likeCount } : {}), durationSeconds: v.durationSeconds,
      isShort: isShorts(v.durationSeconds), visibility: "public", publicCheckedAt: checkedAt, syncSource: "public_feed" }
  }));
  const { error: postError } = await service.from("external_posts").upsert(rows, { onConflict: "platform,external_id" });
  if (postError) throw new Error(postError.message);
  const episodes = videos.filter(isFullPodcastEpisode).map((v) => ({
    slug: v.id, title: v.title, description: v.description, youtube_url: `https://www.youtube.com/watch?v=${v.id}`,
    thumbnail_url: v.thumbnailUrl, duration_seconds: v.durationSeconds, is_published: true, published_at: v.publishedAt
  }));
  if (episodes.length) {
    const { error: episodeError } = await service.from("episodes").upsert(episodes, { onConflict: "slug" });
    if (episodeError) throw new Error(episodeError.message);
  }
  const inserted = videos.filter((v) => !existing.has(v.id)).length;
  return { totalFetched: videos.length, inserted, updated: videos.length - inserted, apiQuotaUnits: 0 };
}
