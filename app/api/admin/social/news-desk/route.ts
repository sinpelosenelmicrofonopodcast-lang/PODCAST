import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/adminAuth";

type SocialDraft = {
  id: string;
  platform: "facebook" | "instagram" | "x" | "tiktok";
  status: string;
  externalId: string | null;
  message: string;
  publishAs: "feed" | "story";
  publishedAt: string | null;
};

type NewsDeskCard = {
  id: string;
  title: string;
  slug: string;
  status: string;
  sourceName: string | null;
  sourceUrl: string | null;
  category: string | null;
  region: string | null;
  summary: string | null;
  analysis: string | null;
  excerpt: string | null;
  tags: string[];
  hashtags: string[];
  coverImageUrl: string | null;
  publishAt: string | null;
  publishedAt: string | null;
  createdAt: string | null;
  trendingScore: number;
  discoverScore: number;
  impactScore: number;
  qualityScore: number;
  qualityReasons: string[];
  coverPrompt: string | null;
  coverFileName: string | null;
  coverHeadline: string | null;
  coverSubtitle: string | null;
  socialDrafts: SocialDraft[];
};

function normalizeText(value?: string | null) {
  return String(value ?? "").trim();
}

export async function GET(request: NextRequest) {
  const auth = await requireStaffApi(request, "manage_news");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const statusFilter = String(request.nextUrl.searchParams.get("status") ?? "drafts").trim().toLowerCase();
    const hoursRaw = Number(request.nextUrl.searchParams.get("hours") ?? "48");
    const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "24");
    const hours = Number.isFinite(hoursRaw) ? Math.max(1, Math.min(24 * 14, Math.floor(hoursRaw))) : 48;
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(60, Math.floor(limitRaw))) : 24;
    const cutoffIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    let query = auth.service
      .from("news_articles")
      .select(
        "id, title, slug, status, source_name, source_url, category, region, summary, analysis, excerpt, cover_image_url, tags, hashtags, ai_metadata, published_at, publish_at, created_at, trending_score, discover_score, impact_score"
      )
      .order(statusFilter === "published" ? "published_at" : "created_at", { ascending: false })
      .limit(limit);

    if (statusFilter === "published") {
      query = query.eq("status", "published").gte("published_at", cutoffIso);
    } else if (statusFilter === "all") {
      query = query.gte("created_at", cutoffIso);
    } else {
      query = query.in("status", ["draft", "pending_review"]).gte("created_at", cutoffIso);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    const articleIds = (data ?? []).map((row: any) => String(row.id ?? "")).filter(Boolean);
    const socialRes = articleIds.length
      ? await auth.service
          .from("social_publications")
          .select("id, article_id, platform, status, external_id, payload, published_at, created_at")
          .in("article_id", articleIds)
          .order("created_at", { ascending: false })
      : { data: [], error: null };

    if (socialRes.error) return NextResponse.json({ ok: false, error: socialRes.error.message }, { status: 400 });

    const latestSocialByArticle = new Map<string, Map<string, any>>();
    for (const row of socialRes.data ?? []) {
      const articleId = String((row as any).article_id ?? "");
      const platform = String((row as any).platform ?? "").toLowerCase();
      if (!articleId || !platform) continue;
      const current = latestSocialByArticle.get(articleId) ?? new Map<string, any>();
      if (!current.has(platform)) current.set(platform, row);
      latestSocialByArticle.set(articleId, current);
    }

    const cards: NewsDeskCard[] = (data ?? []).map((item: any) => ({
      id: String(item.id),
      title: String(item.title ?? ""),
      slug: String(item.slug ?? ""),
      status: String(item.status ?? "draft"),
      sourceName: item.source_name ? String(item.source_name) : normalizeText(item?.ai_metadata?.source) || null,
      sourceUrl: item.source_url ? String(item.source_url) : null,
      category: item.category ? String(item.category) : null,
      region: item.region ? String(item.region) : null,
      summary: item.summary ? String(item.summary) : null,
      analysis: item.analysis ? String(item.analysis) : item.excerpt ? String(item.excerpt) : null,
      excerpt: item.excerpt ? String(item.excerpt) : null,
      tags: Array.isArray(item.tags) ? item.tags.map((value: unknown) => String(value)) : [],
      hashtags: Array.isArray(item.hashtags) ? item.hashtags.map((value: unknown) => String(value)) : [],
      coverImageUrl: item.cover_image_url ? String(item.cover_image_url) : null,
      publishAt: item.publish_at ? String(item.publish_at) : null,
      publishedAt: item.published_at ? String(item.published_at) : null,
      createdAt: item.created_at ? String(item.created_at) : null,
      trendingScore: Number(item.trending_score ?? 0),
      discoverScore: Number(item.discover_score ?? 0),
      impactScore: Number(item.impact_score ?? item.discover_score ?? 0),
      qualityScore: Number(item?.ai_metadata?.quality?.score ?? item.impact_score ?? item.discover_score ?? 0),
      qualityReasons: Array.isArray(item?.ai_metadata?.quality?.review_reasons)
        ? item.ai_metadata.quality.review_reasons.map((reason: unknown) => String(reason))
        : Array.isArray(item?.ai_metadata?.impact_reasons)
          ? item.ai_metadata.impact_reasons.map((reason: unknown) => String(reason))
          : [],
      coverPrompt: normalizeText(item?.ai_metadata?.cover?.prompt) || null,
      coverFileName: normalizeText(item?.ai_metadata?.cover?.file_name) || null,
      coverHeadline: normalizeText(item?.ai_metadata?.cover?.headline) || null,
      coverSubtitle: normalizeText(item?.ai_metadata?.cover?.subtitle) || null,
      socialDrafts: Array.from(latestSocialByArticle.get(String(item.id))?.values() ?? []).map((publication: any) => ({
        id: String(publication.id),
        platform: String(publication.platform ?? "").toLowerCase() as "facebook" | "instagram" | "x" | "tiktok",
        status: String(publication.status ?? "queued"),
        externalId: publication.external_id ? String(publication.external_id) : null,
        message: String(publication.payload?.message ?? ""),
        publishAs: String(publication.payload?.publishAs ?? "").toLowerCase() === "story" ? "story" : "feed",
        publishedAt: publication.published_at ? String(publication.published_at) : null
      }))
    }));

    const summary = {
      total: cards.length,
      drafts: cards.filter((item) => item.status === "draft").length,
      pendingReview: cards.filter((item) => item.status === "pending_review").length,
      published: cards.filter((item) => item.status === "published").length,
      cutoffHours: hours,
      cutoffIso
    };

    return NextResponse.json({ ok: true, cards, summary });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unknown error" }, { status: 500 });
  }
}
