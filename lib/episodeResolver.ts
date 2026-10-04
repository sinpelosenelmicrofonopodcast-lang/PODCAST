import { getEpisodeBySlug, type SeoEpisode } from "@/lib/seo/content";
export async function resolveEpisodeBySlug(slug: string): Promise<SeoEpisode | null> {
  return getEpisodeBySlug(String(slug ?? "").trim());
}
