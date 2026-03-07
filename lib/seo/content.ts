import { supabaseServer } from "@/lib/supabaseServer";
import { getYouTubeVideoId } from "@/lib/youtube";

export type SeoPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content_md: string | null;
  cover_image_url: string | null;
  category: string | null;
  tags: string[];
  author_name: string | null;
  source_name: string | null;
  source_url: string | null;
  canonical_url: string | null;
  region: string | null;
  is_published: boolean;
  is_news: boolean;
  published_at: string | null;
  updated_at: string | null;
};

export type SeoEpisode = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  youtube_url: string | null;
  audio_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  is_published: boolean;
  published_at: string | null;
  updated_at: string | null;
};

export type SeoEvent = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  start_datetime: string;
  end_datetime: string | null;
  location_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  flyer_image_url: string | null;
  external_url: string | null;
  organizer_name: string | null;
  is_published: boolean;
  updated_at: string | null;
};

export type SeoClip = {
  id: string;
  slug: string;
  title: string;
  youtube_url: string | null;
  thumbnail_url: string | null;
  is_published: boolean;
  published_at: string | null;
  updated_at: string | null;
};

function normalizeSlug(value: string | null | undefined, fallback: string) {
  const slug = String(value ?? "").trim();
  if (slug) return slug;
  return fallback;
}

function maybeSlugFromSource(source?: string | null, fallback = "") {
  const id = getYouTubeVideoId(source);
  if (id) return id;
  const clean = String(source ?? "").trim();
  if (!clean) return fallback;
  try {
    const u = new URL(clean);
    const path = u.pathname.split("/").filter(Boolean).pop();
    return path || fallback;
  } catch {
    return fallback;
  }
}

export async function getPublishedPosts(limit = 100): Promise<SeoPost[]> {
  const supabase = supabaseServer();
  const primary = await supabase
    .from("posts")
    .select(
      "id, slug, title, excerpt, content_md, cover_image_url, category, tags, author_name, source_name, source_url, canonical_url, region, is_published, is_news, published_at, updated_at"
    )
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (!primary.error && (primary.data ?? []).length > 0) return (primary.data ?? []) as SeoPost[];

  const fallback = await supabase
    .from("news_items")
    .select("id, slug, title, summary, analysis, cover_url, categories, tags, published_at, updated_at")
    .eq("publication_state", "published")
    .order("published_at", { ascending: false })
    .limit(limit);

  const rows = (fallback.data ?? []) as any[];
  return rows.map((row) => {
    const categories = Array.isArray(row.categories) ? row.categories.map((v: any) => String(v)) : [];
    const firstCategory = categories[0] || null;
    const region = categories.find((value: string) => ["PR", "TX", "USA", "Mundo"].includes(value.toUpperCase())) || null;
    return {
      id: String(row.id),
      slug: normalizeSlug(row.slug, String(row.id)),
      title: String(row.title ?? "Noticia"),
      excerpt: row.summary ?? null,
      content_md: row.analysis ?? null,
      cover_image_url: row.cover_url ?? null,
      category: firstCategory,
      tags: Array.isArray(row.tags) ? row.tags.map((v: any) => String(v)) : [],
      author_name: "SPM News",
      source_name: null,
      source_url: row.source_url ?? null,
      canonical_url: null,
      region,
      is_published: true,
      is_news: true,
      published_at: row.published_at ?? null,
      updated_at: row.updated_at ?? row.published_at ?? null
    } satisfies SeoPost;
  });
}

export async function getPostBySlug(slug: string): Promise<SeoPost | null> {
  const supabase = supabaseServer();
  const cleanSlug = String(slug || "").trim();
  if (!cleanSlug) return null;

  const primary = await supabase
    .from("posts")
    .select(
      "id, slug, title, excerpt, content_md, cover_image_url, category, tags, author_name, source_name, source_url, canonical_url, region, is_published, is_news, published_at, updated_at"
    )
    .eq("slug", cleanSlug)
    .eq("is_published", true)
    .maybeSingle();
  if (!primary.error && primary.data) return primary.data as SeoPost;

  const fallback = await supabase
    .from("news_items")
    .select("id, slug, title, summary, analysis, cover_url, categories, tags, source_url, published_at, updated_at")
    .eq("publication_state", "published")
    .or(`slug.eq.${cleanSlug},id.eq.${cleanSlug}`)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!fallback.data) return null;
  const row = fallback.data as any;
  const categories = Array.isArray(row.categories) ? row.categories.map((v: any) => String(v)) : [];
  const firstCategory = categories[0] || null;
  const region = categories.find((value: string) => ["PR", "TX", "USA", "Mundo"].includes(value.toUpperCase())) || null;
  return {
    id: String(row.id),
    slug: normalizeSlug(row.slug, String(row.id)),
    title: String(row.title ?? "Noticia"),
    excerpt: row.summary ?? null,
    content_md: row.analysis ?? null,
    cover_image_url: row.cover_url ?? null,
    category: firstCategory,
    tags: Array.isArray(row.tags) ? row.tags.map((v: any) => String(v)) : [],
    author_name: "SPM News",
    source_name: null,
    source_url: row.source_url ?? null,
    canonical_url: null,
    region,
    is_published: true,
    is_news: true,
    published_at: row.published_at ?? null,
    updated_at: row.updated_at ?? row.published_at ?? null
  };
}

