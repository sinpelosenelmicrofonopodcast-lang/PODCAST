import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ShareButtons } from "@/components/ShareButtons";
import { MidContentAdSlot } from "@/components/promotions/MidContentAdSlot";
import { NewsletterForm } from "@/components/newsletter/NewsletterForm";
import { supabaseServer } from "@/lib/supabaseServer";
import { clampMetaDescription, estimateReadingTimeMinutes } from "@/lib/blogSeo";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

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
  searchParams: { q?: string; cat?: string; sort?: "latest" | "popular" | "trend" };
}) {
  const supabase = supabaseServer();
  const q = String(searchParams?.q ?? "").trim();
  const cat = String(searchParams?.cat ?? "").trim();
  const sort = (searchParams?.sort ?? "latest") as "latest" | "popular" | "trend";

  const run = async (selectCols: string) =>
    supabase.from("blog_posts").select(selectCols).order("created_at", { ascending: false }).limit(60);

  let { data, error } = await run("id, slug, title, excerpt, meta_description, cover_url, created_at, reading_time_minutes, categories, tags");
  if (error && /(slug|meta_description|reading_time_minutes|categories|tags)/i.test(error.message)) {
    const fallback = await run("id, title, excerpt, cover_url, created_at");
    data = fallback.data as any;
    error = fallback.error as any;
  }
  if (error) data = [];

  const rawPosts = (Array.isArray(data) ? data : []) as unknown as BlogPost[];
  let posts = rawPosts.map((p) => ({
    ...p,
    meta_description: clampMetaDescription((p as any).meta_description ?? p.excerpt ?? ""),
    reading_time_minutes:
      typeof (p as any).reading_time_minutes === "number"
        ? Number((p as any).reading_time_minutes)
        : estimateReadingTimeMinutes(`${p.title}\n\n${p.excerpt ?? ""}`)
  }));

  // Server-side filter for search/category (safe + no query-string injection).
  if (q) {
    const needle = normalize(q);
    posts = posts.filter((p) => {
      const hay = normalize(`${p.title} ${p.excerpt ?? ""} ${(p.meta_description ?? "")}`);
      return hay.includes(needle);
    });
  }
  if (cat) {
    const needle = normalize(cat);
    posts = posts.filter((p) => {
      const cats = (p.categories ?? []).map(normalize);
      const tags = (p.tags ?? []).map(normalize);
      return cats.includes(needle) || tags.includes(needle);
    });
  }

  // Popular/trending: aggregate last 7 days visits by /blog/{slugOrId}. Falls back to latest if service key missing.
  const svc = supabaseService();
  const counts = new Map<string, number>();
  if (svc && (sort === "popular" || sort === "trend")) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: visits } = await svc
      .from("page_visits")
      .select("path, visited_at")
      .gte("visited_at", since)
      .like("path", "/blog/%")
      .limit(4000);
    (visits ?? []).forEach((v: any) => {
      const key = String(v.path ?? "").split("?")[0];
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
  }

  const score = (p: BlogPost) => {
    const key = `/blog/${(p.slug ?? p.id) as string}`;
    return counts.get(key) ?? 0;
  };

  if (sort === "popular" || sort === "trend") {
    posts = [...posts].sort((a, b) => score(b) - score(a));
  }

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

  const buildHref = (next: Partial<{ q: string; cat: string; sort: string }>): any => {
    const params = new URLSearchParams();
    const nq = (next.q ?? q).trim();
    const ncat = (next.cat ?? cat).trim();
    const nsort = (next.sort ?? sort).trim();
    if (nq) params.set("q", nq);
    if (ncat) params.set("cat", ncat);
    if (nsort) params.set("sort", nsort);
    const qs = params.toString();
    return qs ? `/blog?${qs}` : "/blog";
  };

  return (
    <main className="blog-index">
      <Navbar />
      <section className="section">
        <div className="container blog-container">
          <header className="blog-header">
            <div>
              <h1 className="section-title" style={{ margin: 0 }}>
                Blog
              </h1>
              <p className="muted" style={{ margin: "8px 0 0" }}>
                Analisis directo, cultura y medios. PR · TX · USA.
              </p>
            </div>

            <div className="blog-controls">
              <form className="blog-search" action="/blog" method="get">
                <input className="input" name="q" defaultValue={q} placeholder="Buscar por tema, persona o frase..." />
                {cat ? <input type="hidden" name="cat" value={cat} /> : null}
                <input type="hidden" name="sort" value={sort} />
              </form>

              <div className="chips-row" aria-label="Filtros">
                <Link className={sort === "latest" ? "chip active" : "chip"} href={buildHref({ sort: "latest" })}>
                  Mas reciente
                </Link>
                <Link className={sort === "popular" ? "chip active" : "chip"} href={buildHref({ sort: "popular" })}>
                  Popular
                </Link>
                <Link className={sort === "trend" ? "chip active" : "chip"} href={buildHref({ sort: "trend" })}>
                  Tendencia
                </Link>
                {cat ? (
                  <Link className="chip" href={buildHref({ cat: "" })} title="Quitar categoria">
                    {cat} ✕
                  </Link>
                ) : null}
              </div>

              {categories.length ? (
                <div className="chips-row" aria-label="Categorias">
                  {categories.map((c) => (
                    <Link key={c} className={cat === c ? "chip active" : "chip"} href={buildHref({ cat: c })}>
                      {c}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          </header>

          <div className="blog-layout">
            <div className="blog-main">
              {featured ? (
                <article className="card featured-post">
                  <Link href={`/blog/${featured.slug ?? featured.id}`} className="featured-media">
                    {featured.cover_url ? <img src={featured.cover_url} alt={featured.title} loading="eager" /> : <div className="featured-fallback" />}
                    <div className="featured-badges">
                      {(featured.categories ?? []).slice(0, 1).map((c) => (
                        <span key={c} className="pill">
                          {c}
                        </span>
                      ))}
                      <span className="pill">Analisis</span>
                      {score(featured) > 0 ? <span className="pill new">Tendencia</span> : null}
                    </div>
                  </Link>
                  <div className="featured-body">
                    <h2 className="featured-title clamp-2">{featured.title}</h2>
                    <p className="muted clamp-2" style={{ margin: 0 }}>
                      {featured.meta_description ?? ""}
                    </p>
                    <div className="post-meta">
                      <span>Sin Pelos</span>
                      <span>·</span>
                      <span>{formatDate(featured.created_at)}</span>
                      <span>·</span>
                      <span>{featured.reading_time_minutes} min</span>
                    </div>
                    <div className="featured-actions">
                      <Link className="button" href={`/blog/${featured.slug ?? featured.id}`}>
                        Leer ahora
                      </Link>
                      <ShareButtons path={`/blog/${featured.slug ?? featured.id}`} text={featured.title} />
                    </div>
                  </div>
                </article>
              ) : (
                <div className="card">
                  <p className="muted">Aun no hay articulos.</p>
                </div>
              )}

              {rest.length ? (
                <>
                  <div className="blog-grid">
                    {rest.map((post, idx) => (
                      <div key={post.id} style={{ display: "contents" }}>
                        {idx === 5 ? <MidContentAdSlot /> : null}
                        <article className="card post-card">
                          <Link className="post-card-media" href={`/blog/${post.slug ?? post.id}`}>
                            {post.cover_url ? <img src={post.cover_url} alt={post.title} loading="lazy" /> : <div className="post-card-fallback" />}
                            <div className="post-card-badges">
                              {(post.categories ?? []).slice(0, 1).map((c) => (
                                <span key={c} className="pill">
                                  {c}
                                </span>
                              ))}
                            </div>
                          </Link>
                          <div className="post-card-body">
                            <h3 className="clamp-2" style={{ margin: 0 }}>
                              <Link href={`/blog/${post.slug ?? post.id}`}>{post.title}</Link>
                            </h3>
                            <p className="muted clamp-2" style={{ margin: "8px 0 0" }}>
                              {post.meta_description ?? ""}
                            </p>
                            <div className="post-meta">
                              <span>{formatDate(post.created_at)}</span>
                              <span>·</span>
                              <span>{post.reading_time_minutes} min</span>
                            </div>
                          </div>
                        </article>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>

            <aside className="blog-sidebar">
              <div className="card">
                <div className="sidebar-title">Trending esta semana</div>
                {trending.length ? (
                  <div className="sidebar-list">
                    {trending.map((p) => (
                      <Link key={p.id} href={`/blog/${p.slug ?? p.id}`} className="sidebar-item">
                        <span className="clamp-2">{p.title}</span>
                        <span className="muted" style={{ fontSize: 12 }}>
                          {p.reading_time_minutes} min
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="muted">Sin datos aun.</p>
                )}
              </div>

              <div className="card">
                <div className="sidebar-title">Categorias</div>
                <div className="chips-row">
                  {categories.length ? (
                    categories.map((c) => (
                      <Link key={c} className={cat === c ? "chip active" : "chip"} href={buildHref({ cat: c })}>
                        {c}
                      </Link>
                    ))
                  ) : (
                    <span className="muted">Sin categorias.</span>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="sidebar-title">Suscribete</div>
                <p className="muted" style={{ marginTop: 8 }}>
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
