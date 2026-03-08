import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ShareButtons } from "@/components/ShareButtons";
import { supabaseServer } from "@/lib/supabaseServer";
import { newsCategories } from "@/lib/newsCategories";
import { ui } from "@/lib/i18n";
import { getServerLang } from "@/lib/i18nServer";
import { MidContentAdSlot } from "@/components/promotions/MidContentAdSlot";
import { DesktopSideAdSlot } from "@/components/promotions/DesktopSideAdSlot";
import { extractNewsPathSegment, extractNewsPathSegmentFromUrl, newsHref } from "@/lib/newsRoute";
import { buildSeoMetadata } from "@/lib/seo/meta";
import { jsonLdScript } from "@/lib/seo/jsonld";

export const revalidate = 300;

export const metadata: Metadata = buildSeoMetadata({
  title: "Noticias Sin Pelos | Puerto Rico, Texas, USA y Mundo",
  description:
    "Noticias analizadas sin filtro. Cobertura en Puerto Rico, Texas, USA y Mundo con enfoque editorial de Sin Pelos.",
  path: "/noticias"
});

type NewsItem = {
  id: string;
  slug?: string | null;
  title: string;
  summary: string | null;
  published_at: string | null;
  cover_url: string | null;
  categories: string[] | null;
};

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const id = String(item.id ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
}

