import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabaseServer";
import { extractNewsPathSegmentFromUrl, newsHref } from "@/lib/newsRoute";
import { getYouTubeVideoId } from "@/lib/youtube";
import { normalizeImageUrl } from "@/lib/imageUrl";

export type HomeNewsItem = {
  id: string;
  slug?: string | null;
  title: string;
  summary: string | null;
  cover_url: string | null;
  categories: string[] | null;
  published_at: string | null;
};

export type HomeTrendItem = {
  id: string;
  href: string;
  title: string;
  category: string;
  views: number;
  shares: number;
  comments: number;
};

export type HomePodcastItem = {
  id: string;
  title: string;
  caption: string | null;
  source_url: string | null;
  media_url: string | null;
  posted_at: string | null;
  platform: string | null;
  metrics: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    durationSeconds?: number;
    isShort?: boolean;
  } | null;
};

export type HomeEditorialStory = {
  id: string;
  href: string;
  title: string;
  excerpt: string;
  imageUrl: string | null;
  category: string;
};

export type HomeCommunityThread = {
  id: string;
  title: string;
  body: string | null;
  created_at: string | null;
  space: string;
};

export type HomeEvent = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string | null;
  venue_name?: string | null;
  city?: string | null;
  flyer_url?: string | null;
  join_url?: string | null;
  ticket_url?: string | null;
  info_url?: string | null;
};

export type HomeSponsor = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
};

export type HomeFeedItem = {
  id: string;
  sourceType: "news" | "blog" | "community";
  createdAt: string;
  title: string;
  excerpt: string;
  href: string;
  isExternal: boolean;
  thumbnailUrl: string | null;
  badge: string;
  counters: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
  };
};

export type HomepageOverviewData = {
  flags: {
    showLatestNews: boolean;
    showLatestBlog: boolean;
    showCommunity: boolean;
    showEvents: boolean;
    showPromotions: boolean;
  };
  hero: {
    kicker: string;
    title: string;
    subtitle: string;
    lead: HomeNewsItem | null;
    trending: HomeNewsItem[];
  };
  regions: {
    puertoRico: HomeNewsItem[];
    texas: HomeNewsItem[];
    usa: HomeNewsItem[];
    mundo: HomeNewsItem[];
  };
  podcast: {
    featured: HomePodcastItem | null;
  };
  editorialStories: HomeEditorialStory[];
  community: {
    threads: HomeCommunityThread[];
    fallbackTopics: string[];
  };
  events: HomeEvent[];
  sponsors: {
    mid: HomeSponsor | null;
    footer: HomeSponsor | null;
  };
};

export type HomepageTrendingData = {
  enTendencia: HomeTrendItem[];
  subiendo: HomeTrendItem[];
  viral: HomeTrendItem[];
};

export type HomepageFeedPage = {
  items: HomeFeedItem[];
  nextCursor: string | null;
  hasMore: boolean;
};

type BlogRow = {
  id: string;
  slug?: string | null;
  title: string;
  excerpt?: string | null;
  cover_url?: string | null;
  categories?: string[] | null;
  created_at?: string | null;
};

type ExternalPostRow = {
  id: string;
  title: string | null;
  caption: string | null;
  source_url: string | null;
  media_url: string | null;
  posted_at: string | null;
  platform: string | null;
  metrics: any | null;
};

type PromotionRow = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  placement?: string | null;
  target_sections?: string[] | null;
};

type HomeSettingsRow = {
  hero_kicker?: string | null;
  hero_title?: string | null;
  hero_subtitle?: string | null;
  show_latest_news?: boolean | null;
  show_latest_blog?: boolean | null;
  show_latest_community_post?: boolean | null;
  show_upcoming_events?: boolean | null;
  show_promotions?: boolean | null;
};

const DEFAULT_HERO_KICKER = "Noticias en caliente";
const DEFAULT_HERO_TITLE = "Sin Pelos en el Micrófono";
const DEFAULT_HERO_SUBTITLE = "Cobertura diaria estilo redacción digital: rápido, directo y sin filtros.";

const FEED_DEFAULT_LIMIT = 8;
const MAX_FEED_LIMIT = 24;
let cachedServiceClient: ReturnType<typeof createClient> | null = null;

function hasImage(url?: string | null) {
  return Boolean(normalizeImageUrl(url));
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !serviceKey) return null;
  if (cachedServiceClient) return cachedServiceClient;
  cachedServiceClient = createClient(url, serviceKey, { auth: { persistSession: false } });
  return cachedServiceClient;
}

function toArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((x) => String(x ?? "").trim()).filter(Boolean);
}

