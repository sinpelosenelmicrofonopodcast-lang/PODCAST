import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseService } from "@/lib/supabaseService";
import type { IngestedCandidate, NewsSourceRow } from "@/types/viral";
import { fetchRssFeed } from "@/lib/news/fetch-rss";
import { dedupeFeedItems } from "@/lib/news/dedupe";
import { normalizeFeedItemToCandidate } from "@/lib/news/normalize";
import { computeControversyScore, computeInitialDiscoverScore } from "@/lib/news/score";
import { slugify } from "@/lib/validations/common";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { cleanNewsCategories } from "@/lib/newsCategories";
import { buildSpmCoverTemplate } from "@/lib/images/spm-cover-template";
import { assessNewsCandidateQuality } from "@/lib/news/quality";

type IngestOptions = {
  sourceLimit?: number;
  perSourceLimit?: number;
  timeoutMs?: number;
};

export type IngestSummary = {
  sources: number;
  scanned: number;
  created: number;
  skipped: number;
  failed: number;
  mirroredToLegacy: number;
  errors: Array<{ source: string; message: string }>;
};

function baseSourceQuery(service: SupabaseClient) {
  return service
    .from("news_sources")
    .select(
      "id, name, type, rss_url, api_url, category, region, active, is_active, priority, meta, default_categories, auto_publish, auto_post_facebook, max_items_per_run, trust_score"
    )
    .order("priority", { ascending: false })
    .order("updated_at", { ascending: false });
}

export async function listActiveNewsSources(service: SupabaseClient, limit = 40) {
  const query = baseSourceQuery(service).limit(limit);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as NewsSourceRow[]).filter((row) => {
    const active = row.active ?? row.is_active ?? true;
    return active !== false;
  });
}

async function ensureUniqueSlug(service: SupabaseClient, baseSlug: string) {
  const maxAttempts = 6;
  let slug = baseSlug;
  for (let i = 0; i < maxAttempts; i += 1) {
    const { data, error } = await service
      .from("news_articles")
      .select("id")
      .eq("slug", slug)
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data?.id) return slug;
    slug = `${baseSlug}-${Math.floor(Math.random() * 900 + 100)}`;
  }
  return `${baseSlug}-${Date.now().toString().slice(-6)}`;
}

async function mirrorToLegacyNewsItems(
  service: SupabaseClient,
  candidate: IngestedCandidate,
  status: "draft" | "published",
  coverUrlOverride?: string | null
) {
  const coverUrl = normalizeImageUrl(coverUrlOverride ?? candidate.featuredImageUrl);
  const categories = cleanNewsCategories([candidate.category ?? "Mundo", candidate.region ?? null]);
  const payload = {
    title: candidate.title,
    summary: candidate.summary || null,
    analysis: candidate.content || candidate.summary || candidate.title,
    source_url: candidate.sourceUrl,
    categories: categories.length > 0 ? categories : ["Mundo"],
    tags: candidate.tags,
    cover_url: coverUrl,
    publication_state: status,
    published_at: status === "published" ? candidate.publishedAt ?? new Date().toISOString() : null,
    ingest_source: candidate.sourceName,
    raw_title: candidate.title,
    raw_summary: candidate.summary,
    raw_body: candidate.content,
    rewrite_status: "none"
  };

  const { data, error } = await service.from("news_items").insert(payload).select("id").limit(1).maybeSingle();
  if (error) {
    if (error.code === "23505") return null;
    if (/raw_title|raw_summary|raw_body|rewrite_status/i.test(error.message ?? "")) {
      const fallback = await service
        .from("news_items")
        .insert({
          title: payload.title,
          summary: payload.summary,
          analysis: payload.analysis,
          source_url: payload.source_url,
          categories: payload.categories,
          tags: payload.tags,
          cover_url: coverUrl,
          publication_state: payload.publication_state,
          published_at: payload.published_at,
          ingest_source: payload.ingest_source
        })
        .select("id")
        .limit(1)
        .maybeSingle();
      if (fallback.error && fallback.error.code !== "23505") throw new Error(fallback.error.message);
      return (fallback.data?.id as string | undefined) ?? null;
    }
    throw new Error(error.message);
  }
  return (data?.id as string | undefined) ?? null;
}

