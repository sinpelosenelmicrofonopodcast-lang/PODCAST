import type { SupabaseClient } from "@supabase/supabase-js";
import { rewriteSinPelos } from "@/lib/ai/rewrite-sin-pelos";
import { generatePollFromArticle } from "@/lib/ai/generate-poll";
import { generateSocialCopy } from "@/lib/ai/generate-social-copy";
import { generateReelScript } from "@/lib/ai/generate-reel-script";
import { buildMemeTemplate } from "@/lib/images/meme-template";
import { buildQuoteCard } from "@/lib/images/quote-card";
import { buildThumbnail } from "@/lib/images/thumbnail";
import { asOptionalString, asString, asStringArray, isUuid, parseDate, requireNonEmpty } from "@/lib/validations/common";
import { cleanNewsCategories } from "@/lib/newsCategories";
import { generateSpmNewsImage } from "@/services/newsImageGenerator";
import { buildSpmCoverPrompt } from "@/lib/news/spmCoverPrompt";

export const SUPPORTED_SOCIAL_PLATFORMS = ["facebook", "instagram", "x", "tiktok"] as const;
export type SupportedSocialPlatform = (typeof SUPPORTED_SOCIAL_PLATFORMS)[number];

type ArticleSocialDraftInput = {
  platform: string;
  message: unknown;
  publishAs?: unknown;
};

export type ArticleEditorRow = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  analysis: string | null;
  excerpt: string | null;
  original_content: string | null;
  source_name: string | null;
  cover_image_url: string | null;
  featured_image_url: string | null;
  category: string | null;
  region: string | null;
  tags: string[] | null;
  hashtags: string[] | null;
  status: string;
  published_at: string | null;
  source_url: string | null;
  ai_metadata: Record<string, unknown> | null;
};

export async function getArticleEditorRow(service: SupabaseClient, articleId: string) {
  if (!isUuid(articleId)) throw new Error("articleId inválido.");

  const { data, error } = await service
    .from("news_articles")
    .select(
      "id, slug, title, summary, analysis, excerpt, original_content, source_name, cover_image_url, featured_image_url, category, region, tags, hashtags, status, published_at, source_url, ai_metadata"
    )
    .eq("id", articleId)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Artículo no encontrado.");
  return data as ArticleEditorRow;
}

export async function scheduleArticle(service: SupabaseClient, articleId: string, publishAt: string, actorId: string | null) {
  const iso = parseDate(publishAt);
  if (!iso) throw new Error("publishAt inválido.");

  const { error } = await service
    .from("news_articles")
    .update({
      status: "scheduled",
      publish_at: iso,
      updated_by: actorId
    })
    .eq("id", articleId);

  if (error) throw new Error(error.message);
  return { articleId, publishAt: iso };
}

export async function updateArticleEditorial(
  service: SupabaseClient,
  articleId: string,
  actorId: string | null,
  input: {
    title: unknown;
    summary?: unknown;
    analysis?: unknown;
    category?: unknown;
    region?: unknown;
    tags?: unknown;
    hashtags?: unknown;
    coverImageUrl?: unknown;
    coverPrompt?: unknown;
    coverFileName?: unknown;
  }
) {
  const article = await getArticleEditorRow(service, articleId);
  const title = requireNonEmpty(input.title, "title", 180);
  const summary = asOptionalString(input.summary, 1400);
  const analysis = asOptionalString(input.analysis, 6000);
  const category = asOptionalString(input.category, 120);
  const region = asOptionalString(input.region, 120);
  const tags = asStringArray(input.tags, 12, 32);
  const hashtags = asStringArray(input.hashtags, 10, 32).map((item) => (item.startsWith("#") ? item : `#${item}`));
  const coverImageUrl = asOptionalString(input.coverImageUrl, 2000);
  const generatedCover = buildSpmCoverPrompt({
    title,
    summary,
    category,
    region,
    sourceName: article.source_name
  });
  const coverPrompt = asOptionalString(input.coverPrompt, 8000) ?? generatedCover.prompt;
  const coverFileName = asOptionalString(input.coverFileName, 180) ?? generatedCover.fileName;
  const currentAiMetadata =
    article.ai_metadata && typeof article.ai_metadata === "object" && !Array.isArray(article.ai_metadata) ? article.ai_metadata : {};
  const currentCoverMeta =
    currentAiMetadata.cover && typeof currentAiMetadata.cover === "object" && !Array.isArray(currentAiMetadata.cover)
      ? (currentAiMetadata.cover as Record<string, unknown>)
      : {};

  const updatePayload: Record<string, unknown> = {
    title,
    summary,
    analysis,
    category,
    region,
    tags,
    hashtags,
    cover_image_url: coverImageUrl,
    ai_metadata: {
      ...currentAiMetadata,
      cover: {
        ...currentCoverMeta,
        prompt: coverPrompt,
        file_name: coverFileName,
        headline: generatedCover.headline,
        subtitle: generatedCover.subtitle,
        visual_brief: generatedCover.visualBrief,
        layout: "spm_news_v1"
      }
    },
    updated_by: actorId
  };

  if (!article.excerpt || article.excerpt === article.summary) {
    updatePayload.excerpt = summary;
  }

  const { error } = await service.from("news_articles").update(updatePayload).eq("id", articleId);
  if (error) throw new Error(error.message);

  return {
    articleId,
    title,
    summary,
    analysis,
    category,
    region,
    tags,
    hashtags,
    coverImageUrl,
    coverPrompt,
    coverFileName
  };
}