export async function getPublishedEpisodes(limit = 100): Promise<SeoEpisode[]> {
  const supabase = supabaseServer();
  const primary = await supabase
    .from("episodes")
    .select("id, slug, title, description, youtube_url, audio_url, thumbnail_url, duration_seconds, is_published, published_at, updated_at")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (!primary.error && (primary.data ?? []).length > 0) return (primary.data ?? []) as SeoEpisode[];

  const fallback = await supabase
    .from("external_posts")
    .select("id, title, caption, source_url, media_url, posted_at, metrics")
    .order("posted_at", { ascending: false })
    .limit(Math.max(limit * 3, 200));

  const seen = new Set<string>();
  const out: SeoEpisode[] = [];
  for (const row of (fallback.data ?? []) as any[]) {
    const sourceUrl = String(row.source_url ?? "");
    if (!sourceUrl || (!sourceUrl.includes("youtube.com") && !sourceUrl.includes("youtu.be"))) continue;
    const duration = Number(row?.metrics?.durationSeconds ?? 0);
    const isShort = row?.metrics?.isShort === true || (duration > 0 && duration <= 180) || sourceUrl.includes("/shorts/");
    if (isShort) continue;
    const slug = maybeSlugFromSource(sourceUrl, String(row.id));
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push({
      id: String(row.id),
      slug,
      title: String(row.title ?? "Episodio"),
      description: row.caption ?? null,
      youtube_url: sourceUrl,
      audio_url: null,
      thumbnail_url: row.media_url ?? null,
      duration_seconds: Number.isFinite(duration) && duration > 0 ? duration : null,
      is_published: true,
      published_at: row.posted_at ?? null,
      updated_at: row.posted_at ?? null
    });
    if (out.length >= limit) break;
  }
  return out;
}

export async function getEpisodeBySlug(slug: string): Promise<SeoEpisode | null> {
  const cleanSlug = String(slug || "").trim();
  if (!cleanSlug) return null;
  const episodes = await getPublishedEpisodes(400);
  return episodes.find((row) => row.slug === cleanSlug || row.id === cleanSlug) ?? null;
}

export async function getPublishedClips(limit = 100): Promise<SeoClip[]> {
  const supabase = supabaseServer();
  const primary = await supabase
    .from("clips")
    .select("id, slug, title, youtube_url, thumbnail_url, is_published, published_at, updated_at")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (!primary.error && (primary.data ?? []).length > 0) return (primary.data ?? []) as SeoClip[];

  const fallback = await supabase
    .from("external_posts")
    .select("id, title, source_url, media_url, posted_at, metrics")
    .order("posted_at", { ascending: false })
    .limit(Math.max(limit * 3, 200));

  const out: SeoClip[] = [];
  const seen = new Set<string>();
  for (const row of (fallback.data ?? []) as any[]) {
    const sourceUrl = String(row.source_url ?? "");
    if (!sourceUrl || (!sourceUrl.includes("youtube.com") && !sourceUrl.includes("youtu.be"))) continue;
    const duration = Number(row?.metrics?.durationSeconds ?? 0);
    const isShort = row?.metrics?.isShort === true || (duration > 0 && duration <= 180) || sourceUrl.includes("/shorts/");
    if (!isShort) continue;
    const slug = maybeSlugFromSource(sourceUrl, String(row.id));
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push({
      id: String(row.id),
      slug,
      title: String(row.title ?? "Clip"),
      youtube_url: sourceUrl,
      thumbnail_url: row.media_url ?? null,
      is_published: true,
      published_at: row.posted_at ?? null,
      updated_at: row.posted_at ?? null
    });
    if (out.length >= limit) break;
  }
  return out;
}

export async function getPublishedEvents(limit = 100): Promise<SeoEvent[]> {
  const supabase = supabaseServer();
  const primary = await supabase
    .from("events")
    .select(
      "id, slug, title, description, start_datetime, end_datetime, location_name, address, city, state, flyer_image_url, external_url, organizer_name, is_published, updated_at"
    )
    .eq("is_published", true)
    .order("start_datetime", { ascending: true })
    .limit(limit);
  if (!primary.error && (primary.data ?? []).length > 0) return (primary.data ?? []) as SeoEvent[];

  const fallback = await supabase
    .from("live_events")
    .select("id, title, description, starts_at, ends_at, venue_name, address_line, city, flyer_url, info_url, organizer_name, updated_at, visibility")
    .order("starts_at", { ascending: true })
    .limit(limit);
  return ((fallback.data ?? []) as any[])
    .filter((row) => String(row.visibility ?? "public") === "public")
    .map((row) => ({
      id: String(row.id),
      slug: normalizeSlug(row.slug, String(row.id)),
      title: String(row.title ?? "Evento"),
      description: row.description ?? null,
      start_datetime: row.starts_at,
      end_datetime: row.ends_at ?? null,
      location_name: row.venue_name ?? null,
      address: row.address_line ?? null,
      city: row.city ?? null,
      state: row.state ?? null,
      flyer_image_url: row.flyer_url ?? null,
      external_url: row.info_url ?? null,
      organizer_name: row.organizer_name ?? null,
      is_published: true,
      updated_at: row.updated_at ?? row.starts_at ?? null
    }));
}

export async function getEventBySlug(slug: string): Promise<SeoEvent | null> {
  const cleanSlug = String(slug || "").trim();
  if (!cleanSlug) return null;
  const events = await getPublishedEvents(400);
  return events.find((row) => row.slug === cleanSlug || row.id === cleanSlug) ?? null;
}

export function normalizeRegion(region: string) {
  const normalized = String(region || "").trim().toUpperCase();
  if (normalized === "PR") return "PR";
  if (normalized === "TX") return "TX";
  if (normalized === "USA") return "USA";
  if (normalized === "MUNDO") return "Mundo";
  return null;
}

export async function getPublishedPostsByRegion(region: string, limit = 48) {
  const normalized = normalizeRegion(region);
  if (!normalized) return [];
  const rows = await getPublishedPosts(Math.max(limit * 2, 100));
  return rows
    .filter((row) => String(row.region ?? "").toUpperCase() === normalized.toUpperCase())
    .slice(0, limit);
}

