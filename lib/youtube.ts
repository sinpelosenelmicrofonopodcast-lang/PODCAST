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

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function parseIsoDurationToSeconds(iso: string): number {
  // Example: PT1H2M3S, PT15M, PT50S
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  const h = Number(m[1] ?? 0);
  const min = Number(m[2] ?? 0);
  const s = Number(m[3] ?? 0);
  return h * 3600 + min * 60 + s;
}

export function isShorts(durationSeconds?: number | null): boolean {
  const d = Number(durationSeconds ?? 0);
  return d > 0 && d <= 180;
}

export async function fetchYouTubeVideos(limit = 25): Promise<YouTubeVideo[]> {
  const apiKey = requireEnv("YOUTUBE_API_KEY");
  const channelId = requireEnv("YOUTUBE_CHANNEL_ID");
  const maxResults = Math.min(Math.max(1, limit), 50);

  // 1) Search newest uploads from the channel
  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("key", apiKey);
  searchUrl.searchParams.set("channelId", channelId);
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("order", "date");
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("maxResults", String(maxResults));

  const searchRes = await fetch(searchUrl.toString(), { next: { revalidate: 3600 } });
  if (!searchRes.ok) throw new Error(`YouTube search failed (${searchRes.status}).`);
  const searchJson = await searchRes.json();

  const items = Array.isArray(searchJson.items) ? searchJson.items : [];
  const ids = items
    .map((it: any) => it?.id?.videoId)
    .filter((id: any) => typeof id === "string" && id.length > 0);

  if (ids.length === 0) return [];

  // 2) Fetch stats + duration for those IDs
  const videosUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  videosUrl.searchParams.set("key", apiKey);
  videosUrl.searchParams.set("id", ids.join(","));
  videosUrl.searchParams.set("part", "snippet,contentDetails,statistics");
  const vidsRes = await fetch(videosUrl.toString(), { next: { revalidate: 3600 } });
  if (!vidsRes.ok) throw new Error(`YouTube videos failed (${vidsRes.status}).`);
  const vidsJson = await vidsRes.json();
  const vids = Array.isArray(vidsJson.items) ? vidsJson.items : [];

  return vids.map((v: any) => {
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

    const durationSeconds = parseIsoDurationToSeconds(String(content?.duration ?? "PT0S"));

    return {
      id,
      title: String(snippet?.title ?? ""),
      description: String(snippet?.description ?? ""),
      publishedAt: String(snippet?.publishedAt ?? ""),
      thumbnailUrl: String(thumb),
      viewCount: Number(stats?.viewCount ?? 0),
      likeCount: Number(stats?.likeCount ?? 0),
      commentCount: Number(stats?.commentCount ?? 0),
      durationSeconds
    } satisfies YouTubeVideo;
  });
}

export function getYouTubeVideoId(input?: string | null): string | null {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  // Handle plain IDs passed in accidentally.
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
    // /shorts/:id, /embed/:id, /live/:id
    const markerIdx = parts.findIndex((p) => p === "shorts" || p === "embed" || p === "live");
    if (markerIdx >= 0) {
      const id = parts[markerIdx + 1];
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
  }

  return null;
}