async function upsertLegacyNewsItem(service: SupabaseClient, article: ArticleEditorRow) {
  const categories = cleanNewsCategories([article.category, article.region]);
  const payload = {
    title: article.title,
    summary: article.summary,
    analysis: article.analysis ?? article.original_content ?? article.summary ?? article.title,
    source_url: article.source_url,
    categories: categories.length > 0 ? categories : ["Mundo"],
    tags: Array.from(
      new Set([...(article.tags ?? []), ...((article.hashtags ?? []).map((item) => item.replace(/^#/, "").toLowerCase()))])
    ),
    cover_url: article.cover_image_url,
    publication_state: "published",
    published_at: new Date().toISOString()
  };

  const existing = await service.from("news_items").select("id").eq("source_url", article.source_url).limit(1).maybeSingle();
  if (!existing.error && existing.data?.id) {
    const update = await service.from("news_items").update(payload).eq("id", existing.data.id).select("id").limit(1).maybeSingle();
    if (update.error) throw new Error(update.error.message);
    return update.data?.id as string;
  }

  const insert = await service.from("news_items").insert(payload).select("id").limit(1).maybeSingle();
  if (insert.error) throw new Error(insert.error.message);
  return insert.data?.id as string;
}

export async function publishArticle(service: SupabaseClient, articleId: string, actorId: string | null, pushNow = false) {
  const article = await getArticleEditorRow(service, articleId);

  const publishAt = new Date().toISOString();
  const { error } = await service
    .from("news_articles")
    .update({
      status: "published",
      published_at: publishAt,
      publish_at: publishAt,
      updated_by: actorId
    })
    .eq("id", articleId);

  if (error) throw new Error(error.message);

  const legacyId = await upsertLegacyNewsItem(service, article);
  await service.from("news_articles").update({ legacy_news_item_id: legacyId }).eq("id", articleId);

  if (pushNow) {
    await service.from("social_publications").insert({
      article_id: articleId,
      platform: "facebook",
      status: "queued",
      payload: {
        message: article.summary ?? article.title,
        title: article.title,
        link: `/noticias/${article.slug}`
      }
    });
  }

  return {
    articleId,
    legacyId,
    publishedAt: publishAt
  };
}

export async function rewriteArticle(service: SupabaseClient, articleId: string, actorId: string | null) {
  const article = await getArticleEditorRow(service, articleId);

  const rewrite = await rewriteSinPelos({
    title: article.title,
    summary: article.summary ?? article.excerpt ?? "",
    body: article.original_content ?? article.analysis ?? article.summary ?? article.title,
    sourceName: article.source_name ?? "Sin Pelos",
    sourceUrl: article.source_url ?? ""
  });

  const reel = await generateReelScript({
    title: rewrite.discoverTitle || rewrite.seoTitle,
    summary: rewrite.summary
  });

  const updatePayload = {
    title: rewrite.discoverTitle || rewrite.seoTitle,
    summary: rewrite.summary,
    analysis: rewrite.analysis,
    excerpt: rewrite.excerpt,
    rewritten_content: rewrite.rewrittenBody,
    reel_script: `${reel.hook}\n- ${reel.bullets.join("\n- ")}\n${reel.close}`,
    category: rewrite.category,
    region: rewrite.region,
    tags: rewrite.tags,
    hashtags: [],
    seo: {
      title: rewrite.seoTitle,
      description: rewrite.summary
    },
    social: {
      facebook: rewrite.facebookPost,
      comments_hook: rewrite.commentsHook,
      push_text: rewrite.pushText,
      poll_question: rewrite.pollQuestion
    },
    updated_by: actorId,
    status: article.status === "draft" ? "pending_review" : article.status
  };

  const { error } = await service.from("news_articles").update(updatePayload).eq("id", articleId);
  if (error) throw new Error(error.message);

  return {
    articleId,
    rewrite
  };
}

export async function generateArticleAssets(service: SupabaseClient, articleId: string, actorId: string | null) {
  const article = await getArticleEditorRow(service, articleId);

  const cover = generateSpmNewsImage({
    title: article.title,
    summary: article.summary ?? article.category ?? "SPM Noticias",
    category: article.category,
    region: article.region,
    sourceName: article.source_name,
    originalImageUrl: article.featured_image_url ?? article.cover_image_url
  });
  const meme = buildMemeTemplate({ top: article.title.slice(0, 60), bottom: article.summary ?? "Sin filtro" });
  const quote = buildQuoteCard({ quote: article.summary ?? article.title, author: "SPM News" });
  const thumb = buildThumbnail({ title: article.title, subtitle: article.summary ?? "SPM" });

  const assets = [
    { type: "cover", url: cover.imageUrl, meta: { format: "svg", width: cover.width, height: cover.height, prompt: cover.prompt, file_name: cover.fileName } },
    { type: "meme", url: meme.dataUrl, meta: { format: "svg", width: meme.width, height: meme.height } },
    { type: "quote_card", url: quote.dataUrl, meta: { format: "svg", width: quote.width, height: quote.height } },
    { type: "reel_thumbnail", url: thumb.dataUrl, meta: { format: "svg", width: thumb.width, height: thumb.height } }
  ];

  const { error: assetError } = await service.from("news_assets").insert(
    assets.map((asset) => ({
      article_id: articleId,
      asset_type: asset.type,
      url: asset.url,
      meta: {
        ...asset.meta,
        generated_by: actorId,
        generated_at: new Date().toISOString()
      }
    }))
  );

  if (assetError) throw new Error(assetError.message);

  const { error: articleError } = await service
    .from("news_articles")
    .update({
      cover_image_url: cover.imageUrl,
      meme_image_url: meme.dataUrl,
      quote_card_url: quote.dataUrl,
      ai_metadata: {
        ...(article.ai_metadata ?? {}),
        cover: {
          ...((article.ai_metadata as any)?.cover ?? {}),
          prompt: cover.prompt,
          file_name: cover.fileName,
          headline: cover.headline,
          subtitle: cover.subtitle,
          visual_brief: cover.visualBrief,
          layout: "spm_news_v1",
          used_original_image: cover.usedOriginalImage
        }
      },
      updated_by: actorId
    })
    .eq("id", articleId);

  if (articleError) throw new Error(articleError.message);

  return {
    articleId,
    assets
  };
}

export async function deleteArticle(service: SupabaseClient, articleId: string) {
  const article = await service
    .from("news_articles")
    .select("id, legacy_news_item_id")
    .eq("id", articleId)
    .limit(1)
    .maybeSingle();

  if (article.error) throw new Error(article.error.message);
  if (!article.data?.id) throw new Error("Artículo no encontrado.");

  const legacyId = String((article.data as any).legacy_news_item_id ?? "").trim();
  const del = await service.from("news_articles").delete().eq("id", articleId);
  if (del.error) throw new Error(del.error.message);

  if (legacyId) {
    try {
      await service.from("news_items").delete().eq("id", legacyId);
    } catch {
      // no-op
    }
  }

  return { articleId, legacyId: legacyId || null };
}

export async function cleanupStaleDraftArticles(service: SupabaseClient, olderThanHours = 48) {
  const safeHours = Number.isFinite(olderThanHours) ? Math.max(1, Math.min(24 * 14, Math.floor(olderThanHours))) : 48;
  const cutoffIso = new Date(Date.now() - safeHours * 60 * 60 * 1000).toISOString();

  const staleRes = await service
    .from("news_articles")
    .select("id, legacy_news_item_id, title, status, created_at, created_by, source_id, author_name")
    .in("status", ["draft", "pending_review", "rejected"])
    .lt("created_at", cutoffIso)
    .order("created_at", { ascending: true })
    .limit(200);

  if (staleRes.error) throw new Error(staleRes.error.message);

  const candidates = ((staleRes.data ?? []) as Array<any>).filter((row) => {
    const createdBy = String(row.created_by ?? "").trim();
    const sourceId = String(row.source_id ?? "").trim();
    const authorName = String(row.author_name ?? "").trim();
    return !createdBy || Boolean(sourceId) || authorName === "SPM News Engine";
  });

  const articleIds = candidates.map((row) => String(row.id ?? "")).filter(Boolean);
  const legacyIds = Array.from(
    new Set(candidates.map((row) => String(row.legacy_news_item_id ?? "")).filter(Boolean))
  );

  if (!articleIds.length) {
    return {
      deleted: 0,
      legacyDeleted: 0,
      cutoffHours: safeHours,
      cutoffIso,
      titles: [] as string[]
    };
  }

  const articleDelete = await service.from("news_articles").delete().in("id", articleIds);
  if (articleDelete.error) throw new Error(articleDelete.error.message);

  let legacyDeleted = 0;
  if (legacyIds.length) {
    const legacyDelete = await service.from("news_items").delete().in("id", legacyIds);
    if (legacyDelete.error) throw new Error(legacyDelete.error.message);
    legacyDeleted = legacyIds.length;
  }

  return {
    deleted: articleIds.length,
    legacyDeleted,
    cutoffHours: safeHours,
    cutoffIso,
    titles: candidates.map((row) => String(row.title ?? "").trim()).filter(Boolean)
  };
}

export async function generateArticlePoll(service: SupabaseClient, articleId: string) {
  const article = await getArticleEditorRow(service, articleId);
  const poll = await generatePollFromArticle({
    title: article.title,
    summary: article.summary ?? article.excerpt ?? article.title
  });

  const insertPoll = await service
    .from("article_polls")
    .insert({ article_id: articleId, question: poll.question, active: true })
    .select("id")
    .limit(1)
    .maybeSingle();

  if (insertPoll.error) throw new Error(insertPoll.error.message);
  const pollId = String(insertPoll.data?.id ?? "");
  if (!pollId) throw new Error("No se pudo crear poll.");

  const { error: optionsError } = await service.from("article_poll_options").insert(
    poll.options.map((label, index) => ({
      poll_id: pollId,
      label,
      sort_order: index
    }))
  );

  if (optionsError) throw new Error(optionsError.message);

  return {
    articleId,
    pollId,
    question: poll.question,
    options: poll.options
  };
}

export async function queueArticleSocial(service: SupabaseClient, articleId: string, platforms: string[]) {
  const article = await getArticleEditorRow(service, articleId);

  const copy = await generateSocialCopy({
    title: article.title,
    summary: article.summary ?? article.excerpt ?? article.title,
    url: `/noticias/${article.slug}`
  });

  const available = new Set(asStringArray(platforms, 6, 20).map((x) => x.toLowerCase()));
  const finalPlatforms = available.size ? Array.from(available) : ["facebook", "instagram", "x", "tiktok"];

  const payloads = finalPlatforms.map((platform) => ({
    article_id: articleId,
    platform,
    status: "queued",
    payload: {
      link: `/noticias/${article.slug}`,
      message:
        platform === "facebook"
          ? copy.facebook
          : platform === "instagram"
            ? copy.instagram
            : platform === "x"
              ? copy.x
              : copy.tiktok
    }
  }));

  const { error } = await service.from("social_publications").insert(payloads);
  if (error) throw new Error(error.message);

  return {
    articleId,
    queued: payloads.length
  };
}

export async function saveArticleSocialDrafts(
  service: SupabaseClient,
  articleId: string,
  drafts: ArticleSocialDraftInput[]
) {
  const article = await getArticleEditorRow(service, articleId);
  const normalizedDrafts = drafts
    .map((draft) => {
      const platform = asString(draft.platform, 20).toLowerCase() as SupportedSocialPlatform;
      const message = asString(draft.message, 600);
      const publishAs = asString(draft.publishAs, 16).toLowerCase();

      if (!SUPPORTED_SOCIAL_PLATFORMS.includes(platform)) return null;
      if (!message) return null;

      return {
        platform,
        message,
        publishAs: platform === "instagram" && publishAs === "story" ? "story" : "feed"
      };
    })
    .filter(Boolean) as Array<{ platform: SupportedSocialPlatform; message: string; publishAs: "feed" | "story" }>;

  const deduped = new Map<SupportedSocialPlatform, { platform: SupportedSocialPlatform; message: string; publishAs: "feed" | "story" }>();
  for (const draft of normalizedDrafts) deduped.set(draft.platform, draft);

  const finalDrafts = Array.from(deduped.values());
  if (!finalDrafts.length) throw new Error("No hay drafts sociales válidos.");

  const { data: existing, error: existingError } = await service
    .from("social_publications")
    .select("id, platform, status, payload, created_at")
    .eq("article_id", articleId)
    .in("platform", finalDrafts.map((draft) => draft.platform))
    .order("created_at", { ascending: false });

  if (existingError) throw new Error(existingError.message);

  const reusableByPlatform = new Map<SupportedSocialPlatform, { id: string; payload: Record<string, unknown> | null }>();
  for (const row of existing ?? []) {
    const platform = asString((row as any).platform, 20).toLowerCase() as SupportedSocialPlatform;
    if (!SUPPORTED_SOCIAL_PLATFORMS.includes(platform)) continue;
    if (String((row as any).status ?? "") === "published") continue;
    if (!reusableByPlatform.has(platform)) {
      reusableByPlatform.set(platform, {
        id: String((row as any).id ?? ""),
        payload: typeof (row as any).payload === "object" && (row as any).payload ? ((row as any).payload as Record<string, unknown>) : null
      });
    }
  }

  const publicationIds: string[] = [];

  for (const draft of finalDrafts) {
    const reusable = reusableByPlatform.get(draft.platform);
    const payload = {
      ...(reusable?.payload ?? {}),
      link: `/noticias/${article.slug}`,
      message: draft.message,
      ...(draft.platform === "instagram" ? { publishAs: draft.publishAs } : {})
    };

    if (reusable?.id) {
      const { error } = await service
        .from("social_publications")
        .update({
          status: "queued",
          external_id: null,
          payload,
          response: {},
          published_at: null
        })
        .eq("id", reusable.id);
      if (error) throw new Error(error.message);
      publicationIds.push(reusable.id);
      continue;
    }

    const { data, error } = await service
      .from("social_publications")
      .insert({
        article_id: articleId,
        platform: draft.platform,
        status: "queued",
        payload
      })
      .select("id")
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data?.id) publicationIds.push(String(data.id));
  }

  const { data: publications, error: publicationsError } = await service
    .from("social_publications")
    .select("id, platform, status, external_id, payload, published_at, created_at")
    .in("id", publicationIds)
    .order("created_at", { ascending: false });

  if (publicationsError) throw new Error(publicationsError.message);

  return {
    articleId,
    publicationIds,
    publications: (publications ?? []).map((row: any) => ({
      id: String(row.id),
      platform: asString(row.platform, 20).toLowerCase(),
      status: asString(row.status, 20).toLowerCase(),
      externalId: asOptionalString(row.external_id, 180),
      message: asString(row.payload?.message, 600),
      publishAs: asString(row.payload?.publishAs, 16).toLowerCase() === "story" ? "story" : "feed",
      publishedAt: asOptionalString(row.published_at, 60)
    }))
  };
}

export async function rescorePublishedArticles(service: SupabaseClient, limit = 300) {
  const { data, error } = await service
    .from("news_articles")
    .select("id")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  let updated = 0;

  for (const row of data ?? []) {
    const rpc = await service.rpc("compute_article_viral_score", { p_article_id: (row as any).id });
    if (rpc.error) continue;

    const score = Number(rpc.data ?? 0);
    const patch = await service
      .from("news_articles")
      .update({
        engagement_score: score,
        trending_score: score
      })
      .eq("id", (row as any).id);

    if (!patch.error) updated += 1;
  }

  return { updated };
}
