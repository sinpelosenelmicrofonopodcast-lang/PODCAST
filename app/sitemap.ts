import type { MetadataRoute } from "next";
import { CANONICAL_SITE_URL } from "@/lib/seo/constants";
import { getPublishedEpisodes } from "@/lib/seo/content";
import { fetchYouTubeVideos, isFullPodcastEpisode } from "@/lib/youtube";
import { supabaseServer } from "@/lib/supabaseServer";

export const revalidate = 1800;

function absolute(path: string) {
  return new URL(path, CANONICAL_SITE_URL).toString();
}

function dateOrUndefined(value?: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absolute("/"), lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: absolute("/podcast"), lastModified: now, changeFrequency: "daily", priority: 0.95 },
    { url: absolute("/blog"), lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: absolute("/noticias"), lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: absolute("/community"), changeFrequency: "weekly", priority: 0.65 },
    { url: absolute("/eventos"), changeFrequency: "weekly", priority: 0.65 },
    { url: absolute("/musica"), changeFrequency: "weekly", priority: 0.55 },
    { url: absolute("/emprendimiento"), changeFrequency: "weekly", priority: 0.55 },
    { url: absolute("/quiero-salir"), changeFrequency: "monthly", priority: 0.45 },
    { url: absolute("/acerca"), changeFrequency: "monthly", priority: 0.5 },
    { url: absolute("/publicidad"), changeFrequency: "monthly", priority: 0.4 }
  ];

  const [storedEpisodes, liveVideos] = await Promise.all([
    getPublishedEpisodes(500).catch(() => []),
    fetchYouTubeVideos(220, { revalidateSeconds: 1800 }).catch(() => [])
  ]);

  const episodeRows = new Map<string, MetadataRoute.Sitemap[number]>();
  storedEpisodes.forEach((episode) => {
    const slug = String(episode.slug || episode.id).trim();
    if (!slug) return;
    episodeRows.set(slug, {
      url: absolute(`/podcast/${encodeURIComponent(slug)}`),
      lastModified: dateOrUndefined(episode.updated_at || episode.published_at),
      changeFrequency: "monthly",
      priority: 0.72
    });
  });
  liveVideos.filter(isFullPodcastEpisode).forEach((video) => {
    const id = String(video.id).trim();
    if (!id) return;
    if (!episodeRows.has(id)) {
      episodeRows.set(id, {
        url: absolute(`/podcast/${encodeURIComponent(id)}`),
        lastModified: dateOrUndefined(video.publishedAt),
        changeFrequency: "monthly",
        priority: 0.76
      });
    }
  });

  const supabase = supabaseServer();
  const [blogResult, newsResult] = await Promise.all([
    supabase.from("blog_posts").select("id, slug, created_at, updated_at").order("created_at", { ascending: false }).limit(500),
    supabase
      .from("news_items")
      .select("id, slug, published_at, updated_at")
      .eq("publication_state", "published")
      .order("published_at", { ascending: false })
      .limit(500)
  ]);

  const blogRows: MetadataRoute.Sitemap = ((blogResult.data ?? []) as any[])
    .map((row) => {
      const slug = String(row.slug || row.id || "").trim();
      if (!slug) return null;
      return {
        url: absolute(`/blog/${encodeURIComponent(slug)}`),
        lastModified: dateOrUndefined(row.updated_at || row.created_at),
        changeFrequency: "monthly" as const,
        priority: 0.62
      };
    })
    .filter(Boolean) as MetadataRoute.Sitemap;

  const newsRows: MetadataRoute.Sitemap = ((newsResult.data ?? []) as any[])
    .map((row) => {
      const slug = String(row.slug || row.id || "").trim();
      if (!slug) return null;
      return {
        url: absolute(`/noticias/${encodeURIComponent(slug)}`),
        lastModified: dateOrUndefined(row.updated_at || row.published_at),
        changeFrequency: "monthly" as const,
        priority: 0.58
      };
    })
    .filter(Boolean) as MetadataRoute.Sitemap;

  return [...staticRoutes, ...Array.from(episodeRows.values()), ...blogRows, ...newsRows];
}
