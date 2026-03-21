import type { SupabaseClient } from "@supabase/supabase-js";
import type { IngestSummary, NewsSourceRow, IngestedCandidate } from "@/types/viral";
import { supabaseService } from "@/lib/supabaseService";
import { fetchRssFeed } from "@/lib/news/fetch-rss";
import { inferCategories, inferTags } from "@/lib/newsAutomation";
import { cleanNewsCategories } from "@/lib/newsCategories";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { contentHash, normalizeSourceUrl } from "@/lib/pipelineOps";
import { computeControversyScore, computeInitialDiscoverScore } from "@/lib/news/score";
import { slugify, sanitizeText } from "@/lib/validations/common";
import { generateNewsDraftContent } from "@/services/newsGenerator";
import { generateSpmNewsImage } from "@/services/newsImageGenerator";

type IngestOptions = {
  sourceLimit?: number;
  perSourceLimit?: number;
  timeoutMs?: number;
  rankedLimit?: number;
};

type RawFetchedArticle = {
  source: NewsSourceRow;
  title: string;
  summary: string;
  content: string;
  sourceUrl: string;
  publishedAt: string | null;
  featuredImageUrl: string | null;
  meta?: Record<string, unknown>;
};

type LearningProfile = {
  regionBoosts: Record<string, number>;
  categoryBoosts: Record<string, number>;
  averageEngagement: number;
};

type SeedNewsSource = {
  name: string;
  type: string;
  rss_url: string | null;
  api_url?: string;
  category: string;
  region: string;
  default_categories: string[];
  active: boolean;
  is_active: boolean;
  priority: number;
  trust_score: number;
  max_items_per_run: number;
  meta: Record<string, unknown>;
};

const GOOGLE_NEWS_ENDPOINT = "https://news.google.com/rss/search";
const DEFAULT_REGION_PRIORITY = ["PR", "TX", "USA", "Mundo"];
const IMPACT_RULES: Array<{ label: string; words: string[]; weight: number }> = [
  { label: "muerte", words: ["muerte", "muere", "muerto", "asesinado", "fatal", "homicidio"], weight: 18 },
  { label: "crimen", words: ["crimen", "tiroteo", "arrest", "asesin", "fbi", "violencia", "cartel"], weight: 16 },
  { label: "guerra", words: ["guerra", "ataque", "bomba", "misil", "militar", "invasion"], weight: 17 },
  { label: "politica", words: ["presidente", "gobierno", "congreso", "politic", "ley", "eleccion"], weight: 14 },
  { label: "escandalo", words: ["escandalo", "corrup", "fraude", "demanda", "acus"], weight: 15 },
  { label: "viral", words: ["viral", "tendencia", "impacta", "explota", "rompe", "masivo"], weight: 12 }
];

