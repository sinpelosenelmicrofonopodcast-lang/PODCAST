import { requireStaffPageOrRedirect } from "@/lib/adminAuth";
import { supabaseService } from "@/lib/supabaseService";
import { NewsEngineArticleActions, type NewsEngineArticleCard } from "@/components/admin/NewsEngineArticleActions";

export default async function AdminNewsEngineArticlesPage() {
  await requireStaffPageOrRedirect("/admin/news-engine/articles", "manage_news");
  const service = supabaseService();

  const { data, error } = await service
    .from("news_articles")
    .select("id, title, slug, status, category, region, summary, excerpt, cover_image_url, ai_metadata, published_at, publish_at, trending_score, discover_score")
    .order("created_at", { ascending: false })
    .limit(40);

  const articleIds = (data ?? []).map((item: any) => String(item.id ?? ""));
  const socialRes = articleIds.length
    ? await service
        .from("social_publications")
        .select("id, article_id, platform, status, external_id, payload, published_at, created_at")
        .in("article_id", articleIds)
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  const latestSocialByArticle = new Map<string, Map<string, any>>();
  for (const row of socialRes.data ?? []) {
    const articleId = String((row as any).article_id ?? "");
    const platform = String((row as any).platform ?? "").toLowerCase();
    if (!articleId || !platform) continue;
    const current = latestSocialByArticle.get(articleId) ?? new Map<string, any>();
    if (!current.has(platform)) current.set(platform, row);
    latestSocialByArticle.set(articleId, current);
  }

  const cards: NewsEngineArticleCard[] = (data ?? []).map((item: any) => ({
    id: String(item.id),
    title: String(item.title ?? ""),
    slug: String(item.slug ?? ""),
    status: String(item.status ?? "draft"),
    category: item.category ? String(item.category) : null,
    region: item.region ? String(item.region) : null,
    summary: item.summary ? String(item.summary) : null,
    excerpt: item.excerpt ? String(item.excerpt) : null,
    coverImageUrl: item.cover_image_url ? String(item.cover_image_url) : null,
    publishAt: item.publish_at ? String(item.publish_at) : null,
    publishedAt: item.published_at ? String(item.published_at) : null,
    trendingScore: Number(item.trending_score ?? 0),
    discoverScore: Number(item.discover_score ?? 0),
    qualityScore: Number(item?.ai_metadata?.quality?.score ?? 0),
    qualityReasons: Array.isArray(item?.ai_metadata?.quality?.review_reasons)
      ? item.ai_metadata.quality.review_reasons.map((reason: unknown) => String(reason))
      : [],
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

  return (
    <main>
      <div className="card" style={{ display: "grid", gap: 10 }}>
        <h1 className="section-title" style={{ margin: 0 }}>
          News Engine · Artículos
        </h1>
        <p className="muted" style={{ margin: 0 }}>
          Edición editorial y redes desde una sola tarjeta, sin saltar entre pantallas.
        </p>
        <div className="news-engine-article-meta">
          <span className="news-engine-pill">{cards.length} artículos recientes</span>
          <span className="news-engine-pill">
            {(cards.filter((item) => item.status === "published").length).toString()} publicados
          </span>
          <span className="news-engine-pill">
            {(cards.filter((item) => item.socialDrafts.some((draft) => draft.status === "queued")).length).toString()} con cola social
          </span>
        </div>
      </div>

      {error ? <div className="card"><p className="muted">{error.message}</p></div> : null}
      {socialRes.error ? <div className="card"><p className="muted">{socialRes.error.message}</p></div> : null}

      <div className="list" style={{ marginTop: 14 }}>
        {cards.map((item) => (
          <NewsEngineArticleActions key={item.id} article={item} />
        ))}
      </div>
    </main>
  );
}
