import type { YouTubeVideo } from "@/lib/youtube";

/** Public documents only: never calls the YouTube Data API or needs an API key. */
export async function fetchPublicUploadIds(channelId: string): Promise<string[]> {
  if (!/^UC[A-Za-z0-9_-]{22}$/.test(channelId)) throw new Error("Invalid YouTube channel ID.");
  const response = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, {
    cache: "no-store", signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error(`Public YouTube feed unavailable (${response.status}).`);
  const xml = await response.text();
  if (!xml.includes("<feed")) throw new Error("Invalid public YouTube feed.");
  return [...new Set(Array.from(xml.matchAll(/<yt:videoId>([A-Za-z0-9_-]{11})<\/yt:videoId>/g), (m) => m[1]))].slice(0, 15);
}

export function parsePublicVideo(html: string, videoId: string, channelId: string): YouTubeVideo | null {
  const raw = html.match(/var ytInitialPlayerResponse\s*=\s*(\{.*?\});/)?.[1];
  if (!raw) return null;
  let player: any;
  try { player = JSON.parse(raw); } catch { return null; }
  const v = player.videoDetails;
  const m = player.microformat?.playerMicroformatRenderer;
  const date = m?.publishDate;
  // Anonymous playability and public indexing are both required. Never expose a premiere,
  // members-only, private or unlisted upload just because an internal record exists.
  if (player.playabilityStatus?.status !== "OK" || v?.videoId !== videoId || v?.channelId !== channelId ||
      v?.isUpcoming || v?.isLive || v?.isPrivate || v?.isCrawlable !== true || m?.isUnlisted !== false ||
      !date || !Number.isFinite(Date.parse(date)) || Date.parse(date) > Date.now()) return null;
  const durationSeconds = Number(v.lengthSeconds);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;
  return {
    id: videoId, title: String(v.title ?? ""), description: String(v.shortDescription ?? ""),
    publishedAt: new Date(date).toISOString(), durationSeconds,
    thumbnailUrl: m.thumbnail?.thumbnails?.at(-1)?.url || v.thumbnail?.thumbnails?.at(-1)?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    viewCount: Number(v.viewCount ?? 0), likeCount: Number(m.likeCount ?? 0), commentCount: 0
  };
}

export async function fetchPublicVideo(videoId: string, channelId: string): Promise<YouTubeVideo | null> {
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;
  const response = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
    cache: "no-store", signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) return null;
  return parsePublicVideo(await response.text(), videoId, channelId);
}