async function insertArticle(service: SupabaseClient, candidate: IngestedCandidate, source: NewsSourceRow) {
  const rawSlug = slugify(candidate.title);
  const slug = await ensureUniqueSlug(service, rawSlug);

  const autoPublish = source.auto_publish === true;
  const discoverScore = computeInitialDiscoverScore(candidate);
  const controversyScore = computeControversyScore(`${candidate.title} ${candidate.summary}`);

  let coverUrl = normalizeImageUrl(candidate.featuredImageUrl);
  let generatedCover = false;
  let coverError: string | null = null;

  if (!coverUrl) {
    try {
      const generated = buildSpmCoverTemplate({
        title: candidate.title,
        kicker: candidate.category ?? "NOTICIAS"
      });
      coverUrl = generated.dataUrl;
      generatedCover = true;
    } catch (error: any) {
      coverError = String(error?.message ?? "cover_generation_failed");
    }
  }

  const quality = assessNewsCandidateQuality({
    title: candidate.title,
    summary: candidate.summary,
    content: candidate.content,
    hasImage: Boolean(coverUrl)
  });
  const status = autoPublish && quality.readyForAutoPublish ? "published" : "pending_review";

  const payload = {
    source_id: source.id,
    title: candidate.title,
    slug,
    source_url: candidate.sourceUrl,
    original_title: candidate.title,
    original_content: candidate.content,
    rewritten_content: null,
    summary: candidate.summary || null,
    excerpt: candidate.summary || null,
    author_name: "SPM News",
    category: candidate.category,
    region: candidate.region,
    tags: candidate.tags,
    featured_image_url: coverUrl,
    cover_image_url: coverUrl,
    status,
    publish_at: status === "published" ? candidate.publishedAt ?? new Date().toISOString() : null,
    published_at: status === "published" ? candidate.publishedAt ?? new Date().toISOString() : null,
    trending_score: discoverScore,
    discover_score: discoverScore,
    controversy_score: controversyScore,
    engagement_score: discoverScore,
    ai_metadata: {
      source_hash: candidate.hash,
      ingestion: "rss",
      source: source.name,
      quality: {
        score: quality.qualityScore,
        review_reasons: quality.reviewReasons,
        likely_spanish: quality.isLikelySpanish
      },
      cover: {
        generated: generatedCover,
        generation_error: coverError
      }
    },
    seo: {
      title: `${candidate.title} | SPM News`,
      description: `${candidate.summary || candidate.title}`.slice(0, 155)
    },
    social: {
      facebook_auto: source.auto_post_facebook === true && status === "published",
      push_auto: true
    }
  };

  const { data, error } = await service.from("news_articles").insert(payload).select("id, slug, status").limit(1).maybeSingle();
  if (error) {
    if (error.code === "23505") return null;
    throw new Error(error.message);
  }

  if (!data?.id) return null;

  if (source.auto_post_facebook === true && status === "published") {
    await service.from("social_publications").insert({
      article_id: data.id,
      platform: "facebook",
      status: "queued",
      payload: {
        message: candidate.summary,
        title: candidate.title,
        link: `/noticias/${data.slug}`
      }
    });
  }

  return {
    ...(data as { id: string; slug: string; status: "draft" | "pending_review" | "scheduled" | "published" | "rejected" | "archived" }),
    quality,
    cover_url: coverUrl
  };
}

async function sourceAlreadyIngested(service: SupabaseClient, sourceUrl: string) {
  const checkNew = await service.from("news_articles").select("id").eq("source_url", sourceUrl).limit(1).maybeSingle();
  if (!checkNew.error && checkNew.data?.id) return true;

  const checkLegacy = await service.from("news_items").select("id").eq("source_url", sourceUrl).limit(1).maybeSingle();
  if (!checkLegacy.error && checkLegacy.data?.id) return true;

  return false;
}

async function ingestSource(service: SupabaseClient, source: NewsSourceRow, options: IngestOptions) {
  if (source.type !== "rss" && source.type !== "trend") {
    return { scanned: 0, created: 0, skipped: 0, failed: 0, mirroredToLegacy: 0 };
  }

  const feedUrl = source.rss_url;
  if (!feedUrl) {
    return { scanned: 0, created: 0, skipped: 0, failed: 1, mirroredToLegacy: 0 };
  }

  const feedItems = await fetchRssFeed(feedUrl, options.timeoutMs ?? 12000);
  const deduped = dedupeFeedItems(feedItems);
  const limit = Math.max(1, Math.min(30, Number(options.perSourceLimit ?? source.max_items_per_run ?? 12)));

  let scanned = 0;
  let created = 0;
  let skipped = 0;
  let failed = 0;
  let mirroredToLegacy = 0;

  for (const item of deduped.slice(0, limit)) {
    scanned += 1;
    try {
      if (await sourceAlreadyIngested(service, item.link)) {
        skipped += 1;
        continue;
      }

      const candidate = normalizeFeedItemToCandidate({
        source,
        feedItem: item,
        hash: item.hash
      });

      const inserted = await insertArticle(service, candidate, source);
      if (!inserted?.id) {
        skipped += 1;
        continue;
      }

      created += 1;

      if (inserted.status === "published") {
        const legacyId = await mirrorToLegacyNewsItems(service, candidate, "published", inserted.cover_url);
        if (legacyId) {
          mirroredToLegacy += 1;
          await service.from("news_articles").update({ legacy_news_item_id: legacyId }).eq("id", inserted.id);
        }
      }
    } catch {
      failed += 1;
    }
  }

  await service
    .from("news_sources")
    .update({
      last_checked_at: new Date().toISOString(),
      last_scanned_at: new Date().toISOString()
    })
    .eq("id", source.id);

  return { scanned, created, skipped, failed, mirroredToLegacy };
}

export async function runNewsIngestionPipeline(options: IngestOptions = {}, serviceClient?: SupabaseClient): Promise<IngestSummary> {
  const service = serviceClient ?? supabaseService();
  const sources = await listActiveNewsSources(service, options.sourceLimit ?? 30);

  const summary: IngestSummary = {
    sources: sources.length,
    scanned: 0,
    created: 0,
    skipped: 0,
    failed: 0,
    mirroredToLegacy: 0,
    errors: []
  };

  for (const source of sources) {
    try {
      const result = await ingestSource(service, source, options);
      summary.scanned += result.scanned;
      summary.created += result.created;
      summary.skipped += result.skipped;
      summary.failed += result.failed;
      summary.mirroredToLegacy += result.mirroredToLegacy;
    } catch (error: any) {
      summary.failed += 1;
      summary.errors.push({ source: source.name, message: error?.message ?? "Error ingestando fuente" });
    }
  }

  return summary;
}