const DEFAULT_SPM_SOURCES: SeedNewsSource[] = [
  {
    name: "CNN",
    type: "rss",
    rss_url: "https://rss.cnn.com/rss/cnn_topstories.rss",
    region: "USA",
    category: "USA",
    default_categories: ["USA"],
    active: true,
    is_active: true,
    priority: 84,
    trust_score: 76,
    max_items_per_run: 10,
    meta: { sourceKind: "rss" }
  },
  {
    name: "BBC",
    type: "rss",
    rss_url: "https://feeds.bbci.co.uk/news/rss.xml",
    region: "Mundo",
    category: "Mundo",
    default_categories: ["Mundo"],
    active: true,
    is_active: true,
    priority: 78,
    trust_score: 80,
    max_items_per_run: 10,
    meta: { sourceKind: "rss" }
  },
  {
    name: "NYTimes",
    type: "rss",
    rss_url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
    region: "USA",
    category: "USA",
    default_categories: ["USA"],
    active: true,
    is_active: true,
    priority: 80,
    trust_score: 82,
    max_items_per_run: 10,
    meta: { sourceKind: "rss" }
  },
  {
    name: "Fox News",
    type: "rss",
    rss_url: "https://moxie.foxnews.com/google-publisher/latest.xml",
    region: "USA",
    category: "USA",
    default_categories: ["USA"],
    active: true,
    is_active: true,
    priority: 74,
    trust_score: 68,
    max_items_per_run: 10,
    meta: { sourceKind: "rss" }
  },
  {
    name: "Telemundo",
    type: "google_news",
    rss_url:
      "https://news.google.com/rss/search?q=site%3Atelemundo.com%2Fnoticias&hl=es-419&gl=US&ceid=US%3Aes-419",
    api_url: "telemundo.com/noticias",
    region: "USA",
    category: "USA",
    default_categories: ["USA", "Latino"],
    active: true,
    is_active: true,
    priority: 77,
    trust_score: 72,
    max_items_per_run: 8,
    meta: { sourceKind: "google_news", query: "site:telemundo.com/noticias" }
  },
  {
    name: "Univision",
    type: "google_news",
    rss_url:
      "https://news.google.com/rss/search?q=site%3Aunivision.com%2Fnoticias&hl=es-419&gl=US&ceid=US%3Aes-419",
    api_url: "univision.com/noticias",
    region: "USA",
    category: "USA",
    default_categories: ["USA", "Latino"],
    active: true,
    is_active: true,
    priority: 77,
    trust_score: 72,
    max_items_per_run: 8,
    meta: { sourceKind: "google_news", query: "site:univision.com/noticias" }
  },
  {
    name: "AP News",
    type: "google_news",
    rss_url:
      "https://news.google.com/rss/search?q=site%3Aapnews.com&hl=en-US&gl=US&ceid=US%3Aen",
    api_url: "apnews.com",
    region: "USA",
    category: "USA",
    default_categories: ["USA"],
    active: true,
    is_active: true,
    priority: 82,
    trust_score: 84,
    max_items_per_run: 10,
    meta: { sourceKind: "google_news", query: "site:apnews.com" }
  },
  {
    name: "Google News Puerto Rico",
    type: "google_news",
    rss_url: `${GOOGLE_NEWS_ENDPOINT}?q=Puerto+Rico&hl=es-419&gl=PR&ceid=PR:es-419`,
    api_url: "Puerto Rico",
    region: "PR",
    category: "PR",
    default_categories: ["PR"],
    active: true,
    is_active: true,
    priority: 92,
    trust_score: 65,
    max_items_per_run: 10,
    meta: { sourceKind: "google_news", query: "Puerto Rico" }
  },
  {
    name: "Google News Texas",
    type: "google_news",
    rss_url: `${GOOGLE_NEWS_ENDPOINT}?q=Texas&hl=en-US&gl=US&ceid=US:en`,
    api_url: "Texas",
    region: "TX",
    category: "TX",
    default_categories: ["TX"],
    active: true,
    is_active: true,
    priority: 88,
    trust_score: 63,
    max_items_per_run: 10,
    meta: { sourceKind: "google_news", query: "Texas" }
  },
  {
    name: "Google News USA Breaking",
    type: "google_news",
    rss_url: `${GOOGLE_NEWS_ENDPOINT}?q=USA+breaking&hl=en-US&gl=US&ceid=US:en`,
    api_url: "USA breaking",
    region: "USA",
    category: "USA",
    default_categories: ["USA"],
    active: true,
    is_active: true,
    priority: 86,
    trust_score: 62,
    max_items_per_run: 10,
    meta: { sourceKind: "google_news", query: "USA breaking" }
  },
  {
    name: "Google News Crime",
    type: "google_news",
    rss_url: `${GOOGLE_NEWS_ENDPOINT}?q=crime&hl=en-US&gl=US&ceid=US:en`,
    api_url: "crime",
    region: "USA",
    category: "Crimen",
    default_categories: ["Crimen", "USA"],
    active: true,
    is_active: true,
    priority: 85,
    trust_score: 60,
    max_items_per_run: 10,
    meta: { sourceKind: "google_news", query: "crime" }
  },
  {
    name: "Google News Politics",
    type: "google_news",
    rss_url: `${GOOGLE_NEWS_ENDPOINT}?q=politics&hl=en-US&gl=US&ceid=US:en`,
    api_url: "politics",
    region: "USA",
    category: "Politica",
    default_categories: ["Politica", "USA"],
    active: true,
    is_active: true,
    priority: 85,
    trust_score: 60,
    max_items_per_run: 10,
    meta: { sourceKind: "google_news", query: "politics" }
  },
  {
    name: "Google News Viral",
    type: "google_news",
    rss_url: `${GOOGLE_NEWS_ENDPOINT}?q=viral&hl=es-419&gl=US&ceid=US:es-419`,
    api_url: "viral",
    region: "USA",
    category: "USA",
    default_categories: ["USA"],
    active: true,
    is_active: true,
    priority: 82,
    trust_score: 55,
    max_items_per_run: 8,
    meta: { sourceKind: "google_news", query: "viral" }
  },
  {
    name: "Google News Latino",
    type: "google_news",
    rss_url: `${GOOGLE_NEWS_ENDPOINT}?q=latino&hl=es-419&gl=US&ceid=US:es-419`,
    api_url: "latino",
    region: "USA",
    category: "USA",
    default_categories: ["USA", "Latino"],
    active: true,
    is_active: true,
    priority: 84,
    trust_score: 58,
    max_items_per_run: 8,
    meta: { sourceKind: "google_news", query: "latino" }
  },
  {
    name: "Reddit r/news",
    type: "reddit",
    rss_url: "https://www.reddit.com/r/news/.json?limit=20&raw_json=1",
    api_url: "r/news",
    region: "USA",
    category: "USA",
    default_categories: ["USA"],
    active: false,
    is_active: false,
    priority: 58,
    trust_score: 42,
    max_items_per_run: 8,
    meta: { subreddit: "news", sourceKind: "reddit" }
  },
  {
    name: "Reddit r/worldnews",
    type: "reddit",
    rss_url: "https://www.reddit.com/r/worldnews/.json?limit=20&raw_json=1",
    api_url: "r/worldnews",
    region: "Mundo",
    category: "Mundo",
    default_categories: ["Mundo"],
    active: false,
    is_active: false,
    priority: 55,
    trust_score: 40,
    max_items_per_run: 8,
    meta: { subreddit: "worldnews", sourceKind: "reddit" }
  }
];