function cleanText(input: unknown, fallback = "") {
  const value = String(input ?? "").trim();
  return value || fallback;
}

function normalizeHeadline(input: unknown) {
  return String(input ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function toIsoHoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function uniqById<T extends { id: string }>(rows: T[]) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const id = cleanText(row?.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(row);
  }
  return out;
}

function safeNum(value: unknown) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function postThumb(row: ExternalPostRow) {
  if (row.media_url) return normalizeImageUrl(row.media_url);
  if (!String(row.platform ?? "").toLowerCase().includes("youtube")) return null;
  const id = getYouTubeVideoId(row.source_url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

function isShortPost(row: ExternalPostRow) {
  const metrics = row.metrics ?? {};
  if (metrics.isShort === true) return true;
  const duration = safeNum(metrics.durationSeconds);
  if (duration > 0 && duration <= 180) return true;

  const source = String(row.source_url ?? "").toLowerCase();
  if (source.includes("youtube.com/shorts/")) return true;

  const text = `${row.title ?? ""} ${row.caption ?? ""}`.toLowerCase();
  if (
    text.includes("#shorts") ||
    text.includes(" short ") ||
    text.includes("reel") ||
    text.includes("tiktok")
  ) {
    return true;
  }

  return false;
}

function isEpisodePost(row: ExternalPostRow) {
  if (isShortPost(row)) return false;
  const videoId = getYouTubeVideoId(row.source_url);
  if (!videoId) return false;
  const duration = safeNum(row.metrics?.durationSeconds);
  if (duration <= 0) return false;
  if (duration >= 20 * 60) return true;
  const text = `${row.title ?? ""} ${row.caption ?? ""}`.toLowerCase();
  const hasEpisodeSignal = /(episodio|episode|podcast|capitulo|capítulo|entrevista|full episode|sin pelos)/i.test(text);
  if (!hasEpisodeSignal) return false;
  return !/(clip|highlights?|resumen|noticia|breaking|reel|short|tiktok)/i.test(text);
}

function chicagoDateKey(date = new Date()) {
  const parts: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  return `${parts.year ?? "0000"}-${parts.month ?? "01"}-${parts.day ?? "01"}`;
}

function seededIndex(seed: string, length: number) {
  if (length <= 1) return 0;
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % length;
}

function newsCategory(row: HomeNewsItem) {
  return toArray(row.categories)[0] || "Noticias";
}

function blogHref(row: Pick<BlogRow, "id" | "slug">) {
  const slug = cleanText(row.slug);
  return `/blog/${encodeURIComponent(slug || row.id)}`;
}

function hasCategory(row: HomeNewsItem, values: string[]) {
  const normalized = new Set(toArray(row.categories).map((x) => x.toLowerCase()));
  return values.some((v) => normalized.has(v.toLowerCase()));
}

function isPriorityNews(row: HomeNewsItem) {
  const text = `${row.title} ${toArray(row.categories).join(" ")}`.toLowerCase();
  return /breaking|urgente|ultima hora|exclusivo|en vivo/.test(text);
}

async function fetchHomeSettings(supabase: ReturnType<typeof supabaseServer>) {
  const primary = await supabase
    .from("home_settings")
    .select(
      "hero_kicker, hero_title, hero_subtitle, show_latest_news, show_latest_blog, show_latest_community_post, show_upcoming_events, show_promotions"
    )
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!primary.error) return (primary.data as HomeSettingsRow | null) ?? null;
  return null;
}

async function fetchNewsRows(supabase: ReturnType<typeof supabaseServer>, limit: number, beforeIso?: string | null) {
  const run = async (withPublicationState: boolean) => {
    let query = supabase
      .from("news_items")
      .select("id, slug, title, summary, cover_url, categories, published_at")
      .order("published_at", { ascending: false })
      .limit(limit);

    if (withPublicationState) query = query.eq("publication_state", "published");
    if (beforeIso) query = query.lt("published_at", beforeIso);
    return query;
  };

  const first = await run(true);
  let data: any[] | null = (first.data as any[] | null) ?? null;
  let error = first.error;
  if (error && /publication_state/i.test(error.message ?? "")) {
    const fallback = await run(false);
    data = (fallback.data as any[] | null) ?? null;
    error = fallback.error;
  }
  if (error && /slug|summary|cover_url|categories/i.test(error.message ?? "")) {
    let legacy = supabase
      .from("news_items")
      .select("id, title, summary, published_at")
      .order("published_at", { ascending: false })
      .limit(limit);
    if (beforeIso) legacy = legacy.lt("published_at", beforeIso);
    const fallback = await legacy;
    data = (fallback.data as any[] | null) ?? null;
    error = fallback.error;
  }

  if (error || !Array.isArray(data)) return [] as HomeNewsItem[];

  return uniqById(
    data
      .map((row: any) => ({
        id: cleanText(row.id),
        slug: row.slug ?? null,
        title: cleanText(row.title, "Sin titular"),
        summary: row.summary ? String(row.summary) : null,
        cover_url: normalizeImageUrl(row.cover_url),
        categories: toArray(row.categories),
        published_at: row.published_at ? String(row.published_at) : null
      }))
      .filter((row) => row.id && row.title)
  );
}

async function fetchBlogRows(supabase: ReturnType<typeof supabaseServer>, limit: number, beforeIso?: string | null) {
  const run = async (withPublicationState: boolean) => {
    let query = supabase
      .from("blog_posts")
      .select("id, slug, title, excerpt, cover_url, categories, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (withPublicationState) query = query.eq("publication_state", "published");
    if (beforeIso) query = query.lt("created_at", beforeIso);
    return query;
  };

  const first = await run(true);
  let data: any[] | null = (first.data as any[] | null) ?? null;
  let error = first.error;
  if (error && /publication_state/i.test(error.message ?? "")) {
    const fallback = await run(false);
    data = (fallback.data as any[] | null) ?? null;
    error = fallback.error;
  }

  if (error && /slug|excerpt|cover_url|categories/i.test(error.message ?? "")) {
    let legacy = supabase
      .from("blog_posts")
      .select("id, title, excerpt, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (beforeIso) legacy = legacy.lt("created_at", beforeIso);
    const fallback = await legacy;
    data = (fallback.data as any[] | null) ?? null;
    error = fallback.error;
  }

  if (error || !Array.isArray(data)) return [] as BlogRow[];

  return uniqById(
    data
      .map((row: any) => ({
        id: cleanText(row.id),
        slug: row.slug ?? null,
        title: cleanText(row.title, "Sin titular"),
        excerpt: row.excerpt ? String(row.excerpt) : null,
        cover_url: normalizeImageUrl(row.cover_url),
        categories: toArray(row.categories),
        created_at: row.created_at ? String(row.created_at) : null
      }))
      .filter((row) => row.id && row.title)
  );
}

async function fetchExternalRows(supabase: ReturnType<typeof supabaseServer>, limit: number, beforeIso?: string | null) {
  let query = supabase
    .from("external_posts")
    .select("id, title, caption, source_url, media_url, posted_at, platform, metrics")
    .order("posted_at", { ascending: false })
    .limit(limit);
  if (beforeIso) query = query.lt("posted_at", beforeIso);

  const { data, error } = await query;
  if (error || !Array.isArray(data)) return [] as ExternalPostRow[];
  return uniqById(
    data
      .map((row: any) => ({
        id: cleanText(row.id),
        title: row.title ? String(row.title) : null,
        caption: row.caption ? String(row.caption) : null,
        source_url: row.source_url ? String(row.source_url) : null,
        media_url: row.media_url ? String(row.media_url) : null,
        posted_at: row.posted_at ? String(row.posted_at) : null,
        platform: row.platform ? String(row.platform) : null,
        metrics: row.metrics ?? null
      }))
      .filter((row) => row.id)
  );
}

async function fetchPodcastRows(supabase: ReturnType<typeof supabaseServer>, limit: number) {
  const primary = await supabase
    .from("external_posts")
    .select("id, title, caption, source_url, media_url, posted_at, platform, metrics")
    .ilike("platform", "%youtube%")
    .order("posted_at", { ascending: false })
    .limit(limit);

  let data: any[] | null = (primary.data as any[] | null) ?? null;
  let error = primary.error;

  if ((!Array.isArray(data) || data.length === 0) && !error) {
    const fallback = await supabase
      .from("external_posts")
      .select("id, title, caption, source_url, media_url, posted_at, platform, metrics")
      .or("source_url.ilike.%youtube.com%,source_url.ilike.%youtu.be%")
      .order("posted_at", { ascending: false })
      .limit(limit);
    data = (fallback.data as any[] | null) ?? null;
    error = fallback.error;
  }

  if (error || !Array.isArray(data)) return [] as ExternalPostRow[];
  return uniqById(
    data
      .map((row: any) => ({
        id: cleanText(row.id),
        title: row.title ? String(row.title) : null,
        caption: row.caption ? String(row.caption) : null,
        source_url: row.source_url ? String(row.source_url) : null,
        media_url: row.media_url ? String(row.media_url) : null,
        posted_at: row.posted_at ? String(row.posted_at) : null,
        platform: row.platform ? String(row.platform) : null,
        metrics: row.metrics ?? null
      }))
      .filter((row) => row.id)
  );
}

async function fetchThreads(supabase: ReturnType<typeof supabaseServer>, limit: number, beforeIso?: string | null) {
  let query = supabase
    .from("threads")
    .select("id, title, body, created_at, space")
    .in("space", ["community", "foro"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (beforeIso) query = query.lt("created_at", beforeIso);

  const { data, error } = await query;
  if (error || !Array.isArray(data)) return [] as HomeCommunityThread[];

  return uniqById(
    data
      .map((row: any) => ({
        id: cleanText(row.id),
        title: cleanText(row.title, "Sin titulo"),
        body: row.body ? String(row.body) : null,
        created_at: row.created_at ? String(row.created_at) : null,
        space: cleanText(row.space, "community")
      }))
      .filter((row) => row.id && row.title)
  );
}

async function fetchUpcomingEvents(supabase: ReturnType<typeof supabaseServer>, limit: number) {
  const nowIso = new Date().toISOString();

  const primary = await supabase
    .from("live_events")
    .select("id, title, description, starts_at, venue_name, city, flyer_url, join_url, ticket_url, info_url")
    .gte("starts_at", nowIso)
    .order("starts_at", { ascending: true })
    .limit(limit);

  let data: any[] | null = (primary.data as any[] | null) ?? null;
  let error = primary.error;

  if (error && /venue_name|city|flyer_url|ticket_url|info_url/i.test(error.message ?? "")) {
    const fallback = await supabase
      .from("live_events")
      .select("id, title, description, starts_at, join_url")
      .gte("starts_at", nowIso)
      .order("starts_at", { ascending: true })
      .limit(limit);
    data = (fallback.data as any[] | null) ?? null;
    error = fallback.error;
  }

  if (error || !Array.isArray(data)) return [] as HomeEvent[];

  return uniqById(
    data
      .map((row: any) => ({
        id: cleanText(row.id),
        title: cleanText(row.title, "Evento"),
        description: row.description ? String(row.description) : null,
        starts_at: row.starts_at ? String(row.starts_at) : null,
        venue_name: row.venue_name ? String(row.venue_name) : null,
        city: row.city ? String(row.city) : null,
        flyer_url: normalizeImageUrl(row.flyer_url),
        join_url: row.join_url ? String(row.join_url) : null,
        ticket_url: row.ticket_url ? String(row.ticket_url) : null,
        info_url: row.info_url ? String(row.info_url) : null
      }))
      .filter((row) => row.id && row.starts_at)
  );
}

async function fetchPromotions(supabase: ReturnType<typeof supabaseServer>, limit: number) {
  const nowIso = new Date().toISOString();

  const primary = await supabase
    .from("promotions")
    .select("id, title, description, image_url, cta_label, cta_url, placement, target_sections")
    .eq("is_active", true)
    .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
    .order("display_order", { ascending: true })
    .limit(limit);

  let data: any[] | null = (primary.data as any[] | null) ?? null;
  let error = primary.error;

  if (error && /target_sections/i.test(error.message ?? "")) {
    const fallback = await supabase
      .from("promotions")
      .select("id, title, description, image_url, cta_label, cta_url, placement")
      .eq("is_active", true)
      .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
      .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
      .order("display_order", { ascending: true })
      .limit(limit);
    data = (fallback.data as any[] | null) ?? null;
    error = fallback.error;
  }

  if (error || !Array.isArray(data)) return [] as PromotionRow[];

  return uniqById(
    data
      .map((row: any) => ({
        id: cleanText(row.id),
        title: cleanText(row.title, "Sponsor"),
        description: row.description ? String(row.description) : null,
        image_url: normalizeImageUrl(row.image_url),
        cta_label: row.cta_label ? String(row.cta_label) : null,
        cta_url: row.cta_url ? String(row.cta_url) : null,
        placement: row.placement ? String(row.placement) : null,
        target_sections: toArray(row.target_sections)
      }))
      .filter((row) => row.id && row.title)
  );
}

async function collectNewsEngagement(news: HomeNewsItem[], windowHours: number) {
  const supabase = supabaseServer();
  const ids = news.map((row) => row.id);
  const comments = new Map<string, number>();
  const shares = new Map<string, number>();
  const views = new Map<string, number>();

  if (ids.length === 0) return { comments, shares, views };

  const keyToId = new Map<string, string>();
  news.forEach((row) => {
    keyToId.set(row.id, row.id);
    const slug = cleanText(row.slug);
    if (slug) keyToId.set(slug, row.id);
  });

  const commentsResp = await supabase
    .from("comments")
    .select("content_id")
    .eq("content_type", "news")
    .in("content_id", ids);

  if (!commentsResp.error) {
    (commentsResp.data ?? []).forEach((row: any) => {
      const key = cleanText(row.content_id);
      if (!key) return;
      comments.set(key, (comments.get(key) ?? 0) + 1);
    });
  }

  const sharesResp = await supabase
    .from("external_posts")
    .select("source_url, metrics, posted_at")
    .gte("posted_at", toIsoHoursAgo(windowHours))
    .like("source_url", "%/noticias/%")
    .order("posted_at", { ascending: false })
    .limit(3000);

  if (!sharesResp.error) {
    (sharesResp.data ?? []).forEach((row: any) => {
      const key = extractNewsPathSegmentFromUrl(String(row.source_url ?? ""));
      const newsId = key ? keyToId.get(key) ?? null : null;
      if (!newsId) return;
      const count = safeNum(row?.metrics?.shares);
      if (!count) return;
      shares.set(newsId, (shares.get(newsId) ?? 0) + count);
    });
  }

  try {
    const svc = serviceClient();
    if (svc) {
      const viewsResp = await svc
        .from("page_visits")
        .select("path")
        .gte("visited_at", toIsoHoursAgo(windowHours))
        .like("path", "/noticias/%")
        .order("visited_at", { ascending: false })
        .limit(20000);

      if (!viewsResp.error) {
        (viewsResp.data ?? []).forEach((row: any) => {
          const path = String(row.path ?? "").split("?")[0].split("#")[0];
          const match = path.match(/^\/noticias\/([^/]+)$/i);
          const key = match?.[1] ? decodeURIComponent(match[1]) : "";
          const newsId = key ? keyToId.get(key) ?? null : null;
          if (!newsId) return;
          views.set(newsId, (views.get(newsId) ?? 0) + 1);
        });
      }
    }
  } catch {
    // no-op fallback when service role/page_visits is unavailable.
  }

  return { comments, shares, views };
}

function mapPodcastRow(row: ExternalPostRow): HomePodcastItem {
  return {
    id: row.id,
    title: cleanText(row.title, "Sin titulo"),
    caption: row.caption,
    source_url: row.source_url,
    media_url: postThumb(row),
    posted_at: row.posted_at,
    platform: row.platform,
    metrics: row.metrics ?? null
  };
}

function sponsorCandidate(row: PromotionRow) {
  const placement = cleanText(row.placement).toLowerCase();
  const targets = new Set(toArray(row.target_sections).map((x) => x.toLowerCase()));
  if (targets.size === 0) return true;
  if (targets.has("home") || targets.has("all") || targets.has("global")) return true;
  return placement.includes("home") || placement.includes("sponsor");
}

async function queryHomepageOverviewInternal(): Promise<HomepageOverviewData> {
  const supabase = supabaseServer();

  const [settings, newsRows, blogRows, podcastSourceRows, threadRows, eventsRows, promoRows] = await Promise.all([
    fetchHomeSettings(supabase),
    fetchNewsRows(supabase, 64),
    fetchBlogRows(supabase, 36),
    fetchPodcastRows(supabase, 80),
    fetchThreads(supabase, 14),
    fetchUpcomingEvents(supabase, 8),
    fetchPromotions(supabase, 10)
  ]);

  const newsVisualRows = newsRows.filter((row) => hasImage(row.cover_url));
  const blogVisualRows = blogRows.filter((row) => hasImage(row.cover_url));
  const eventVisualRows = eventsRows.filter((row) => hasImage(row.flyer_url));
  const sponsorVisualRows = promoRows.filter((row) => hasImage(row.image_url));
  const podcastVisualRows = podcastSourceRows.filter((row) => hasImage(postThumb(row)));

  const heroLead = newsVisualRows.find(isPriorityNews) ?? newsVisualRows[0] ?? null;
  const heroTrending = newsVisualRows.filter((row) => row.id !== heroLead?.id).slice(0, 3);

  const usedHero = new Set<string>([heroLead?.id ?? "", ...heroTrending.map((row) => row.id)].filter(Boolean));
  const regionPool = newsVisualRows.filter((row) => !usedHero.has(row.id));
  const regionRemaining = new Set(regionPool.map((row) => row.id));

  const pickRegion = (keys: string[]) => {
    const selected: HomeNewsItem[] = [];
    for (const row of regionPool) {
      if (selected.length >= 4) break;
      if (!regionRemaining.has(row.id)) continue;
      if (!hasCategory(row, keys)) continue;
      selected.push(row);
      regionRemaining.delete(row.id);
    }

    for (const row of regionPool) {
      if (selected.length >= 4) break;
      if (!regionRemaining.has(row.id)) continue;
      selected.push(row);
      regionRemaining.delete(row.id);
    }

    return selected;
  };

  const podcastRows = podcastVisualRows;
  const featuredCandidates = podcastRows.filter((row) => isEpisodePost(row));
  const featuredPoolBase = featuredCandidates.length > 0 ? featuredCandidates : podcastRows.filter((row) => !isShortPost(row));
  const featuredPool = featuredPoolBase.slice(0, Math.min(18, featuredPoolBase.length));
  const featuredEpisode = featuredPool.length > 0 ? featuredPool[seededIndex(`featured-podcast:${chicagoDateKey()}`, featuredPool.length)] : null;

  const editorialStories: HomeEditorialStory[] = [];
  for (const post of blogVisualRows) {
    editorialStories.push({
      id: `blog-${post.id}`,
      href: blogHref(post),
      title: post.title,
      excerpt: cleanText(post.excerpt, "Analisis editorial en formato largo."),
      imageUrl: post.cover_url ?? null,
      category: toArray(post.categories)[0] || "Blog"
    });
    if (editorialStories.length >= 3) break;
  }

  if (editorialStories.length < 3) {
    for (const news of newsVisualRows) {
      editorialStories.push({
        id: `news-${news.id}`,
        href: newsHref(news),
        title: news.title,
        excerpt: cleanText(news.summary, "Historia editorial con contexto y seguimiento."),
        imageUrl: news.cover_url,
        category: newsCategory(news)
      });
      if (editorialStories.length >= 3) break;
    }
  }

  const communityThreads = threadRows.filter((row) => row.space === "community").slice(0, 6);
  const fallbackTopics = newsRows.slice(0, 6).map((row) => row.title);

  const sponsors = sponsorVisualRows.filter(sponsorCandidate).slice(0, 3).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    image_url: row.image_url,
    cta_label: row.cta_label,
    cta_url: row.cta_url
  }));

  const heroKicker = cleanText(settings?.hero_kicker, DEFAULT_HERO_KICKER);
  const heroTitle = cleanText(settings?.hero_title, DEFAULT_HERO_TITLE);
  const heroSubtitle = cleanText(settings?.hero_subtitle, DEFAULT_HERO_SUBTITLE);
  const flags = {
    showLatestNews: settings?.show_latest_news ?? true,
    showLatestBlog: settings?.show_latest_blog ?? true,
    showCommunity: settings?.show_latest_community_post ?? true,
    showEvents: settings?.show_upcoming_events ?? true,
    showPromotions: settings?.show_promotions ?? true
  };

  return {
    flags,
    hero: {
      kicker: heroKicker,
      title: heroTitle,
      subtitle: heroSubtitle,
      lead: heroLead,
      trending: heroTrending
    },
    regions: {
      puertoRico: pickRegion(["pr", "puerto rico"]),
      texas: pickRegion(["tx", "texas"]),
      usa: pickRegion(["usa", "estados unidos", "eeuu"]),
      mundo: pickRegion(["mundo", "internacional", "global"])
    },
    podcast: {
      featured: featuredEpisode ? mapPodcastRow(featuredEpisode) : null
    },
    editorialStories: editorialStories.slice(0, 3),
    community: {
      threads: communityThreads,
      fallbackTopics
    },
    events: eventVisualRows.slice(0, 4),
    sponsors: {
      mid: sponsors[0] ?? null,
      footer: sponsors[1] ?? sponsors[0] ?? null
    }
  };
}

async function queryHomepageTrendingInternal(): Promise<HomepageTrendingData> {
  const supabase = supabaseServer();
  const newsRows = await fetchNewsRows(supabase, 90);
  if (newsRows.length === 0) {
    return { enTendencia: [], subiendo: [], viral: [] };
  }

  const { comments, shares, views } = await collectNewsEngagement(newsRows, 24);
  const ids = newsRows.map((row) => row.id);

  const maxViews = Math.max(1, ...ids.map((id) => views.get(id) ?? 0));
  const maxShares = Math.max(1, ...ids.map((id) => shares.get(id) ?? 0));
  const maxComments = Math.max(1, ...ids.map((id) => comments.get(id) ?? 0));

  const baseScore = (id: string) => {
    const v = (views.get(id) ?? 0) / maxViews;
    const s = (shares.get(id) ?? 0) / maxShares;
    const c = (comments.get(id) ?? 0) / maxComments;
    return v * 0.45 + s * 0.35 + c * 0.2;
  };

  const risingScore = (row: HomeNewsItem) => {
    const ageHours = row.published_at ? Math.max(1, (Date.now() - new Date(row.published_at).getTime()) / (1000 * 60 * 60)) : 24;
    const momentum = (shares.get(row.id) ?? 0) * 2 + (comments.get(row.id) ?? 0) * 1.2;
    return momentum / ageHours;
  };

  const viralScore = (id: string) => {
    return (views.get(id) ?? 0) + (shares.get(id) ?? 0) * 4 + (comments.get(id) ?? 0) * 2;
  };

  const mapItem = (row: HomeNewsItem): HomeTrendItem => ({
    id: row.id,
    href: newsHref(row),
    title: row.title,
    category: newsCategory(row),
    views: views.get(row.id) ?? 0,
    shares: shares.get(row.id) ?? 0,
    comments: comments.get(row.id) ?? 0
  });

  const enTendenciaRows = [...newsRows]
    .sort((a, b) => {
      const byScore = baseScore(b.id) - baseScore(a.id);
      if (Math.abs(byScore) > 0.0001) return byScore;
      return new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime();
    })
    .slice(0, 4);

  const enTendenciaIds = new Set(enTendenciaRows.map((row) => row.id));

  const subiendoRows = [...newsRows]
    .filter((row) => !enTendenciaIds.has(row.id))
    .sort((a, b) => risingScore(b) - risingScore(a))
    .slice(0, 4);

  const skipIds = new Set([...enTendenciaRows, ...subiendoRows].map((row) => row.id));

  const viralRows = [...newsRows]
    .filter((row) => !skipIds.has(row.id))
    .sort((a, b) => viralScore(b.id) - viralScore(a.id))
    .slice(0, 4);

  return {
    enTendencia: enTendenciaRows.map(mapItem),
    subiendo: subiendoRows.map(mapItem),
    viral: viralRows.map(mapItem)
  };
}

async function queryHomepageFeedPageInternal(
  cursor?: string | null,
  limitRaw?: number,
  excludeFeedIds?: string[]
): Promise<HomepageFeedPage> {
  const supabase = supabaseServer();
  const limit = Math.max(6, Math.min(MAX_FEED_LIMIT, Math.floor(Number(limitRaw ?? FEED_DEFAULT_LIMIT) || FEED_DEFAULT_LIMIT)));
  const exclude = new Set((excludeFeedIds ?? []).map((id) => cleanText(id)).filter(Boolean));

  const parsedCursor = cursor ? new Date(cursor) : null;
  const beforeIso = parsedCursor && Number.isFinite(parsedCursor.getTime()) ? parsedCursor.toISOString() : null;
  const sourceLimit = Math.max(16, limit * 2);

  const [newsRows, blogRows, externalRows] = await Promise.all([
    fetchNewsRows(supabase, sourceLimit, beforeIso),
    fetchBlogRows(supabase, sourceLimit, beforeIso),
    fetchExternalRows(supabase, sourceLimit, beforeIso)
  ]);

  const newsCommentCounts = new Map<string, number>();
  if (newsRows.length > 0) {
    const commentsResp = await supabase
      .from("comments")
      .select("content_id")
      .eq("content_type", "news")
      .in(
        "content_id",
        newsRows.map((row) => row.id)
      );
    if (!commentsResp.error) {
      (commentsResp.data ?? []).forEach((row: any) => {
        const key = cleanText(row.content_id);
        if (!key) return;
        newsCommentCounts.set(key, (newsCommentCounts.get(key) ?? 0) + 1);
      });
    }
  }

  const newsKeyToId = new Map<string, string>();
  newsRows.forEach((row) => {
    newsKeyToId.set(row.id, row.id);
    const slug = cleanText(row.slug);
    if (slug) newsKeyToId.set(slug, row.id);
  });

  const blogKeyToId = new Map<string, string>();
  blogRows.forEach((row) => {
    blogKeyToId.set(row.id, row.id);
    const slug = cleanText(row.slug);
    if (slug) blogKeyToId.set(slug, row.id);
  });

  const newsShareCounts = new Map<string, number>();
  const blogShareCounts = new Map<string, number>();

  externalRows.forEach((row) => {
    const shares = safeNum(row?.metrics?.shares);
    if (!shares) return;

    const newsKey = extractNewsPathSegmentFromUrl(row.source_url);
    if (newsKey) {
      const newsId = newsKeyToId.get(newsKey) ?? null;
      if (newsId) newsShareCounts.set(newsId, (newsShareCounts.get(newsId) ?? 0) + shares);
      return;
    }

    const raw = String(row.source_url ?? "").trim();
    if (!raw) return;

    let blogSegment: string | null = null;
    try {
      const u = new URL(raw);
      const match = u.pathname.match(/^\/blog\/([^/]+)$/i);
      blogSegment = match?.[1] ? decodeURIComponent(match[1]) : null;
    } catch {
      const idx = raw.indexOf("/blog/");
      if (idx >= 0) {
        const path = raw.slice(idx).split("?")[0].split("#")[0];
        const match = path.match(/^\/blog\/([^/]+)$/i);
        blogSegment = match?.[1] ? decodeURIComponent(match[1]) : null;
      }
    }

    if (!blogSegment) return;
    const blogId = blogKeyToId.get(blogSegment) ?? null;
    if (!blogId) return;
    blogShareCounts.set(blogId, (blogShareCounts.get(blogId) ?? 0) + shares);
  });

  const feedItems: HomeFeedItem[] = [];

  newsRows.forEach((row) => {
    const createdAt = row.published_at;
    if (!createdAt) return;
    feedItems.push({
      id: `news:${row.id}`,
      sourceType: "news",
      createdAt,
      title: row.title,
      excerpt: cleanText(row.summary, "Cobertura y analisis sin filtros."),
      href: newsHref(row),
      isExternal: false,
      thumbnailUrl: row.cover_url,
      badge: newsCategory(row),
      counters: {
        views: 0,
        likes: 0,
        comments: newsCommentCounts.get(row.id) ?? 0,
        shares: newsShareCounts.get(row.id) ?? 0
      }
    });
  });

  blogRows.forEach((row) => {
    const createdAt = row.created_at;
    if (!createdAt) return;
    feedItems.push({
      id: `blog:${row.id}`,
      sourceType: "blog",
      createdAt,
      title: row.title,
      excerpt: cleanText(row.excerpt, "Lectura editorial y contexto extendido."),
      href: blogHref(row),
      isExternal: false,
      thumbnailUrl: row.cover_url ?? null,
      badge: toArray(row.categories)[0] || "Blog",
      counters: {
        views: 0,
        likes: 0,
        comments: 0,
        shares: blogShareCounts.get(row.id) ?? 0
      }
    });
  });

  const seenHeadlines = new Set<string>();
  const deduped = uniqById(feedItems)
    .filter((item) => !exclude.has(item.id))
    .filter((item) => hasImage(item.thumbnailUrl))
    .filter((item) => {
      const key = normalizeHeadline(item.title);
      if (!key) return true;
      if (seenHeadlines.has(key)) return false;
      seenHeadlines.add(key);
      return true;
    });

  const sorted = deduped.sort((a, b) => {
    const byDate = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (!Number.isNaN(byDate) && byDate !== 0) return byDate;
    return b.id.localeCompare(a.id);
  });

  const items = sorted.slice(0, limit);
  const nextCursor = items.length > 0 ? items[items.length - 1].createdAt : null;

  return {
    items,
    nextCursor,
    hasMore: sorted.length > limit
  };
}

const cachedOverview = unstable_cache(queryHomepageOverviewInternal, ["home-overview-v2"], {
  revalidate: 120,
  tags: ["home", "home-overview"]
});

const cachedTrending = unstable_cache(queryHomepageTrendingInternal, ["home-trending-v2"], {
  revalidate: 120,
  tags: ["home", "home-trending"]
});

const cachedFeedFirstPage = unstable_cache(
  async () => queryHomepageFeedPageInternal(null, FEED_DEFAULT_LIMIT),
  ["home-feed-first-page-v2"],
  {
    revalidate: 60,
    tags: ["home", "home-feed"]
  }
);

export async function queryHomepageOverview() {
  return cachedOverview();
}

export async function queryHomepageTrending() {
  return cachedTrending();
}

export async function queryHomepageFeedPage(cursor?: string | null, limit?: number, excludeFeedIds?: string[]) {
  const safeCursor = cleanText(cursor);
  const exclude = (excludeFeedIds ?? []).map((id) => cleanText(id)).filter(Boolean);
  if (!safeCursor && (limit === undefined || limit === FEED_DEFAULT_LIMIT) && exclude.length === 0) {
    return cachedFeedFirstPage();
  }
  return queryHomepageFeedPageInternal(safeCursor || null, limit, exclude);
}