export default async function NoticiasPage({ searchParams }: { searchParams: { cat?: string; sort?: string; page?: string } }) {
  const supabase = supabaseServer();
  const lang = getServerLang();
  const t = ui[lang];
  const category = searchParams?.cat;
  const sort = searchParams?.sort ?? "latest";
  const pageNumRaw = Number(searchParams?.page ?? "1");
  const pageNum = Number.isFinite(pageNumRaw) ? Math.max(1, Math.floor(pageNumRaw)) : 1;
  const perPage = 12;

  let items: any[] = [];
  let total = 0;
  let totalPages = 1;

  if (sort === "comments") {
    // Ranking by comments over a bounded window (latest 120) to keep response fast.
    let q = supabase
      .from("news_items")
      .select("id, slug, title, summary, published_at, cover_url, categories")
      .eq("publication_state", "published")
      .order("published_at", { ascending: false })
      .limit(120);
    if (category) q = q.contains("categories", [category]);
    let { data: rankedBase, error: rankedErr } = await q;
    if (rankedErr && /publication_state/i.test(rankedErr.message)) {
      let fallback = supabase
        .from("news_items")
        .select("id, slug, title, summary, published_at, cover_url, categories")
        .order("published_at", { ascending: false })
        .limit(120);
      if (category) fallback = fallback.contains("categories", [category]);
      const r = await fallback;
      rankedBase = r.data;
      rankedErr = r.error;
    }
    if (rankedErr) rankedBase = [];
    const ranked = (rankedBase ?? []) as NewsItem[];
    const ids = ranked.map((item) => item.id);
    const { data: comments } = await supabase
      .from("comments")
      .select("id, content_id")
      .eq("content_type", "news")
      .in("content_id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]);

    const counts = new Map<string, number>();
    (comments ?? []).forEach((c) => {
      const contentId = String((c as any)?.content_id ?? "").trim();
      if (!contentId) return;
      counts.set(contentId, (counts.get(contentId) ?? 0) + 1);
    });
    const sorted = [...ranked].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));
    total = sorted.length;
    totalPages = Math.max(1, Math.ceil(total / perPage));
    const start = (pageNum - 1) * perPage;
    items = sorted.slice(start, start + perPage);
  } else {
    let countQuery = supabase.from("news_items").select("id", { count: "exact", head: true }).eq("publication_state", "published");
    if (category) countQuery = countQuery.contains("categories", [category]);
    let { count, error: countErr } = await countQuery;
    if (countErr && /publication_state/i.test(countErr.message)) {
      let fallbackCount = supabase.from("news_items").select("id", { count: "exact", head: true });
      if (category) fallbackCount = fallbackCount.contains("categories", [category]);
      const r = await fallbackCount;
      count = r.count;
      countErr = r.error;
    }
    if (countErr) count = 0;
    total = Number(count ?? 0);
    totalPages = Math.max(1, Math.ceil(total / perPage));

    const start = (pageNum - 1) * perPage;
    const end = start + perPage - 1;
    let query = supabase
      .from("news_items")
      .select("id, slug, title, summary, published_at, cover_url, categories")
      .eq("publication_state", "published")
      .order("published_at", { ascending: false })
      .range(start, end);
    if (category) query = query.contains("categories", [category]);
    let { data, error } = await query;
    if (error && /publication_state/i.test(error.message)) {
      let fallback = supabase
        .from("news_items")
        .select("id, slug, title, summary, published_at, cover_url, categories")
        .order("published_at", { ascending: false })
        .range(start, end);
      if (category) fallback = fallback.contains("categories", [category]);
      const r = await fallback;
      data = r.data;
      error = r.error;
    }
    if (error) data = [];
    items = data ?? [];
  }

  let trendingItems: any[] = [];
  {
    const trendingWindowStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    let q = supabase
      .from("news_items")
      .select("id, slug, title, summary, published_at, cover_url, categories")
      .eq("publication_state", "published")
      .order("published_at", { ascending: false })
      .limit(120);
    if (category) q = q.contains("categories", [category]);
    let { data: base, error } = await q;
    if (error && /publication_state/i.test(error.message)) {
      let fallback = supabase
        .from("news_items")
        .select("id, slug, title, summary, published_at, cover_url, categories")
        .order("published_at", { ascending: false })
        .limit(120);
      if (category) fallback = fallback.contains("categories", [category]);
      const r = await fallback;
      base = r.data;
      error = r.error;
    }
    if (error) base = [];
    const ranked = (base ?? []) as NewsItem[];
    const ids = ranked.map((item) => item.id);
    const keyToId = new Map<string, string>();
    ranked.forEach((item) => {
      keyToId.set(item.id, item.id);
      const slug = String(item.slug ?? "").trim();
      if (slug) keyToId.set(slug, item.id);
    });
    const { data: comments } = await supabase
      .from("comments")
      .select("id, content_id")
      .eq("content_type", "news")
      .in("content_id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const counts = new Map<string, number>();
    (comments ?? []).forEach((c) => {
      const contentId = String((c as any)?.content_id ?? "").trim();
      if (!contentId) return;
      counts.set(contentId, (counts.get(contentId) ?? 0) + 1);
    });

    // Views: real page visits for /noticias/:id within 30d.
    const viewCounts = new Map<string, number>();
    {
      let viewsQuery = supabase
        .from("page_visits")
        .select("path, visited_at")
        .gte("visited_at", trendingWindowStart)
        .like("path", "/noticias/%")
        .order("visited_at", { ascending: false })
        .limit(50000);
      const { data: pageVisits } = await viewsQuery;
      (pageVisits ?? []).forEach((row: any) => {
        const key = extractNewsPathSegment(row.path);
        const newsId = key ? keyToId.get(key) ?? null : null;
        if (!newsId) return;
        viewCounts.set(newsId, (viewCounts.get(newsId) ?? 0) + 1);
      });
    }

    // Shares: real social metrics.shares linked to noticia URL.
    const shareCounts = new Map<string, number>();
    {
      const { data: posts } = await supabase
        .from("external_posts")
        .select("source_url, metrics, posted_at")
        .gte("posted_at", trendingWindowStart)
        .like("source_url", "%/noticias/%")
        .order("posted_at", { ascending: false })
        .limit(5000);

      (posts ?? []).forEach((row: any) => {
        const key = extractNewsPathSegmentFromUrl(row.source_url);
        const newsId = key ? keyToId.get(key) ?? null : null;
        if (!newsId) return;
        const shares = Number(row?.metrics?.shares ?? 0);
        if (!Number.isFinite(shares) || shares <= 0) return;
        shareCounts.set(newsId, (shareCounts.get(newsId) ?? 0) + shares);
      });
    }

    const maxComments = Math.max(1, ...ids.map((id) => counts.get(id) ?? 0));
    const maxViews = Math.max(1, ...ids.map((id) => viewCounts.get(id) ?? 0));
    const maxShares = Math.max(1, ...ids.map((id) => shareCounts.get(id) ?? 0));

    const scoreOf = (id: string) => {
      const cNorm = (counts.get(id) ?? 0) / maxComments;
      const vNorm = (viewCounts.get(id) ?? 0) / maxViews;
      const sNorm = (shareCounts.get(id) ?? 0) / maxShares;
      return cNorm * 0.45 + sNorm * 0.35 + vNorm * 0.2;
    };

    trendingItems = [...ranked]
      .sort((a, b) => {
        const byScore = scoreOf(b.id) - scoreOf(a.id);
        if (Math.abs(byScore) > 0.0001) return byScore;
        return new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime();
      })
      .slice(0, 6)
      .map((item) => ({
        ...item,
        comments_count: counts.get(item.id) ?? 0,
        views_count: viewCounts.get(item.id) ?? 0,
        shares_count: shareCounts.get(item.id) ?? 0,
        trend_score: scoreOf(item.id)
      }));
  }

  let breakingItems: any[] = [];
  {
    let q = supabase
      .from("news_items")
      .select("id, slug, title")
      .eq("publication_state", "published")
      .order("published_at", { ascending: false })
      .limit(10);
    if (category) q = q.contains("categories", [category]);
    let { data, error } = await q;
    if (error && /publication_state/i.test(error.message)) {
      let fallback = supabase
        .from("news_items")
        .select("id, slug, title")
        .order("published_at", { ascending: false })
        .limit(10);
      if (category) fallback = fallback.contains("categories", [category]);
      const r = await fallback;
      data = r.data;
      error = r.error;
    }
    if (error) data = [];
    breakingItems = data ?? [];
  }

  const tabClass = (active: boolean) => (active ? "news-tab active" : "news-tab");
  const buildNewsHref = (nextSort: string) => ({
    pathname: "/noticias",
    query: {
      ...(category ? { cat: category } : {}),
      sort: nextSort,
      page: "1"
    }
  });
  const prevHref = {
    pathname: "/noticias",
    query: {
      ...(category ? { cat: category } : {}),
      sort,
      page: String(Math.max(1, pageNum - 1))
    }
  };
  const nextHref = {
    pathname: "/noticias",
    query: {
      ...(category ? { cat: category } : {}),
      sort,
      page: String(Math.min(totalPages, pageNum + 1))
    }
  };

  const pageItems = uniqueById(items);
  const lead = pageItems[0] ?? null;
  const sideItems = pageItems.slice(1, 5);
  const restItems = pageItems.slice(5);

  const usedInMain = new Set(pageItems.map((item) => item.id));
  const trendingUnique = uniqueById(trendingItems);
  const railFromTrending = trendingUnique.filter((item) => !usedInMain.has(item.id));
  const railItems = (railFromTrending.length > 0 ? railFromTrending : sideItems).slice(0, 5);
  const breakingUnique = uniqueById(breakingItems);
  const newsCollectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Noticias Sin Pelos",
    url: "https://www.sinpelosenelmicrofono.com/noticias",
    hasPart: pageItems.slice(0, 20).map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      url: `https://www.sinpelosenelmicrofono.com${newsHref(item)}`
    }))
  };

  return (
    <main>
      <Navbar />
      <DesktopSideAdSlot section="noticias" />
      <section className="section">
        <div className="container">
          <h1 className="section-title">Noticias Sin Pelos</h1>
          <p className="muted">{t.news.subtitle}</p>

          {breakingUnique.length > 0 ? (
            <div className="news-breaking card" aria-label="Breaking">
              <span className="news-breaking-label">Breaking</span>
              <div className="news-breaking-track">
                <div className="news-breaking-marquee">
                  {breakingUnique.map((item) => (
                    <Link key={`b1-${item.id}`} href={newsHref(item)} className="news-breaking-link">
                      {item.title}
                    </Link>
                  ))}
                </div>
                <div className="news-breaking-marquee" aria-hidden="true">
                  {breakingUnique.map((item) => (
                    <Link key={`b2-${item.id}`} href={newsHref(item)} className="news-breaking-link">
                      {item.title}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div className="news-tabs">
            <Link className={tabClass(!category)} href="/noticias">
              {t.news.all}
            </Link>
            {newsCategories.map((cat) => (
              <Link key={cat} className={tabClass(category === cat)} href={`/noticias?cat=${encodeURIComponent(cat)}&sort=${sort}`}>
                {cat}
              </Link>
            ))}
          </div>

          <div className="news-tabs" style={{ marginTop: 12 }}>
            <Link className={tabClass(sort === "all" || sort === "latest")} href={buildNewsHref("latest")}>
              {t.news.latest}
            </Link>
            <Link className={tabClass(sort === "comments")} href={buildNewsHref("comments")}>
              {t.news.mostCommented}
            </Link>
          </div>

          {pageItems.length > 0 ? (
            <div className="news-mag-shell">
              {lead ? (
                <div className="news-mag-top">
                  <article className="card news-mag-lead">
                    {lead.cover_url ? (
                      <Link href={newsHref(lead)} className="news-mag-lead-cover">
                        <img src={lead.cover_url} alt={lead.title} loading="eager" decoding="async" />
                      </Link>
                    ) : null}
                    <div className="news-mag-lead-body">
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {(lead.categories ?? []).slice(0, 3).map((cat: string) => (
                          <span key={cat} className="news-badge">
                            {cat}
                          </span>
                        ))}
                        <span className="muted" style={{ fontSize: 12 }}>
                          {new Date(lead.published_at).toLocaleDateString("es-PR")}
                        </span>
                      </div>
                      <Link href={newsHref(lead)}>
                        <h2 className="news-mag-lead-title">{lead.title}</h2>
                      </Link>
                      {lead.summary ? (
                        <p className="muted news-summary-clamp" style={{ margin: 0 }}>
                          {lead.summary}
                        </p>
                      ) : null}
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <Link className="button secondary" href={newsHref(lead)}>
                          {t.common.read}
                        </Link>
                        <ShareButtons path={newsHref(lead)} text={lead.title} />
                      </div>
                    </div>
                  </article>

                  <aside className="news-mag-rail news-mag-rail-sticky">
                    <div className="card news-mag-rail-head">
                      <h3 style={{ margin: 0 }}>Tendencias</h3>
                    </div>
                    {railItems.map((item, idx) => (
                      <div key={item.id} style={{ display: "contents" }}>
                        <article className="card news-mag-rail-item">
                          {item.cover_url ? (
                            <Link href={newsHref(item)} className="news-mag-rail-thumb">
                              <img src={item.cover_url} alt={item.title} loading="lazy" decoding="async" />
                            </Link>
                          ) : null}
                          <div>
                            <Link href={newsHref(item)}>
                              <h4 className="news-title-clamp" style={{ margin: 0 }}>
                                {item.title}
                              </h4>
                            </Link>
                            <p className="muted" style={{ margin: "6px 0 0", fontSize: 12 }}>
                              {new Date(item.published_at).toLocaleDateString("es-PR")}
                            </p>
                            {"comments_count" in item || "views_count" in item || "shares_count" in item ? (
                              <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>
                                {Number(item.comments_count ?? 0)} comentarios · {Number(item.views_count ?? 0)} views · {Number(item.shares_count ?? 0)} shares
                              </p>
                            ) : null}
                          </div>
                        </article>
                        {idx === 1 ? <MidContentAdSlot /> : null}
                      </div>
                    ))}
                  </aside>
                </div>
              ) : null}

              <div className="news-mag-grid">
                {restItems.map((item, idx) => (
                  <div key={item.id} style={{ display: "contents" }}>
                    {idx === 2 ? <MidContentAdSlot /> : null}
                    <article className={item.cover_url ? "card news-item-card" : "card"}>
                      {item.cover_url ? (
                        <Link href={newsHref(item)}>
                          <div className="news-cover-thumb">
                            <img src={item.cover_url} alt={item.title} loading="lazy" decoding="async" />
                          </div>
                        </Link>
                      ) : null}
                      <div style={{ display: "grid", gap: 8 }}>
                        <div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {(item.categories ?? []).map((cat: string) => (
                              <span key={cat} className="news-badge">
                                {cat}
                              </span>
                            ))}
                            <span className="muted" style={{ fontSize: 12 }}>
                              {new Date(item.published_at).toLocaleDateString("es-PR")}
                            </span>
                          </div>
                          <Link href={newsHref(item)}>
                            <h3 className="news-title-clamp" style={{ margin: "6px 0 0" }}>
                              {item.title}
                            </h3>
                          </Link>
                        </div>
                        {item.summary ? (
                          <p className="muted news-summary-clamp" style={{ margin: 0 }}>
                            {item.summary}
                          </p>
                        ) : null}
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <Link className="button secondary" href={newsHref(item)}>
                            {t.common.read}
                          </Link>
                          <ShareButtons path={newsHref(item)} text={item.title} />
                        </div>
                      </div>
                    </article>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card" style={{ marginTop: 20 }}>
              <p className="muted">{t.news.noneYet}</p>
            </div>
          )}

          {totalPages > 1 ? (
            <div style={{ display: "flex", gap: 10, justifyContent: "center", alignItems: "center", marginTop: 18 }}>
              <Link className="button secondary" href={prevHref} aria-disabled={pageNum <= 1}>
                Anterior
              </Link>
              <span className="muted" style={{ fontSize: 13 }}>
                Página {pageNum} de {totalPages}
              </span>
              <Link className="button secondary" href={nextHref} aria-disabled={pageNum >= totalPages}>
                Siguiente
              </Link>
            </div>
          ) : null}
        </div>
      </section>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(newsCollectionSchema) }} />
    </main>
  );
}
