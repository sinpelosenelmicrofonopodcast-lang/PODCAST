import { supabaseServer } from "@/lib/supabaseServer";
import { getYouTubeVideoId } from "@/lib/youtube";
import type { SeoEpisode } from "@/lib/seo/content";

export type EpisodeEditorialLesson = {
  title: string;
  body: string;
  evidence?: string | null;
  timestamp?: string | null;
};

export type EpisodeEditorialPoint = {
  title: string;
  body: string;
  speaker?: string | null;
  evidence?: string | null;
};

export type EpisodeEditorialQuote = {
  quote: string;
  speaker?: string | null;
  timestamp?: string | null;
};

export type EpisodeEditorial = {
  id: string;
  episode_key: string;
  episode_slug: string | null;
  episode_code: string | null;
  youtube_url: string | null;
  title: string;
  guest_name: string | null;
  episode_type: "guest" | "hosts" | "mixed";
  intro: string | null;
  person_story: string | null;
  impact_summary: string | null;
  lessons: EpisodeEditorialLesson[];
  host_points: EpisodeEditorialPoint[];
  quotes: EpisodeEditorialQuote[];
  closing_reflection: string | null;
  status: "published";
  published_at: string | null;
  updated_at: string;
};

function candidateKeys(episode: Pick<SeoEpisode, "id" | "slug" | "youtube_url">) {
  const out = new Set<string>();
  const videoId = getYouTubeVideoId(episode.youtube_url);
  if (videoId) out.add(`yt:${videoId}`);
  if (episode.slug) {
    out.add(`slug:${episode.slug}`);
    if (/^[A-Za-z0-9_-]{11}$/.test(episode.slug)) out.add(`yt:${episode.slug}`);
  }
  if (episode.id) out.add(`id:${episode.id}`);
  return Array.from(out);
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalize(row: any): EpisodeEditorial {
  return {
    id: String(row.id),
    episode_key: String(row.episode_key),
    episode_slug: row.episode_slug ?? null,
    episode_code: row.episode_code ?? null,
    youtube_url: row.youtube_url ?? null,
    title: String(row.title ?? "Lo que nos dejó este episodio"),
    guest_name: row.guest_name ?? null,
    episode_type: row.episode_type === "hosts" || row.episode_type === "mixed" ? row.episode_type : "guest",
    intro: row.intro ?? null,
    person_story: row.person_story ?? null,
    impact_summary: row.impact_summary ?? null,
    lessons: safeArray<EpisodeEditorialLesson>(row.lessons),
    host_points: safeArray<EpisodeEditorialPoint>(row.host_points),
    quotes: safeArray<EpisodeEditorialQuote>(row.quotes),
    closing_reflection: row.closing_reflection ?? null,
    status: "published",
    published_at: row.published_at ?? null,
    updated_at: String(row.updated_at ?? row.published_at ?? new Date(0).toISOString())
  };
}

export async function getPublishedEpisodeEditorial(
  episode: Pick<SeoEpisode, "id" | "slug" | "youtube_url">
): Promise<EpisodeEditorial | null> {
  const supabase = supabaseServer();
  const keys = candidateKeys(episode);

  if (keys.length > 0) {
    const byKey = await supabase
      .from("episode_editorials")
      .select(
        "id, episode_key, episode_slug, episode_code, youtube_url, title, guest_name, episode_type, intro, person_story, impact_summary, lessons, host_points, quotes, closing_reflection, status, published_at, updated_at"
      )
      .eq("status", "published")
      .in("episode_key", keys)
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!byKey.error && byKey.data) return normalize(byKey.data);
  }

  if (episode.slug) {
    const bySlug = await supabase
      .from("episode_editorials")
      .select(
        "id, episode_key, episode_slug, episode_code, youtube_url, title, guest_name, episode_type, intro, person_story, impact_summary, lessons, host_points, quotes, closing_reflection, status, published_at, updated_at"
      )
      .eq("status", "published")
      .eq("episode_slug", episode.slug)
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!bySlug.error && bySlug.data) return normalize(bySlug.data);
  }

  return null;
}
