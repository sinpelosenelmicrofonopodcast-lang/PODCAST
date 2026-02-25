import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ShareButtons } from "@/components/ShareButtons";
import { MidContentAdSlot } from "@/components/promotions/MidContentAdSlot";
import { NewsletterForm } from "@/components/newsletter/NewsletterForm";
import { supabaseServer } from "@/lib/supabaseServer";
import { clampMetaDescription, estimateReadingTimeMinutes } from "@/lib/blogSeo";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 300;

type BlogPost = {
  id: string;
  slug?: string | null;
  title: string;
  excerpt: string | null;
  meta_description?: string | null;
  cover_url: string | null;
  created_at: string | null;
  reading_time_minutes?: number | null;
  categories?: string[] | null;
  tags?: string[] | null;
};

function postHref(post: { id: string; slug?: string | null }) {
  const slug = String(post.slug ?? "").trim();
  return `/blog/${slug || post.id}` as any;
}

function supabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("es-PR", { year: "numeric", month: "short", day: "2-digit" });
}

function normalize(s: string) {
  return String(s ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export default async function BlogIndexPage({
  searchParams
}: {
  searchParams: { q?: string; cat?: string; sort?: "latest" | "popular" | "trend"; page?: string };
}) {
  const supabase = supabaseServer();
  const q = String(searchParams?.q ?? "").trim();
  const cat = String(searchParams?.cat ?? "").trim();
  const sort = (searchParams?.sort ?? "latest") as "latest" | "popular" | "trend";
  const pageNumRaw = Number(searchParams?.page ?? "1");
  const pageNum = Number.isFinite(pageNumRaw) ? Math.max(1, Math.floor(pageNumRaw)) : 1;
  const perPage = 12;

  const selectPrimary = "id, slug, title, excerpt, meta_description, cover_url, created_at, reading_time_minutes, categories, tags";
  const selectFallback = "id, title, excerpt, cover_url, created_at";
  const mapPost = (p: BlogPost): BlogPost => ({
    ...p,
    meta_description: clampMetaDescription((p as any).meta_description ?? p.excerpt ?? ""),
    reading_time_minutes:
      typeof (p as any).reading_time_minutes === "number"
        ? Number((p as any).reading_time_minutes)
        : estimateReadingTimeMinutes(`${p.title}\n\n${p.excerpt ?? ""}`)
  });

  let total = 0;
  let posts: BlogPost[] = [];

  // Popular/trending: aggregate last 7 days visits by /blog/{slugOrId}. Falls back to latest if service key missing.
  const svc = supabaseService();
  const counts = new Map<string, number>();
  const score = (p: BlogPost) => {
    const key = postHref(p);
    return counts.get(key) ?? 0;
  };

  const start = (pageNum - 1) * perPage;
  const end = start + perPage - 1;

  // Fast path for public browsing (most common): latest posts with DB pagination.
  if (sort === "latest" && !q) {
    let query = supabase.from("blog_posts").select(selectPrimary, { count: "exact" }).order("created_at", { ascending: false }).range(start, end);
    if (cat) query = query.contains("categories", [cat]);
    let { data, error, count } = await query;

    if (error && /(slug|meta_description|reading_time_minutes|categories|tags)/i.test(error.message)) {
      const fallback = await supabase
        .from("blog_posts")
        .select(selectFallback, { count: "exact" })
        .order("created_at", { ascending: false })
        .range(start, end);
      data = fallback.data as any;
      error = fallback.error as any;
      count = fallback.count;
    }

    const raw = (Array.isArray(data) && !error ? data : []) as unknown as BlogPost[];
    posts = raw.map(mapPost);
    total = Number(count ?? posts.length);
  } else {
    const run = async (selectCols: string) =>
      supabase.from("blog_posts").select(selectCols).order("created_at", { ascending: false }).limit(120);

    let { data, error } = await run(selectPrimary);
    if (error && /(slug|meta_description|reading_time_minutes|categories|tags)/i.test(error.message)) {
      const fallback = await run(selectFallback);
      data = fallback.data as any;
      error = fallback.error as any;
    }
    if (error) data = [];

    let filtered = ((Array.isArray(data) ? data : []) as unknown as BlogPost[]).map(mapPost);

    if (q) {
      const needle = normalize(q);
      filtered = filtered.filter((p) => {
        const hay = normalize(`${p.title} ${p.excerpt ?? ""} ${(p.meta_description ?? "")}`);
        return hay.includes(needle);
      });
    }
    if (cat) {
      const needle = normalize(cat);
      filtered = filtered.filter((p) => {
        const cats = (p.categories ?? []).map(normalize);
        const tags = (p.tags ?? []).map(normalize);
        return cats.includes(needle) || tags.includes(needle);
      });
    }

    if (svc && (sort === "popular" || sort === "trend")) {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: visits } = await svc
        .from("page_visits")
        .select("path, visited_at")
        .gte("visited_at", since)
        .like("path", "/blog/%")
        .limit(1200);
      (visits ?? []).forEach((v: any) => {
        const key = String(v.path ?? "").split("?")[0];
        counts.set(key, (counts.get(key) ?? 0) + 1);
      });
      filtered = [...filtered].sort((a, b) => score(b) - score(a));
    }

    total = filtered.length;
    posts = filtered.slice(start, start + perPage);
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const shownPage = Math.min(pageNum, totalPages);
  const featured = posts[0] ?? null;
  const rest = posts.slice(1);
  const trending = [...posts].sort((a, b) => score(b) - score(a)).slice(0, 5);

  const categories = Array.from(
    new Set(
      posts
        .flatMap((p) => p.categories ?? [])
        .map((c) => String(c).trim())
        .filter(Boolean)
    )
  ).slice(0, 12);

  const buildHref = (next: Partial<{ q: string; cat: string; sort: string; page: string }>): any => {
    const params = new URLSearchParams();
    const nq = (next.q ?? q).trim();
    const ncat = (next.cat ?? cat).trim();
    const nsort = (next.sort ?? sort).trim();
    const npage = (next.page ?? String(shownPage)).trim();
    if (nq) params.set("q", nq);
    if (ncat) params.set("cat", ncat);
    if (nsort) params.set("sort", nsort);
    if (npage && npage !== "1") params.set("page", npage);
    const qs = params.toString();
    return qs ? `/blog?${qs}` : "/blog";
  };
  const prevHref = buildHref({ page: String(Math.max(1, shownPage - 1)) });
  const nextHref = buildHref({ page: String(Math.min(totalPages, shownPage + 1)) });

  return (
    <main className="blog-mag blog-mag-index">
      <Navbar />

      <header className="mag-blog-head">
        <div className="container blog-container">
          <div className="mag-blog-head-inner">
            <div className="mag-blog-title">
              <div className="mag-kicker">Editorial</div>
              <h1 className="mag-h1">Blog</h1>
              <p className="mag-sub">Análisis, cultura y medios en formato revista. Enfoque PR · TX · USA.</p>
            </div>

            <div className="mag-blog-tools">
              <form className="mag-search" action="/blog" method="get">
                <input className="mag-input" name="q" defaultValue={q} placeholder="Buscar tema, nombre o frase..." />
                {cat ? <input type="hidden" name="cat" value={cat} /> : null}
                <input type="hidden" name="sort" value={sort} />
                <input type="hidden" name="page" value="1" />
              </form>

              <div className="mag-filters" aria-label="Filtros">
                <Link className={sort === "latest" ? "mag-chip active" : "mag-chip"} href={buildHref({ sort: "latest", page: "1" })}>
                  Más reciente
                </Link>
                <Link className={sort === "popular" ? "mag-chip active" : "mag-chip"} href={buildHref({ sort: "popular", page: "1" })}>
                  Popular
                </Link>
                <Link className={sort === "trend" ? "mag-chip active" : "mag-chip"} href={buildHref({ sort: "trend", page: "1" })}>
                  Tendencia
                </Link>
                {cat ? (
                  <Link className="mag-chip" href={buildHref({ cat: "", page: "1" })} title="Quitar categoria">
                    {cat} ✕
                  </Link>
                ) : null}
              </div>

              {categories.length ? (
                <div className="mag-cats" aria-label="Categorias">
                  {categories.map((c) => (
                    <Link key={c} className={cat === c ? "mag-chip active" : "mag-chip"} href={buildHref({ cat: c, page: "1" })}>
                      {c}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <section className="mag-blog-body">
        <div className="container blog-container">
          <div className="mag-blog-layout">
            <div className="mag-blog-main">
              <div className="mag-results">
                <span className="mag-small">
                  Mostrando {posts.length} de {total} artículos
                </span>
              </div>
              {featured ? (
                <article className="mag-hero">
                  <Link href={postHref(featured)} className="mag-hero-media" aria-label={featured.title}>
                    {featured.cover_url ? <img src={featured.cover_url} alt={featured.title} loading="eager" /> : <div className="mag-hero-fallback" />}
                    <div className="mag-hero-overlay" />
                    <div className="mag-hero-content">
                      <div className="mag-hero-top">
                        <div className="mag-cat-row">
                          {(featured.categories ?? []).slice(0, 1).map((c) => (
                            <span key={c} className={`mag-cat ${c === "Zona Cruda" ? "mag-cat-cruda" : ""}`}>
                              {c}
                            </span>
                          ))}
                          {score(featured) > 0 ? <span className="mag-cat mag-cat-hot">Tendencia</span> : null}
                        </div>
                        <div className="mag-meta">
                          <span>{formatDate(featured.created_at)}</span>
                          <span className="dot">·</span>
                          <span>{featured.reading_time_minutes} min</span>
                        </div>
                      </div>
                      <h2 className="mag-hero-title clamp-2">{featured.title}</h2>
                      <p className="mag-hero-excerpt clamp-2">{featured.meta_description ?? ""}</p>
                    </div>
                  </Link>
                  <div className="mag-hero-actions-row">
                    <Link className="mag-btn mag-btn-primary" href={postHref(featured)}>
                      Leer ahora
                    </Link>
                    <ShareButtons path={postHref(featured)} text={featured.title} />
                  </div>
                </article>
              ) : (
                <div className="mag-empty">Aun no hay articulos.</div>
              )}

              {rest.length ? (
                <div className="mag-grid" style={{ marginTop: 26 }}>
                  {rest.map((post, idx) => (
                    <div key={post.id} style={{ display: "contents" }}>
                      {idx === 4 ? <MidContentAdSlot /> : null}
                      <article className="mag-card">
                        <Link className="mag-card-media" href={postHref(post)} aria-label={post.title}>
                          {post.cover_url ? <img src={post.cover_url} alt={post.title} loading="lazy" /> : <div className="mag-card-fallback" />}
                        </Link>
                        <div className="mag-card-body">
                          <div className="mag-card-top">
                            {(post.categories ?? []).slice(0, 1).map((c) => (
                              <span key={c} className={`mag-cat ${c === "Zona Cruda" ? "mag-cat-cruda" : ""}`}>
                                {c}
                              </span>
                            ))}
                            <div className="mag-meta">
                              <span>{formatDate(post.created_at)}</span>
                              <span className="dot">·</span>
                              <span>{post.reading_time_minutes} min</span>
                            </div>
                          </div>
                          <h3 className="mag-h2 clamp-2" style={{ margin: 0 }}>
                            <Link href={postHref(post)}>{post.title}</Link>
                          </h3>
                          <p className="mag-excerpt clamp-2" style={{ margin: "10px 0 0" }}>
                            {post.meta_description ?? ""}
                          </p>
                          <div className="mag-card-actions">
                            <Link className="mag-btn mag-btn-ghost" href={postHref(post)}>
                              Leer artículo
                            </Link>
                          </div>
                        </div>
                      </article>
                    </div>
                  ))}
                </div>
              ) : null}

              {totalPages > 1 ? (
                <div style={{ display: "flex", gap: 10, justifyContent: "center", alignItems: "center", marginTop: 18 }}>
                  <Link className="button secondary" href={prevHref} aria-disabled={shownPage <= 1}>
                    Anterior
                  </Link>
                  <span className="muted" style={{ fontSize: 13 }}>
                    Página {shownPage} de {totalPages}
                  </span>
                  <Link className="button secondary" href={nextHref} aria-disabled={shownPage >= totalPages}>
                    Siguiente
                  </Link>
                </div>
              ) : null}
            </div>

            <aside className="mag-blog-aside">
              <div className="mag-side">
                <div className="mag-side-title">Trending esta semana</div>
                {trending.length ? (
                  <div className="mag-side-list">
                    {trending.map((p) => (
                      <Link key={p.id} href={postHref(p)} className="mag-side-item">
                        <span className="clamp-2">{p.title}</span>
                        <span className="mag-small">{p.reading_time_minutes} min</span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="mag-small">Sin datos aún.</p>
                )}
              </div>

              <div className="mag-side">
                <div className="mag-side-title">Suscríbete</div>
                <p className="mag-small" style={{ marginTop: 10 }}>
                  Sin spam. Solo lo que vale.
                </p>
                <NewsletterForm />
              </div>
            </aside>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
