import Link from "next/link";
import { newsHref } from "@/lib/newsRoute";
import type { HomeNewsItem } from "@/lib/homepageQueries";

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("es-PR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function firstCategory(item: HomeNewsItem | null | undefined) {
  const category = Array.isArray(item?.categories) ? String(item?.categories?.[0] ?? "").trim() : "";
  return category || "Noticias";
}

function urgencyBadge(item: HomeNewsItem | null | undefined) {
  if (!item) return "TENDENCIA";
  const text = `${item.title} ${(item.categories ?? []).join(" ")}`.toLowerCase();
  if (/breaking|urgente|ultima hora/.test(text)) return "BREAKING";
  if (/exclusivo/.test(text)) return "EXCLUSIVO";
  if (/en vivo|live/.test(text)) return "EN VIVO";
  return "TENDENCIA";
}

export function HeroNews({
  kicker,
  title,
  subtitle,
  lead,
  trending
}: {
  kicker: string;
  title: string;
  subtitle: string;
  lead: HomeNewsItem | null;
  trending: HomeNewsItem[];
}) {
  return (
    <section className="home-media-section home-media-hero" aria-label="Breaking news hero">
      <div className="home-media-headline">
        <span className="home-media-kicker">{kicker}</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>

      <div className="home-media-hero-grid">
        <article className="home-media-hero-main card">
          {lead ? (
            <>
              <Link href={newsHref(lead)} className="home-media-hero-image" aria-label={lead.title}>
                {lead.cover_url ? (
                  <img src={lead.cover_url} alt={lead.title} loading="eager" />
                ) : (
                  <div className="home-media-image-fallback" aria-hidden="true" />
                )}
                <span className="home-urgency-badge">{urgencyBadge(lead)}</span>
              </Link>
              <div className="home-media-hero-body">
                <div className="home-media-chip-row">
                  <span className="home-media-chip">{firstCategory(lead)}</span>
                  <span className="home-media-date">{formatDate(lead.published_at)}</span>
                </div>
                <h2 className="clamp-2">{lead.title}</h2>
                <p className="clamp-2">{lead.summary ?? "Contexto, analisis y señal editorial en tiempo real."}</p>
                <Link className="button" href={newsHref(lead)}>
                  LEER ANALISIS
                </Link>
              </div>
            </>
          ) : (
            <div className="home-empty-state">
              <h2>Sin breaking activo</h2>
              <p>Publica una noticia para activar el hero principal.</p>
            </div>
          )}
        </article>

        <aside className="home-media-hero-side" aria-label="Trending cards">
          {trending.length > 0 ? (
            trending.slice(0, 3).map((item) => (
              <Link key={item.id} href={newsHref(item)} className="card home-media-trend-card">
                <div className="home-media-trend-thumb">
                  {item.cover_url ? (
                    <img src={item.cover_url} alt={item.title} loading="lazy" />
                  ) : (
                    <div className="home-media-image-fallback" aria-hidden="true" />
                  )}
                </div>
                <div className="home-media-trend-body">
                  <span className="home-media-chip">{firstCategory(item)}</span>
                  <h3 className="clamp-2">{item.title}</h3>
                  <span className="home-media-date">{formatDate(item.published_at)}</span>
                </div>
              </Link>
            ))
          ) : (
            <article className="card home-empty-state">
              <h3>Sin tendencia adicional</h3>
              <p>Aun no hay noticias secundarias para mostrar.</p>
            </article>
          )}
        </aside>
      </div>
    </section>
  );
}
