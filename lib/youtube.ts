export type YouTubeVideo = {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnailUrl: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  durationSeconds: number;
};

type FetchYouTubeVideosOptions = {
  noStore?: boolean;
  revalidateSeconds?: number;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function parseIsoDurationToSeconds(iso: string): number {
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  const h = Number(m[1] ?? 0);
  const min = Number(m[2] ?? 0);
  const s = Number(m[3] ?? 0);
  return h * 3600 + min * 60 + s;
}

function fetchOptionsFor(options?: FetchYouTubeVideosOptions) {
  return options?.noStore
    ? ({ cache: "no-store" } as const)
    : ({ next: { revalidate: Math.max(30, Number(options?.revalidateSeconds ?? 300)) } } as const);
}

async function fetchJson(url: URL, options?: FetchYouTubeVideosOptions) {
  const res = await fetch(url.toString(), fetchOptionsFor(options));
  if (!res.ok) throw new Error(`YouTube request failed (${res.status}).`);
  return res.json();
}

async function fetchUploadIds(
  apiKey: string,
  channelId: string,
  maxResults: number,
  options?: FetchYouTubeVideosOptions
): Promise<string[]> {
  // Using the channel uploads playlist is dramatically cheaper and more reliable
  // than repeatedly calling search.list. It also preserves the real upload order.
  const channelUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
  channelUrl.searchParams.set("key", apiKey);
  channelUrl.searchParams.set("id", channelId);
  channelUrl.searchParams.set("part", "contentDetails");
  const channelJson = await fetchJson(channelUrl, options);
  const uploadsPlaylistId = String(channelJson?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? "").trim();
  if (!uploadsPlaylistId) throw new Error("YouTube uploads playlist was not found for this channel.");

  const ids: string[] = [];
  let nextPageToken = "";
  while (ids.length < maxResults) {
    const playlistUrl = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    playlistUrl.searchParams.set("key", apiKey);
    playlistUrl.searchParams.set("playlistId", uploadsPlaylistId);
    playlistUrl.searchParams.set("part", "contentDetails");
    playlistUrl.searchParams.set("maxResults", String(Math.min(50, maxResults - ids.length)));
    if (nextPageToken) playlistUrl.searchParams.set("pageToken", nextPageToken);

    const playlistJson = await fetchJson(playlistUrl, options);
    const items = Array.isArray(playlistJson?.items) ? playlistJson.items : [];
    const batchIds = items
      .map((item: any) => String(item?.contentDetails?.videoId ?? "").trim())
      .filter((id: string) => /^[A-Za-z0-9_-]{11}$/.test(id));

    for (const id of batchIds) {
      if (!ids.includes(id)) ids.push(id);
      if (ids.length >= maxResults) break;
    }

    nextPageToken = String(playlistJson?.nextPageToken ?? "").trim();
    if (!nextPageToken || batchIds.length === 0) break;
  }

  return ids;
}

async function fetchSearchIds(
  apiKey: string,
  channelId: string,
  maxResults: number,
  options?: FetchYouTubeVideosOptions
): Promise<string[]> {
  // Defensive fallback in case a channel account does not expose the uploads playlist.
  const ids: string[] = [];
  let nextPageToken = "";
  while (ids.length < maxResults) {
    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("key", apiKey);
    searchUrl.searchParams.set("channelId", channelId);
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("order", "date");
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("maxResults", String(Math.min(50, maxResults - ids.length)));
    if (nextPageToken) searchUrl.searchParams.set("pageToken", nextPageToken);

    const searchJson = await fetchJson(searchUrl, options);
    const items = Array.isArray(searchJson?.items) ? searchJson.items : [];
    const batchIds = items
      .map((item: any) => String(item?.id?.videoId ?? "").trim())
      .filter((id: string) => /^[A-Za-z0-9_-]{11}$/.test(id));

    for (const id of batchIds) {
      if (!ids.includes(id)) ids.push(id);
      if (ids.length >= maxResults) break;
    }

    nextPageToken = String(searchJson?.nextPageToken ?? "").trim();
    if (!nextPageToken || batchIds.length === 0) break;
  }
  return ids;
}

export function isShorts(durationSeconds?: number | null): boolean {
  const d = Number(durationSeconds ?? 0);
  return d > 0 && d <= 180;
}

export function isFullPodcastEpisode(video: Pick<YouTubeVideo, "title" | "description" | "durationSeconds">): boolean {
  const duration = Number(video.durationSeconds ?? 0);
  const text = `${video.title ?? ""} ${video.description ?? ""}`;
  if (duration >= 15 * 60) return true;
  // A few special episodes can be shorter, but never promote normal reels/clips as full episodes.
  return duration >= 8 * 60 && /\b(ep(?:isodio)?\.?\s*#?\s*\d+|podcast|sin pelos en el micr[oó]fono)\b/i.test(text);
}

export async function fetchYouTubeVideos(limit = 25, options?: FetchYouTubeVideosOptions): Promise<YouTubeVideo[]> {
  const apiKey = requireEnv("YOUTUBE_API_KEY");
  const channelId = requireEnv("YOUTUBE_CHANNEL_ID");
  const maxResults = Math.min(Math.max(1, Math.floor(Number(limit) || 25)), 2500);

  let ids: string[] = [];
  try {
    ids = await fetchUploadIds(apiKey, channelId, maxResults, options);
  } catch {
    ids = await fetchSearchIds(apiKey, channelId, maxResults, options);
  }

  if (ids.length === 0) return [];

  const detailById = new Map<string, any>();
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const videosUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    videosUrl.searchParams.set("key", apiKey);
    videosUrl.searchParams.set("id", chunk.join(","));
    videosUrl.searchParams.set("part", "snippet,contentDetails,statistics");
    const vidsJson = await fetchJson(videosUrl, options);
    const vids = Array.isArray(vidsJson?.items) ? vidsJson.items : [];
    vids.forEach((video: any) => {
      const id = String(video?.id ?? "").trim();
      if (id) detailById.set(id, video);
    });
  }

  return ids
    .map((id) => detailById.get(id))
    .filter(Boolean)
    .map((v: any) => {
      const id = String(v?.id ?? "");
      const snippet = v?.snippet ?? {};
      const stats = v?.statistics ?? {};
      const content = v?.contentDetails ?? {};

      const thumb =
        snippet?.thumbnails?.maxres?.url ||
        snippet?.thumbnails?.standard?.url ||
        snippet?.thumbnails?.high?.url ||
        snippet?.thumbnails?.medium?.url ||
        snippet?.thumbnails?.default?.url ||
        "";

      return {
        id,
        title: String(snippet?.title ?? ""),
        description: String(snippet?.description ?? ""),
        publishedAt: String(snippet?.publishedAt ?? ""),
        thumbnailUrl: String(thumb),
        viewCount: Number(stats?.viewCount ?? 0),
        likeCount: Number(stats?.likeCount ?? 0),
        commentCount: Number(stats?.commentCount ?? 0),
        durationSeconds: parseIsoDurationToSeconds(String(content?.duration ?? "PT0S"))
      } satisfies YouTubeVideo;
    });
}

function decodeXml(value: string) {
  return String(value ?? "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

function xmlTag(entry: string, tag: string) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return decodeXml(entry.match(new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "i"))?.[1] ?? "").trim();
}

function looksLikeFullEpisodeTitle(title: string) {
  const text = String(title ?? "").trim();
  if (!text) return false;
  if (/\b(shorts?|reel|clip)\b/i.test(text) || /#shorts?\b/i.test(text)) return false;
  return /\bEP\s*#?\s*\d{2,3}\b/i.test(text) || /\bepisodio\s*#?\s*\d{2,3}\b/i.test(text) || /\bsin pelos en el micr[oó]fono\b/i.test(text);
}

/**
 * Quota-free freshness fallback. YouTube's Atom feed exposes the latest channel uploads
 * without using the Data API quota. We intentionally use it only for the newest full
 * episode candidate because it does not provide duration/statistics for the entire archive.
 */
export async function fetchLatestYouTubeEpisodeFromFeed(options?: FetchYouTubeVideosOptions): Promise<YouTubeVideo | null> {
  const channelId = requireEnv("YOUTUBE_CHANNEL_ID");
  const feedUrl = new URL("https://www.youtube.com/feeds/videos.xml");
  feedUrl.searchParams.set("channel_id", channelId);
  const response = await fetch(feedUrl.toString(), fetchOptionsFor(options));
  if (!response.ok) throw new Error(`YouTube feed request failed (${response.status}).`);
  const xml = await response.text();
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/gi) ?? [];

  const candidates = entries
    .map((entry) => {
      const id = xmlTag(entry, "yt:videoId");
      const title = xmlTag(entry, "title");
      const publishedAt = xmlTag(entry, "published");
      const description = xmlTag(entry, "media:description");
      if (!/^[A-Za-z0-9_-]{11}$/.test(id) || !looksLikeFullEpisodeTitle(title)) return null;
      return {
        id,
        title,
        description,
        publishedAt,
        thumbnailUrl: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
        viewCount: 0,
        likeCount: 0,
        commentCount: 0,
        durationSeconds: 0
      } satisfies YouTubeVideo;
    })
    .filter((item): item is YouTubeVideo => Boolean(item))
    .sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime());

  return candidates[0] ?? null;
}

export function getYouTubeVideoId(input?: string | null): string | null {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;

  let url: URL | null = null;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  }

  if (host.endsWith("youtube.com")) {
    const v = url.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

    const parts = url.pathname.split("/").filter(Boolean);
    const markerIdx = parts.findIndex((part) => part === "shorts" || part === "embed" || part === "live");
    if (markerIdx >= 0) {
      const id = parts[markerIdx + 1];
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
  }

  return null;
}