function selectSourcesQuery(service: SupabaseClient) {
  return service
    .from("news_sources")
    .select(
      "id, name, type, rss_url, api_url, category, region, active, is_active, priority, meta, default_categories, auto_publish, auto_post_facebook, max_items_per_run, trust_score, last_checked_at, last_scanned_at, scan_every_min"
    )
    .order("priority", { ascending: false })
    .order("updated_at", { ascending: false });
}

function isSourceActive(source: NewsSourceRow) {
  return (source.active ?? source.is_active ?? true) !== false;
}

function extractGoogleNewsFeedUrl(source: NewsSourceRow) {
  const metaQuery = String(source.meta?.query ?? "").trim();
  if (source.rss_url && source.rss_url.includes("news.google.com/rss/search")) return source.rss_url;
  if (!metaQuery) return source.rss_url ?? null;

  const region = String(source.region ?? "USA").toUpperCase();
  const locale =
    region === "PR"
      ? { hl: "es-419", gl: "PR", ceid: "PR:es-419" }
      : { hl: "en-US", gl: "US", ceid: "US:en" };
  return `${GOOGLE_NEWS_ENDPOINT}?q=${encodeURIComponent(metaQuery)}&hl=${locale.hl}&gl=${locale.gl}&ceid=${encodeURIComponent(locale.ceid)}`;
}

function normalizeRegion(region?: string | null, text = "") {
  const raw = String(region ?? "").trim();
  const hay = text.toLowerCase();
  if (raw) {
    if (/^puerto rico$/i.test(raw)) return "PR";
    if (/^texas$/i.test(raw)) return "TX";
    if (/^(usa|us|estados unidos)$/i.test(raw)) return "USA";
    return raw;
  }
  if (/(puerto rico|san juan|boricua|ponce|mayaguez|bayamon)/i.test(hay)) return "PR";
  if (/(texas|houston|dallas|austin|san antonio|el paso)/i.test(hay)) return "TX";
  if (/(u\.s\.|usa|united states|washington|new york|california)/i.test(hay)) return "USA";
  return "Mundo";
}

function pickPrimaryCategory(categories: string[], text: string, region: string) {
  const hay = text.toLowerCase();
  if (region === "PR") return "PR";
  if (region === "TX") return "TX";
  if (/(crimen|asesin|tiroteo|homicidio|arrest|violencia|policia)/i.test(hay)) return "Crimen";
  if (/(politic|gobierno|presidente|congreso|eleccion|senado|ley)/i.test(hay)) return "Politica";
  if (region === "USA") return "USA";
  const cleaned = cleanNewsCategories(categories);
  const mapped = cleaned.find((item) => ["PR", "TX", "USA", "Mundo", "Crimen", "Politica"].includes(item));
  return mapped ?? "Mundo";
}

function buildSourceMeta(raw?: Record<string, unknown>) {
  return raw ?? {};
}

async function ensureUniqueSlug(service: SupabaseClient, baseSlug: string) {
  let slug = baseSlug;
  for (let i = 0; i < 6; i += 1) {
    const { data, error } = await service.from("news_articles").select("id").eq("slug", slug).limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data?.id) return slug;
    slug = `${baseSlug}-${Math.floor(Math.random() * 900 + 100)}`;
  }
  return `${baseSlug}-${Date.now().toString().slice(-6)}`;
}

async function sourceAlreadyIngested(service: SupabaseClient, candidate: IngestedCandidate) {
  const sourceUrl = normalizeSourceUrl(candidate.sourceUrl);
  if (sourceUrl) {
    const [articleRes, legacyRes] = await Promise.all([
      service.from("news_articles").select("id").eq("source_url", sourceUrl).limit(1).maybeSingle(),
      service.from("news_items").select("id").eq("source_url", sourceUrl).limit(1).maybeSingle()
    ]);
    if (!articleRes.error && articleRes.data?.id) return true;
    if (!legacyRes.error && legacyRes.data?.id) return true;
  }

  const [titleArticleRes, titleLegacyRes] = await Promise.all([
    service.from("news_articles").select("id").eq("original_title", candidate.title).limit(1).maybeSingle(),
    service.from("news_items").select("id").eq("title", candidate.title).limit(1).maybeSingle()
  ]);
  return Boolean((!titleArticleRes.error && titleArticleRes.data?.id) || (!titleLegacyRes.error && titleLegacyRes.data?.id));
}

