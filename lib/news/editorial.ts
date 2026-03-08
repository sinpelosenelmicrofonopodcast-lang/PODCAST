import type { SupabaseClient } from "@supabase/supabase-js";
import { rewriteSinPelos } from "@/lib/ai/rewrite-sin-pelos";
import { generatePollFromArticle } from "@/lib/ai/generate-poll";
import { generateSocialCopy } from "@/lib/ai/generate-social-copy";
import { generateReelScript } from "@/lib/ai/generate-reel-script";
import { buildSpmCoverTemplate } from "@/lib/images/spm-cover-template";
import { buildMemeTemplate } from "@/lib/images/meme-template";
import { buildQuoteCard } from "@/lib/images/quote-card";
import { buildThumbnail } from "@/lib/images/thumbnail";
import { asString, asStringArray, isUuid, parseDate } from "@/lib/validations/common";

export type ArticleEditorRow = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  excerpt: string | null;
  original_content: string | null;
  cover_image_url: string | null;
  category: string | null;
  region: string | null;
  tags: string[] | null;
  status: string;
  published_at: string | null;
  source_url: string | null;
};

export async function getArticleEditorRow(service: SupabaseClient, articleId: string) {
  if (!isUuid(articleId)) throw new Error("articleId inválido.");

  const { data, error } = await service
    .from("news_articles")
    .select(
      "id, slug, title, summary, excerpt, original_content, cover_image_url, category, region, tags, status, published_at, source_url"
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

async function upsertLegacyNewsItem(service: SupabaseClient, article: ArticleEditorRow) {
  const payload = {
    title: article.title,
    summary: article.summary,
    analysis: article.original_content ?? article.summary ?? article.title,
    source_url: article.source_url,
    categories: [article.category ?? "Noticias", article.region ?? "Mundo"],
    tags: article.tags ?? [],
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
    body: article.original_content ?? article.summary ?? article.title,
    sourceName: "Sin Pelos",
    sourceUrl: article.source_url ?? ""
  });

  const reel = await generateReelScript({
    title: rewrite.discoverTitle || rewrite.seoTitle,
    summary: rewrite.summary
  });

  const updatePayload = {
    title: rewrite.discoverTitle || rewrite.seoTitle,
    summary: rewrite.summary,
    excerpt: rewrite.excerpt,
    rewritten_content: rewrite.rewrittenBody,
    reel_script: `${reel.hook}\n- ${reel.bullets.join("\n- ")}\n${reel.close}`,
    category: rewrite.category,
    region: rewrite.region,
    tags: rewrite.tags,
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

  const cover = buildSpmCoverTemplate({ title: article.title });
  const meme = buildMemeTemplate({ top: article.title.slice(0, 60), bottom: article.summary ?? "Sin filtro" });
  const quote = buildQuoteCard({ quote: article.summary ?? article.title, author: "SPM News" });
  const thumb = buildThumbnail({ title: article.title, subtitle: article.summary ?? "SPM" });

  const assets = [
    { type: "cover", url: cover.dataUrl, meta: { format: "svg", width: cover.width, height: cover.height } },
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
      cover_image_url: cover.dataUrl,
      meme_image_url: meme.dataUrl,
      quote_card_url: quote.dataUrl,
      updated_by: actorId
    })
    .eq("id", articleId);

  if (articleError) throw new Error(articleError.message);

  return {
    articleId,
    assets
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
