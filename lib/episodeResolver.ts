import { getEpisodeBySlug, type SeoEpisode } from "@/lib/seo/content";
import { fetchYouTubeVideos, isFullPodcastEpisode } from "@/lib/youtube";

function fromYouTube(video: Awaited<ReturnType<typeof fetchYouTubeVideos>>[number]): SeoEpisode {
  return {
    id: video.id,
    slug: video.id,
    title: video.title || "Episodio",
    description: video.description || null,
    youtube_url: `https://www.youtube.com/watch?v=${video.id}`,
    audio_url: null,
    thumbnail_url: video.thumbnailUrl || `https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`,
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
  if (!/^[A-Za-z0-9_-]{11}$/.test(cleanSlug)) return null;

  // New episodes can be live on YouTube before the archive/background sync catches up.
  // Resolve against a generous recent upload window so internal links never 404.
  try {
    const videos = await fetchYouTubeVideos(180, { revalidateSeconds: 120 });
    const video = videos.find((item) => item.id === cleanSlug && isFullPodcastEpisode(item));
    return video ? fromYouTube(video) : null;
  } catch {
    return null;
  }
}