async function upsertLegacyDraft(
  service: SupabaseClient,
  articleId: string,
  candidate: IngestedCandidate,
  generated: Awaited<ReturnType<typeof generateNewsDraftContent>>,
  imageUrl: string
) {
  const categories = cleanNewsCategories([generated.category, generated.region, ...(candidate.categories ?? [])]);
  const payload = {
    title: generated.title,
    summary: generated.summary,
    analysis: generated.analysis,
    source_url: candidate.sourceUrl,
    categories: categories.length > 0 ? categories : ["Mundo"],
    tags: Array.from(
      new Set([
        ...generated.tags,
        ...generated.hashtags.map((item) => item.replace(/^#/, "").toLowerCase())
      ])
    ).slice(0, 14),
    cover_url: imageUrl,
    publication_state: "draft" as const,
    published_at: null,
    ingest_source: candidate.sourceName,
    raw_title: candidate.title,
    raw_summary: candidate.summary,
    raw_body: candidate.content,
    rewrite_status: "done",
    rewrite_error: null,
    needs_review: false
  };

  const existing = await service.from("news_items").select("id").eq("source_url", candidate.sourceUrl).limit(1).maybeSingle();
  if (!existing.error && existing.data?.id) {
    const update = await service.from("news_items").update(payload).eq("id", existing.data.id).select("id").limit(1).maybeSingle();
    if (update.error && !/(raw_title|raw_summary|raw_body|rewrite_status|needs_review)/i.test(update.error.message ?? "")) {
      throw new Error(update.error.message);
    }
    if (!update.error && update.data?.id) {
      await service.from("news_articles").update({ legacy_news_item_id: update.data.id }).eq("id", articleId);
      return String(update.data.id);
    }
  }

  const insert = await service.from("news_items").insert(payload).select("id").limit(1).maybeSingle();
  if (insert.error && /(raw_title|raw_summary|raw_body|rewrite_status|needs_review)/i.test(insert.error.message ?? "")) {
    const fallback = await service
      .from("news_items")
      .insert({
        title: payload.title,
        summary: payload.summary,
        analysis: payload.analysis,
        source_url: payload.source_url,
        categories: payload.categories,
        tags: payload.tags,
        cover_url: payload.cover_url,
        publication_state: payload.publication_state,
        published_at: payload.published_at,
        ingest_source: payload.ingest_source
      })
      .select("id")
      .limit(1)
      .maybeSingle();
    if (fallback.error) throw new Error(fallback.error.message);
    if (fallback.data?.id) {
      await service.from("news_articles").update({ legacy_news_item_id: fallback.data.id }).eq("id", articleId);
      return String(fallback.data.id);
    }
    return null;
  }
  if (insert.error) throw new Error(insert.error.message);
  if (insert.data?.id) {
    await service.from("news_articles").update({ legacy_news_item_id: insert.data.id }).eq("id", articleId);
    return String(insert.data.id);
  }
  return null;
}

async function insertDraftArticle(service: SupabaseClient, candidate: IngestedCandidate) {
  const generated = await generateNewsDraftContent(candidate);
  const cover = generateSpmNewsImage({
    title: generated.title,
    summary: generated.subtitle || generated.summary,
    category: generated.category,
    region: generated.region,
    sourceName: candidate.sourceName,
    originalImageUrl: candidate.featuredImageUrl
  });
  const slug = await ensureUniqueSlug(service, slugify(generated.title));
  const sourceName = candidate.sourceName;
  const sourceUrl = normalizeSourceUrl(candidate.sourceUrl) ?? candidate.sourceUrl;
  const tags = generated.tags;
  const hashtags = generated.hashtags;
  const impactScore = Number((candidate.impactScore ?? candidate.viralScore ?? 0).toFixed(4));
  const discoverScore = Number((candidate.viralScore ?? candidate.impactScore ?? computeInitialDiscoverScore(candidate)).toFixed(4));
  const engagementScore = Number((candidate.estimatedEngagement ?? discoverScore).toFixed(4));
  const controversyScore = computeControversyScore(`${candidate.title} ${candidate.summary} ${generated.analysis}`);

  const fullPayload = {
    source_id: candidate.sourceId,
    source_name: sourceName,
    title: generated.title,
    slug,
    source_url: sourceUrl,
    original_title: candidate.title,
    original_content: candidate.content,
    rewritten_content: generated.analysis,
    analysis: generated.analysis,
    summary: generated.summary,
    excerpt: generated.summary,
    author_name: "SPM News Engine",
    category: generated.category,
    region: generated.region,
    tags,
    hashtags,
    featured_image_url: normalizeImageUrl(candidate.featuredImageUrl),
    cover_image_url: cover.imageUrl,
    status: "draft",
    publish_at: null,
    published_at: null,
    trending_score: discoverScore,
    discover_score: discoverScore,
    controversy_score: controversyScore,
    engagement_score: engagementScore,
    impact_score: impactScore,
    ai_metadata: {
      source_hash: candidate.hash,
      source: sourceName,
      source_type: candidate.sourceType ?? "rss",
      trend_matches: candidate.trendMatches ?? [],
      impact_reasons: candidate.impactReasons ?? [],
      generator: {
        model: generated.model,
        seo_title: generated.seoTitle
      },
      cover: {
        prompt: cover.prompt,
        file_name: cover.fileName,
        headline: cover.headline,
        subtitle: cover.subtitle,
        visual_brief: cover.visualBrief,
        layout: "spm_news_v1",
        used_original_image: cover.usedOriginalImage
      },
      source_meta: buildSourceMeta(candidate.sourceMeta)
    },
    seo: {
      title: generated.seoTitle,
      description: generated.summary
    },
    social: {
      hashtags,
      auto_social_ready: true
    }
  };

  const insert = await service.from("news_articles").insert(fullPayload).select("id").limit(1).maybeSingle();
  let articleId = "";

  if (insert.error && /(source_name|analysis|hashtags|impact_score)/i.test(insert.error.message ?? "")) {
    const fallbackPayload = {
      source_id: fullPayload.source_id,
      title: fullPayload.title,
      slug: fullPayload.slug,
      source_url: fullPayload.source_url,
      original_title: fullPayload.original_title,
      original_content: fullPayload.original_content,
      rewritten_content: fullPayload.rewritten_content,
      summary: fullPayload.summary,
      excerpt: fullPayload.excerpt,
      author_name: fullPayload.author_name,
      category: fullPayload.category,
      region: fullPayload.region,
      tags: fullPayload.tags,
      featured_image_url: fullPayload.featured_image_url,
      cover_image_url: fullPayload.cover_image_url,
      status: fullPayload.status,
      publish_at: fullPayload.publish_at,
      published_at: fullPayload.published_at,
      trending_score: fullPayload.trending_score,
      discover_score: fullPayload.discover_score,
      controversy_score: fullPayload.controversy_score,
      engagement_score: fullPayload.engagement_score,
      ai_metadata: fullPayload.ai_metadata,
      seo: fullPayload.seo,
      social: fullPayload.social
    };
    const fallbackInsert = await service.from("news_articles").insert(fallbackPayload).select("id").limit(1).maybeSingle();
    if (fallbackInsert.error) {
      if (fallbackInsert.error.code === "23505") return { articleId: "", legacyId: null, imageUrl: cover.imageUrl };
      throw new Error(fallbackInsert.error.message);
    }
    articleId = String(fallbackInsert.data?.id ?? "");
  } else if (insert.error) {
    if (insert.error.code === "23505") return { articleId: "", legacyId: null, imageUrl: cover.imageUrl };
    throw new Error(insert.error.message);
  } else {
    articleId = String(insert.data?.id ?? "");
  }

  if (!articleId) return { articleId: "", legacyId: null, imageUrl: cover.imageUrl };

  try {
    await service.from("news_assets").insert({
      article_id: articleId,
      asset_type: "cover",
      url: cover.imageUrl,
      meta: {
        prompt: cover.prompt,
        file_name: cover.fileName,
        headline: cover.headline,
        subtitle: cover.subtitle,
        visual_brief: cover.visualBrief,
        source_image_url: candidate.featuredImageUrl,
        used_original_image: cover.usedOriginalImage
      }
    });
  } catch {
    // Non-blocking asset mirror.
  }

  const legacyId = await upsertLegacyDraft(service, articleId, candidate, generated, cover.imageUrl);
  return { articleId, legacyId, imageUrl: cover.imageUrl };
}

async function fetchRssSource(source: NewsSourceRow, timeoutMs: number, perSourceLimit: number) {
  const feedUrl = source.rss_url;
  if (!feedUrl) return [] as RawFetchedArticle[];
  const items = await fetchRssFeed(feedUrl, timeoutMs);
  return items.slice(0, perSourceLimit).map((item) => ({
    source,
    title: item.title,
    summary: item.description,
    content: item.description || item.title,
    sourceUrl: item.link,
    publishedAt: item.publishedAt,
    featuredImageUrl: item.imageUrl,
    meta: {}
  }));
}

function extractRedditImage(post: any) {
  const preview = post?.preview?.images?.[0]?.source?.url;
  const thumbnail = String(post?.thumbnail ?? "");
  const candidate = preview || (/^https?:\/\//i.test(thumbnail) ? thumbnail : "");
  return normalizeImageUrl(String(candidate).replace(/&amp;/g, "&"));
}

async function fetchRedditSource(source: NewsSourceRow, timeoutMs: number, perSourceLimit: number) {
  const url = source.rss_url;
  if (!url) return [] as RawFetchedArticle[];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": "SPMNewsBot/1.0"
      }
    });
    if (!response.ok) throw new Error(`Reddit HTTP ${response.status}`);
    const json = (await response.json().catch(() => ({}))) as any;
    const children = Array.isArray(json?.data?.children) ? json.data.children : [];
    return children.slice(0, perSourceLimit).map((child: any) => {
      const post = child?.data ?? {};
      return {
        source,
        title: sanitizeText(String(post.title ?? "")),
        summary: sanitizeText(String(post.selftext ?? post.title ?? "")),
        content: sanitizeText(String(post.selftext ?? post.title ?? "")),
        sourceUrl: String(post.url_overridden_by_dest ?? post.url ?? ""),
        publishedAt: Number.isFinite(Number(post.created_utc)) ? new Date(Number(post.created_utc) * 1000).toISOString() : null,
        featuredImageUrl: extractRedditImage(post),
        meta: {
          subreddit: post.subreddit,
          score: Number(post.score ?? 0),
          comments: Number(post.num_comments ?? 0),
          permalink: post.permalink ?? null
        }
      } satisfies RawFetchedArticle;
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function ensureSpmNewsSourceDefaults(serviceClient?: SupabaseClient) {
  const service = serviceClient ?? supabaseService();
  try {
    const seeds = DEFAULT_SPM_SOURCES.map((row) => ({
      ...row,
      auto_publish: false,
      auto_post_facebook: false
    }));

    const { data: existingRows } = await service.from("news_sources").select("id, name, rss_url");

    const byName = new Map<string, string>();
    const byUrl = new Map<string, string>();
    for (const row of existingRows ?? []) {
      const id = String((row as any).id ?? "");
      const name = String((row as any).name ?? "");
      const rssUrl = String((row as any).rss_url ?? "");
      if (id && name) byName.set(name, id);
      if (id && rssUrl) byUrl.set(rssUrl, id);
    }

    for (const seed of seeds) {
      const existingId = byName.get(String(seed.name)) ?? byUrl.get(String(seed.rss_url ?? ""));
      if (existingId) {
        await service
          .from("news_sources")
          .update(seed)
          .eq("id", existingId);
        continue;
      }

      await service.from("news_sources").insert(seed);
    }
  } catch {
    // Source seeding is best-effort so local development doesn't hard fail on partial schemas.
  }
}

export async function fetchNewsFromSources(options: IngestOptions = {}, serviceClient?: SupabaseClient) {
  const service = serviceClient ?? supabaseService();
  await ensureSpmNewsSourceDefaults(service);

  const perSourceLimit = Math.max(1, Math.min(20, Number(options.perSourceLimit ?? 10)));
  const timeoutMs = Math.max(4000, Number(options.timeoutMs ?? 12000));
  const sourceLimit = Math.max(1, Math.min(60, Number(options.sourceLimit ?? 40)));

  const { data, error } = await selectSourcesQuery(service).limit(sourceLimit);
  if (error) throw new Error(error.message);
  const sources = ((data ?? []) as NewsSourceRow[]).filter(isSourceActive);

  const fetched: RawFetchedArticle[] = [];

  for (const source of sources) {
    const sourceType = String(source.type ?? "rss").toLowerCase();
    try {
      let items: RawFetchedArticle[] = [];
      if (sourceType === "reddit") {
        items = await fetchRedditSource(source, timeoutMs, perSourceLimit);
      } else if (sourceType === "google_news" || (sourceType === "api" && String(source.rss_url ?? "").includes("news.google.com"))) {
        const googleSource = { ...source, rss_url: extractGoogleNewsFeedUrl(source) };
        items = await fetchRssSource(googleSource, timeoutMs, perSourceLimit);
      } else {
        items = await fetchRssSource(source, timeoutMs, perSourceLimit);
      }
      fetched.push(...items.filter((item) => item.title && item.sourceUrl));
    } catch {
      continue;
    }
  }

  return fetched;
}

export function normalizeArticles(items: RawFetchedArticle[]) {
  return items
    .map((item) => {
      const title = sanitizeText(item.title);
      const summary = sanitizeText(item.summary || item.content || item.title).slice(0, 420);
      const content = sanitizeText(item.content || item.summary || item.title);
      const fullText = `${title} ${summary} ${content}`.trim();
      const region = normalizeRegion(item.source.region ?? null, fullText);
      const categories = cleanNewsCategories(
        inferCategories({
          region,
          title,
          description: summary,
          defaults: item.source.default_categories ?? null
        })
      );
      const category = pickPrimaryCategory(categories, fullText, region);
      const tags = inferTags(title, summary, categories);

      return {
        sourceId: item.source.id,
        sourceName: item.source.name,
        sourceUrl: normalizeSourceUrl(item.sourceUrl) ?? item.sourceUrl,
        title,
        summary: summary || title,
        content: content || summary || title,
        publishedAt: item.publishedAt,
        region,
        category,
        tags,
        featuredImageUrl: normalizeImageUrl(item.featuredImageUrl),
        trustScore: Number(item.source.trust_score ?? 55),
        priority: Number(item.source.priority ?? 0),
        hash: contentHash([item.source.name, item.sourceUrl, title, summary]),
        sourceType: item.source.type ?? "rss",
        categories,
        sourceMeta: item.meta ?? {}
      } satisfies IngestedCandidate;
    })
    .filter((item) => item.title && item.sourceUrl);
}

export function removeDuplicates(items: IngestedCandidate[]) {
  const seenUrl = new Set<string>();
  const seenTitle = new Set<string>();
  const out: IngestedCandidate[] = [];

  for (const item of items) {
    const urlKey = normalizeSourceUrl(item.sourceUrl) ?? "";
    const titleKey = contentHash([item.title.toLowerCase(), item.sourceName.toLowerCase()]);
    if ((urlKey && seenUrl.has(urlKey)) || seenTitle.has(titleKey)) continue;
    if (urlKey) seenUrl.add(urlKey);
    seenTitle.add(titleKey);
    out.push(item);
  }

  return out;
}

async function loadLearningProfile(service: SupabaseClient): Promise<LearningProfile> {
  const { data } = await service
    .from("news_articles")
    .select("region, category, engagement_score")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(120);

  const regionTotals = new Map<string, { total: number; count: number }>();
  const categoryTotals = new Map<string, { total: number; count: number }>();
  let engagementTotal = 0;
  let engagementCount = 0;

  for (const row of data ?? []) {
    const region = String((row as any).region ?? "").trim();
    const category = String((row as any).category ?? "").trim();
    const engagement = Number((row as any).engagement_score ?? 0);
    if (region) {
      const current = regionTotals.get(region) ?? { total: 0, count: 0 };
      current.total += engagement;
      current.count += 1;
      regionTotals.set(region, current);
    }
    if (category) {
      const current = categoryTotals.get(category) ?? { total: 0, count: 0 };
      current.total += engagement;
      current.count += 1;
      categoryTotals.set(category, current);
    }
    engagementTotal += engagement;
    engagementCount += 1;
  }

  const averageEngagement = engagementCount > 0 ? engagementTotal / engagementCount : 40;
  const buildBoosts = (map: Map<string, { total: number; count: number }>) =>
    Array.from(map.entries()).reduce<Record<string, number>>((acc, [key, value]) => {
      const avg = value.count > 0 ? value.total / value.count : averageEngagement;
      acc[key] = averageEngagement > 0 ? Math.max(0.8, Math.min(1.25, avg / averageEngagement)) : 1;
      return acc;
    }, {});

  return {
    regionBoosts: buildBoosts(regionTotals),
    categoryBoosts: buildBoosts(categoryTotals),
    averageEngagement
  };
}

async function loadTrendKeywords(service: SupabaseClient) {
  const since = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
  const { data, error } = await service
    .from("trend_snapshots")
    .select("keyword, region, score")
    .gte("created_at", since)
    .order("score", { ascending: false })
    .limit(80);

  if (error) return [] as Array<{ keyword: string; region: string | null; score: number }>;
  return (data ?? []).map((row: any) => ({
    keyword: String(row.keyword ?? ""),
    region: row.region ? String(row.region) : null,
    score: Number(row.score ?? 0)
  }));
}

function computeImpactReasons(text: string) {
  const hay = text.toLowerCase();
  const reasons: string[] = [];
  let score = 0;

  for (const rule of IMPACT_RULES) {
    if (rule.words.some((word) => hay.includes(word.toLowerCase()))) {
      reasons.push(rule.label);
      score += rule.weight;
    }
  }

  return { reasons, score };
}

function computeTrendBoost(article: IngestedCandidate, trends: Array<{ keyword: string; region: string | null; score: number }>) {
  const text = `${article.title} ${article.summary} ${article.content}`.toLowerCase();
  const matches = trends.filter((trend) => {
    const keyword = trend.keyword.toLowerCase().trim();
    if (!keyword) return false;
    const sameRegion = !trend.region || trend.region === article.region;
    return sameRegion && (text.includes(keyword) || keyword.split(/\s+/).every((token) => token.length > 3 && text.includes(token)));
  });
  const boost = matches.slice(0, 4).reduce((acc, trend) => acc + Number(trend.score ?? 0) * 0.22, 0);
  return {
    boost,
    matches: matches.slice(0, 4).map((item) => item.keyword)
  };
}

export async function rankByImpact(items: IngestedCandidate[], serviceClient?: SupabaseClient) {
  const service = serviceClient ?? supabaseService();
  const [trends, learning] = await Promise.all([loadTrendKeywords(service), loadLearningProfile(service)]);

  return items
    .map((item) => {
      const text = `${item.title} ${item.summary} ${item.content}`;
      const keywordImpact = computeImpactReasons(text);
      const trendImpact = computeTrendBoost(item, trends);
      const baseDiscover = computeInitialDiscoverScore(item);
      const controversy = computeControversyScore(text);
      const recencyBoost = item.publishedAt
        ? Math.max(6, 28 - (Date.now() - new Date(item.publishedAt).getTime()) / (1000 * 60 * 60 * 3))
        : 10;
      const regionPriorityIndex = Math.max(0, DEFAULT_REGION_PRIORITY.indexOf(String(item.region ?? "Mundo")));
      const regionBoost = [22, 18, 14, 9][regionPriorityIndex] ?? 8;
      const categoryBoost = learning.categoryBoosts[item.category ?? ""] ?? 1;
      const learningBoost = learning.regionBoosts[item.region ?? ""] ?? 1;
      const redditEngagement =
        Number(item.sourceMeta?.score ?? 0) * 0.08 + Number(item.sourceMeta?.comments ?? 0) * 0.12;
      const estimatedEngagement =
        Number((baseDiscover + controversy * 0.55 + trendImpact.boost + recencyBoost + redditEngagement).toFixed(4));
      const impactScore = Number(
        (
          (keywordImpact.score + trendImpact.boost + recencyBoost + regionBoost + Math.max(0, item.priority)) *
          categoryBoost *
          learningBoost
        ).toFixed(4)
      );
      const viralScore = Number((impactScore * 0.58 + estimatedEngagement * 0.42).toFixed(4));

      return {
        ...item,
        impactScore,
        viralScore,
        estimatedEngagement,
        trendMatches: trendImpact.matches,
        impactReasons: keywordImpact.reasons.length > 0 ? keywordImpact.reasons : trendImpact.matches.slice(0, 2),
        hashtags: []
      } satisfies IngestedCandidate;
    })
    .sort((a, b) => Number(b.viralScore ?? 0) - Number(a.viralScore ?? 0));
}

async function storeLearningSnapshot(service: SupabaseClient, ranked: IngestedCandidate[]) {
  const top = ranked.slice(0, 15).map((item) => ({
    title: item.title,
    region: item.region,
    category: item.category,
    impactScore: item.impactScore,
    viralScore: item.viralScore
  }));

  try {
    await service.from("admin_settings").upsert(
      {
        key: "spm_news_learning",
        value: {
          updated_at: new Date().toISOString(),
          top_candidates: top
        }
      },
      { onConflict: "key" }
    );
  } catch {
    // Learning snapshot is additive and should not stop ingestion.
  }
}

export async function runSpmNewsIngestionPipeline(options: IngestOptions = {}, serviceClient?: SupabaseClient): Promise<IngestSummary> {
  const service = serviceClient ?? supabaseService();
  const fetched = await fetchNewsFromSources(options, service);
  const normalized = normalizeArticles(fetched);
  const deduped = removeDuplicates(normalized);
  const ranked = await rankByImpact(deduped, service);
  const rankedLimit = Math.max(1, Math.min(30, Number(options.rankedLimit ?? 18)));
  const selected = ranked.slice(0, rankedLimit);

  const summary: IngestSummary = {
    sources: new Set(fetched.map((item) => item.source.id)).size,
    scanned: fetched.length,
    created: 0,
    skipped: 0,
    failed: 0,
    mirroredToLegacy: 0,
    errors: []
  };

  for (const candidate of selected) {
    try {
      if (await sourceAlreadyIngested(service, candidate)) {
        summary.skipped += 1;
        continue;
      }

      const inserted = await insertDraftArticle(service, candidate);
      if (!inserted.articleId) {
        summary.skipped += 1;
        continue;
      }

      summary.created += 1;
      if (inserted.legacyId) summary.mirroredToLegacy += 1;
    } catch (error: any) {
      summary.failed += 1;
      summary.errors.push({
        source: candidate.sourceName,
        message: error?.message ?? "Error creando borrador"
      });
    }
  }

  const sourceIds = Array.from(new Set(fetched.map((item) => item.source.id).filter(Boolean)));
  if (sourceIds.length > 0) {
    try {
      await service
        .from("news_sources")
        .update({
          last_checked_at: new Date().toISOString(),
          last_scanned_at: new Date().toISOString()
        })
        .in("id", sourceIds);
    } catch {
      // no-op
    }
  }

  await storeLearningSnapshot(service, ranked);
  return summary;
}
