import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { SafeImage } from "@/components/home/SafeImage";
import { Footer } from "@/components/Footer";
import { MidContentAdSlot } from "@/components/promotions/MidContentAdSlot";
import { DesktopSideAdSlot } from "@/components/promotions/DesktopSideAdSlot";
import { supabaseServer } from "@/lib/supabaseServer";
import { cleanNewsCategories, newsCategories, normalizeNewsCategory } from "@/lib/newsCategories";
import { newsHref } from "@/lib/newsRoute";
import { buildSeoMetadata } from "@/lib/seo/meta";
import { jsonLdScript } from "@/lib/seo/jsonld";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { loadNewsWire } from "@/lib/newsWire";

export const revalidate = 180;

export const metadata: Metadata = buildSeoMetadata({
  title: "Noticias Sin Pelos | Puerto Rico, Texas, USA y Mundo",
  description:
    "Noticias, contexto y archivo editorial de Sin Pelos en el Micrófono para Puerto Rico, Texas, USA y el mundo.",
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

const FRESH_BREAKING_HOURS = 72;

function normalizeRows(rows: NewsItem[]) {
  return rows.map((row) => ({
    ...row,
    cover_url: normalizeImageUrl(row.cover_url),
    categories: cleanNewsCategories(row.categories)
  }));
}

function safeTs(value?: string | null) {
  const ts = new Date(String(value ?? "")).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleDateString("es-PR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function isBreakingFresh(value?: string | null) {
  const ts = safeTs(value);
  if (!ts) return false;
  const age = Date.now() - ts;
  return age >= 0 && age <= FRESH_BREAKING_HOURS * 60 * 60 * 1000;
}

function uniqueById(items: NewsItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export default async function NoticiasPage({
  searchParams
}: {
  searchParams: { cat?: string; sort?: string; page?: string };
}) {
  const newsWirePromise = loadNewsWire();
  const supabase = supabaseServer();
  const category = normalizeNewsCategory(searchParams?.cat) ?? undefined;
  const sort = searchParams?.sort === "comments" ? "comments" : "latest";
  const pageRaw = Number(searchParams?.page ?? "1");
  const page = Number.isFinite(pageRaw) ? Math.max(1, Math.floor(pageRaw)) : 1;
  const perPage = 12;
  const start = (page - 1) * perPage;
  const end = start + perPage - 1;

  let query = supabase
    .from("news_items")
    .select("id, slug, title, summary, published_at, cover_url, categories", { count: "exact" })
    .eq("publication_state", "published")
    .order("published_at", { ascending: false })
    .range(start, end);
  if (category) query = query.contains("categories", [category]);

  let { data, error, count } = await query;
  if (error && /publication_state/i.test(error.message)) {
    let fallback = supabase
      .from("news_items")
      .select("id, slug, title, summary, published_at, cover_url, categories", { count: "exact" })
      .order("published_at", { ascending: false })
      .range(start, end);
    if (category) fallback = fallback.contains("categories", [category]);
    const result = await fallback;
    data = result.data;
    error = result.error;
    count = result.count;
  }

  let items = normalizeRows(((error ? [] : data) ?? []) as NewsItem[]);
  const total = Number(count ?? items.length);
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  if (sort === "comments" && items.length > 1) {
    const ids = items.map((item) => item.id);
    const { data: comments } = await supabase
      .from("comments")
      .select("content_id")
      .eq("content_type", "news")
      .in("content_id", ids);
    const counts = new Map<string, number>();
    (comments ?? []).forEach((row: any) => {
      const id = String(row?.content_id ?? "");
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    });
    items = [...items].sort(
      (a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || safeTs(b.published_at) - safeTs(a.published_at)
    );
  }

  const newsWire = await newsWirePromise;
  const pageItems = uniqueById(items);
  const breakingItems = page === 1 ? pageItems.filter((item) => isBreakingFresh(item.published_at)).slice(0, 5) : [];
  const latestPublished = pageItems[0]?.published_at ?? null;
  const archiveIsCurrent = latestPublished ? Date.now() - safeTs(latestPublished) <= 7 * 24 * 60 * 60 * 1000 : false;

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Noticias Sin Pelos",
    url: "https://www.sinpelosenelmicrofono.com/noticias",
    hasPart: pageItems.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1 + start,
      url: `https://www.sinpelosenelmicrofono.com${newsHref(item)}`
    }))
  };

  const categoryHref = (cat?: string) => ({
    pathname: "/noticias",
    query: {
      ...(cat ? { cat } : {}),
      sort,
      page: "1"
    }
  });

  const sortHref = (nextSort: "latest" | "comments") => ({
    pathname: "/noticias",
    query: {
      ...(category ? { cat: category } : {}),
      sort: nextSort,
      page: "1"
    }
  });

  const pageHref = (nextPage: number) => ({
    pathname: "/noticias",
    query: {
      ...(category ? { cat: category } : {}),
      sort,
      page: String(nextPage)
    }
  });

  return (
    <main className="news-refresh-page">
      <Navbar />
      <DesktopSideAdSlot section="noticias" />

      <section className="section">
        <div className="container">
          <header className="page-header-card news-page-header news-refresh-header">
            <div className="page-header-content">
              <p className="page-kicker">SPM NEWS · CONTEXTO ANTES QUE RUIDO</p>
              <h1>Noticias Sin Pelos</h1>
              <p className="muted">
                Puerto Rico, Texas, USA y mundo. Publicamos cuando hay algo que merece contexto; el resto queda claramente como archivo.
              </p>
              <div className={`news-refresh-status${archiveIsCurrent ? " is-current" : ""}`}>
                {latestPublished ? (
                  archiveIsCurrent
                    ? <>Cobertura actualizada · última publicación {formatDate(latestPublished)}</>
                    : <>Archivo editorial · última publicación {formatDate(latestPublished)} · no te vendemos archivo viejo como noticia de hoy</>
                ) : (
                  <>Archivo sin publicaciones disponibles</>
                )}
              </div>
            </div>
          </header>

          {breakingItems.length > 0 ? (
            <div className="news-breaking card" aria-label="Noticias de última hora">
              <span className="news-breaking-label">ÚLTIMA HORA</span>
              <div className="news-breaking-track">
                <div className="news-breaking-marquee">
                  {breakingItems.map((item) => (
                    <Link key={item.id} href={newsHref(item)} className="news-breaking-link">
                      {item.title}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div className="news-refresh-controls card">
            <div className="news-refresh-tabs" aria-label="Ordenar noticias">
              <Link className={`news-tab${sort === "latest" ? " active" : ""}`} href={sortHref("latest")}>Más recientes</Link>
              <Link className={`news-tab${sort === "comments" ? " active" : ""}`} href={sortHref("comments")}>Más comentadas</Link>
            </div>
            <div className="news-refresh-categories" aria-label="Categorías de noticias">
              <Link className={`news-tab${!category ? " active" : ""}`} href={categoryHref()}>Todas</Link>
              {newsCategories.map((cat) => (
                <Link key={cat} className={`news-tab${category === cat ? " active" : ""}`} href={categoryHref(cat)}>{cat}</Link>
              ))}
            </div>
          </div>


          {page === 1 && newsWire.length > 0 ? (
            <section className="card" aria-label="Radar automático de titulares" style={{ padding: "22px", margin: "20px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "baseline", flexWrap: "wrap", marginBottom: "16px" }}>
                <div>
                  <p className="page-kicker" style={{ marginBottom: "7px" }}>RADAR · FUENTES EXTERNAS</p>
                  <h2 style={{ margin: 0 }}>Titulares que se están moviendo</h2>
                </div>
                <span className="muted" style={{ fontSize: "13px" }}>Actualización automática cada 10 minutos · enlaces a medios originales</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 265px), 1fr))", gap: "13px" }}>
                {newsWire.map((item) => (
                  <article key={item.url} style={{ padding: "16px", border: "1px solid rgba(255,102,0,.25)", borderRadius: "12px", background: "rgba(255,102,0,.045)" }}>
                    <div style={{ fontSize: "12px", color: "#FFA76D", fontWeight: 800, marginBottom: "9px" }}>{item.region} · {item.source}</div>
                    <h3 style={{ fontSize: "16px", lineHeight: "1.35", margin: "0 0 12px" }}>
                      <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }}>{item.title}</a>
                    </h3>
                    <time className="muted" dateTime={item.publishedAt} style={{ fontSize: "12px" }}>
                      {new Date(item.publishedAt).toLocaleString("es-PR", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Puerto_Rico" })} AST
                    </time>
                  </article>
                ))}
              </div>
              <p className="muted" style={{ fontSize: "12px", marginTop: "14px" }}>
                Estos titulares pertenecen a otros medios y se enlazan a sus fuentes. No son artículos originales de Sin Pelos; las noticias propias aparecen más abajo.
              </p>
            </section>
          ) : null}

          <MidContentAdSlot placement="section_header" section="noticias" compact />

          <div className="news-refresh-results muted">
            {total} publicaciones{category ? ` · ${category}` : ""} · página {Math.min(page, totalPages)} de {totalPages}
          </div>

          {pageItems.length > 0 ? (
            <section className="news-refresh-grid" aria-label="Archivo de noticias">
              {pageItems.map((item, index) => (
                <article className={`card news-refresh-card${index === 0 && page === 1 ? " is-lead" : ""}`} key={item.id}>
                  <Link className="news-refresh-media" href={newsHref(item)} aria-label={`Leer ${item.title}`}>
                    {item.cover_url ? <SafeImage src={item.cover_url} alt={item.title} loading={index === 0 ? "eager" : "lazy"} /> : <div className="news-refresh-fallback" />}
                  </Link>
                  <div className="news-refresh-card-body">
                    <div className="news-refresh-meta">
                      <time>{formatDate(item.published_at)}</time>
                      {(item.categories ?? []).slice(0, 2).map((cat) => <span key={cat}>{cat}</span>)}
                    </div>
                    <h2><Link href={newsHref(item)}>{item.title}</Link></h2>
                    {item.summary ? <p>{item.summary}</p> : null}
                    <Link className="button secondary" href={newsHref(item)}>Leer con contexto</Link>
                  </div>
                </article>
              ))}
            </section>
          ) : (
            <div className="card news-refresh-empty">
              <h2>No hay publicaciones con esos filtros.</h2>
              <p className="muted">Prueba otra categoría o vuelve al archivo completo.</p>
              <Link className="button" href="/noticias">Ver todas</Link>
            </div>
          )}

          {totalPages > 1 ? (
            <nav className="news-refresh-pagination" aria-label="Paginación de noticias">
              {page > 1 ? <Link className="button secondary" href={pageHref(page - 1)}>← Anterior</Link> : <span />}
              <span className="muted">Página {Math.min(page, totalPages)} de {totalPages}</span>
              {page < totalPages ? <Link className="button secondary" href={pageHref(page + 1)}>Siguiente →</Link> : <span />}
            </nav>
          ) : null}
        </div>
      </section>

      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(collectionSchema) }} />
    </main>
  );
}
