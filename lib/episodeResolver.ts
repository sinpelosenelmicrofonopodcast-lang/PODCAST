import { getEpisodeBySlug, type SeoEpisode } from "@/lib/seo/content";
import { fetchYouTubeVideos, isShorts } from "@/lib/youtube";

function fromYouTube(video: Awaited<ReturnType<typeof fetchYouTubeVideos>>[number]): SeoEpisode {
  return {
    id: video.id,
    slug: video.id,
    title: video.title || "Episodio",
    description: video.description || null,
    youtube_url: `https://www.youtube.com/watch?v=${video.id}`,
    audio_url: null,
    thumbnail_url: video.thumbnailUrl || null,
    duration_seconds: video.durationSeconds || null,
    is_published: true,
    published_at: video.publishedAt || null,
    updated_at: video.publishedAt || null
  };
}

export async function resolveEpisodeBySlug(slug: string): Promise<SeoEpisode | null> {
  const cleanSlug = String(slug ?? "").trim();
  if (!cleanSlug) return null;

  const stored = await getEpisodeBySlug(cleanSlug);
  if (stored) return stored;

  // The public YouTube feed can be a few minutes/hours ahead of the historical
  // external_posts mirror. Resolve recent video IDs directly so a new episode
  // never 404s while the archive catches up.
  if (!/^[A-Za-z0-9_-]{11}$/.test(cleanSlug)) return null;

  try {
    const videos = await fetchYouTubeVideos(50, { revalidateSeconds: 300 });
    const video = videos.find((item) => item.id === cleanSlug && !isShorts(item.durationSeconds));
    return video ? fromYouTube(video) : null;
  } catch {
    return null;
  }
}
