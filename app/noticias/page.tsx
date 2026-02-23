import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ShareButtons } from "@/components/ShareButtons";
import { supabaseServer } from "@/lib/supabaseServer";
import { newsCategories } from "@/lib/newsCategories";
import { ui } from "@/lib/i18n";
import { getServerLang } from "@/lib/i18nServer";
import { MidContentAdSlot } from "@/components/promotions/MidContentAdSlot";

export const revalidate = 300;

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
      .select("id, title, summary, published_at, cover_url, categories")
      .eq("publication_state", "published")
      .order("published_at", { ascending: false })
      .limit(120);
    if (category) q = q.contains("categories", [category]);
    let { data: rankedBase, error: rankedErr } = await q;
    if (rankedErr && /publication_state/i.test(rankedErr.message)) {
      let fallback = supabase
        .from("news_items")
        .select("id, title, summary, published_at, cover_url, categories")
        .order("published_at", { ascending: false })
        .limit(120);
      if (category) fallback = fallback.contains("categories", [category]);
      const r = await fallback;
      rankedBase = r.data;
      rankedErr = r.error;
    }
    if (rankedErr) rankedBase = [];
    const ranked = rankedBase ?? [];
    const ids = ranked.map((item) => item.id);
    const { data: comments } = await supabase
      .from("comments")
      .select("id, content_id")
      .eq("content_type", "news")
      .in("content_id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]);

    const counts = new Map<string, number>();
    (comments ?? []).forEach((c) => counts.set(c.content_id, (counts.get(c.content_id) ?? 0) + 1));
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
      .select("id, title, summary, published_at, cover_url, categories")
      .eq("publication_state", "published")
      .order("published_at", { ascending: false })
      .range(start, end);
    if (category) query = query.contains("categories", [category]);
    let { data, error } = await query;
    if (error && /publication_state/i.test(error.message)) {
      let fallback = supabase
        .from("news_items")
        .select("id, title, summary, published_at, cover_url, categories")
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

  return (
    <main>
      <Navbar />
      <section className="section">
        <div className="container">
          <h1 className="section-title">Noticias Sin Pelos</h1>
          <p className="muted">{t.news.subtitle}</p>

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

          {items.length > 0 ? (
            <div style={{ display: "grid", gap: 14, marginTop: 20 }}>
              {items.map((item, idx) => (
                <div key={item.id} style={{ display: "contents" }}>
                  {idx === 3 ? <MidContentAdSlot /> : null}
                  <div className={item.cover_url ? "card news-item-card" : "card"}>
                  {item.cover_url ? (
                    <Link href={`/noticias/${item.id}`}>
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
                      <Link href={`/noticias/${item.id}`}>
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
                      <Link className="button secondary" href={`/noticias/${item.id}`}>
                        {t.common.read}
                      </Link>
                      <ShareButtons path={`/noticias/${item.id}`} text={item.title} />
                    </div>
                  </div>
                  </div>
                </div>
              ))}
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
    </main>
  );
}
