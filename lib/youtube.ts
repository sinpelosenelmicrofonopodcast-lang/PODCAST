export type YouTubeVideo = {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnailUrl: string;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  durationSeconds?: number;
};

const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function parseIsoDurationToSeconds(iso: string) {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return undefined;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
}

export async function fetchYouTubeVideos(maxResults = 25): Promise<YouTubeVideo[]> {
  const apiKey = getEnv("YOUTUBE_API_KEY");
  const channelId = getEnv("YOUTUBE_CHANNEL_ID");

  const channelsRes = await fetch(
    `${YOUTUBE_API}/channels?part=contentDetails&id=${channelId}&key=${apiKey}`,
    { cache: "no-store" }
  );
  const channelsJson = await channelsRes.json();
  const uploadsPlaylist = channelsJson?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylist) return [];

  const playlistRes = await fetch(
    `${YOUTUBE_API}/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylist}&maxResults=${maxResults}&key=${apiKey}`,
    { cache: "no-store" }
  );
  const playlistJson = await playlistRes.json();
  const items = playlistJson?.items ?? [];
  const videoIds = items.map((item: any) => item.contentDetails?.videoId).filter(Boolean);

  if (videoIds.length === 0) return [];

  const videosRes = await fetch(
    `${YOUTUBE_API}/videos?part=statistics,contentDetails&id=${videoIds.join(",")}&key=${apiKey}`,
    { cache: "no-store" }
  );
  const videosJson = await videosRes.json();
  const byId = new Map(
    (videosJson?.items ?? []).map((video: any) => [video.id, video])
  );

  return items.map((item: any) => {
    const id = item.contentDetails?.videoId as string;
    const snippet = item.snippet ?? {};
    const video = byId.get(id) ?? {};
    const stats = video.statistics ?? {};
    const duration = video.contentDetails?.duration ?? "";
    const durationSeconds = parseIsoDurationToSeconds(duration);

    return {
      id,
      title: snippet.title ?? "",
      description: snippet.description ?? "",
      publishedAt: snippet.publishedAt ?? new Date().toISOString(),
      thumbnailUrl:
        snippet.thumbnails?.maxres?.url ||
        snippet.thumbnails?.high?.url ||
        snippet.thumbnails?.medium?.url ||
        "",
      viewCount: stats.viewCount ? Number(stats.viewCount) : undefined,
      likeCount: stats.likeCount ? Number(stats.likeCount) : undefined,
      commentCount: stats.commentCount ? Number(stats.commentCount) : undefined,
      durationSeconds
    };
  });
}

export function isShorts(durationSeconds?: number) {
  if (!durationSeconds && durationSeconds !== 0) return false;
  return durationSeconds <= 60;
}
