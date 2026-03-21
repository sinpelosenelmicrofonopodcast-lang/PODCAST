import { requireStaffPageOrRedirect } from "@/lib/adminAuth";
import { supabaseService } from "@/lib/supabaseService";
import { NewsEngineArticleActions, type NewsEngineArticleCard } from "@/components/admin/NewsEngineArticleActions";

function getWindowStart(dateFilter: string) {
  const now = Date.now();
  if (dateFilter === "24h") return new Date(now - 24 * 60 * 60 * 1000).toISOString();
  if (dateFilter === "7d") return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  if (dateFilter === "30d") return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  return null;
}

export default async function AdminNewsEngineArticlesPage({
  searchParams
}: {
  searchParams: { category?: string; trending?: string; date?: string; status?: string };
}) {
  await requireStaffPageOrRedirect("/admin/news-engine/articles", "manage_news");
  const service = supabaseService();

  const categoryFilter = String(searchParams?.category ?? "").trim();
  const trendingFilter = String(searchParams?.trending ?? "all").trim();
  const dateFilter = String(searchParams?.date ?? "7d").trim();
  const statusFilter = String(searchParams?.status ?? "drafts").trim();
  const windowStart = getWindowStart(dateFilter);

  let query = service
    .from("news_articles")
    .select(
      "id, title, slug, status, source_name, source_url, category, region, summary, analysis, excerpt, cover_image_url, tags, hashtags, ai_metadata, published_at, publish_at, created_at, trending_score, discover_score, impact_score"
    )
    .order(trendingFilter === "high" ? "impact_score" : "created_at", { ascending: false })
    .limit(60);

  if (categoryFilter) query = query.eq("category", categoryFilter);
  if (windowStart) query = query.gte("created_at", windowStart);
  if (statusFilter === "drafts") query = query.in("status", ["draft", "pending_review"]);
  if (statusFilter === "published") query = query.eq("status", "published");
  if (trendingFilter === "high") query = query.gte("impact_score", 60);

  const { data, error } = await query;

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
    sourceName: item.source_name ? String(item.source_name) : String(item?.ai_metadata?.source ?? ""),
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
    qualityScore: Number(item?.ai_metadata?.quality?.score ?? item.impact_score ?? 0),
    qualityReasons: Array.isArray(item?.ai_metadata?.quality?.review_reasons)
      ? item.ai_metadata.quality.review_reasons.map((reason: unknown) => String(reason))
      : Array.isArray(item?.ai_metadata?.impact_reasons)
        ? item.ai_metadata.impact_reasons.map((reason: unknown) => String(reason))
        : [],
    coverPrompt: String(item?.ai_metadata?.cover?.prompt ?? "") || null,
    coverFileName: String(item?.ai_metadata?.cover?.file_name ?? "") || null,
    coverHeadline: String(item?.ai_metadata?.cover?.headline ?? "") || null,
    coverSubtitle: String(item?.ai_metadata?.cover?.subtitle ?? "") || null,
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
      <div className="card" style={{ display: "grid", gap: 12 }}>
        <div>
          <h1 className="section-title" style={{ margin: 0 }}>
            SPM News Control Panel
          </h1>
          <p className="muted" style={{ margin: "8px 0 0" }}>
            Drafts automáticos de alto impacto con preview completo, edición inline y publicación en un click.
          </p>
        </div>

        <form className="news-engine-filter-bar">
          <label>
            Categoría
            <select className="input" name="category" defaultValue={categoryFilter}>
              <option value="">Todas</option>
              <option value="PR">PR</option>
              <option value="TX">TX</option>
              <option value="USA">USA</option>
              <option value="Mundo">Mundo</option>
              <option value="Crimen">Crimen</option>
              <option value="Politica">Politica</option>
            </select>
          </label>
          <label>
            Trending
            <select className="input" name="trending" defaultValue={trendingFilter}>
              <option value="all">Todos</option>
              <option value="high">Solo alto impacto</option>
            </select>
          </label>
          <label>
            Fecha
            <select className="input" name="date" defaultValue={dateFilter}>
              <option value="24h">24 horas</option>
              <option value="7d">7 días</option>
              <option value="30d">30 días</option>
              <option value="all">Todo</option>
            </select>
          </label>
          <label>
            Estado
            <select className="input" name="status" defaultValue={statusFilter}>
              <option value="drafts">Drafts</option>
              <option value="published">Published</option>
              <option value="all">Todos</option>
            </select>
          </label>
          <button className="button" type="submit">
            Filtrar
          </button>
        </form>

        <div className="news-engine-article-meta">
          <span className="news-engine-pill">{cards.length} resultados</span>
          <span className="news-engine-pill">
            {cards.filter((item) => item.status === "draft" || item.status === "pending_review").length} drafts listos
          </span>
          <span className="news-engine-pill">{cards.filter((item) => item.impactScore >= 60).length} alto impacto</span>
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
