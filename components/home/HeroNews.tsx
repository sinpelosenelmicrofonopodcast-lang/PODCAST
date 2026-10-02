import Link from "next/link";
import { newsHref } from "@/lib/newsRoute";
import type { HomeNewsItem } from "@/lib/homepageQueries";
import { SafeImage } from "@/components/home/SafeImage";

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

function ageHours(value?: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Date.now() - timestamp) / (1000 * 60 * 60));
}

function urgencyBadge(item: HomeNewsItem | null | undefined) {
  if (!item) return "PORTADA";
  const text = `${item.title} ${(item.categories ?? []).join(" ")}`.toLowerCase();
  const recent = ageHours(item.published_at) <= 24;

  if (recent && /breaking|urgente|ultima hora/.test(text)) return "BREAKING";
  if (recent && /en vivo|live/.test(text)) return "EN VIVO";
  if (/exclusivo/.test(text)) return "EXCLUSIVO";
  if (recent) return "NUEVO";
  return "PORTADA";
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
    <section className="home-media-section home-media-hero" aria-label="Noticias destacadas">
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
                <SafeImage src={lead.cover_url} alt={lead.title} loading="eager" />
                <span className="home-urgency-badge">{urgencyBadge(lead)}</span>
              </Link>
              <div className="home-media-hero-body">
                <div className="home-media-chip-row">
                  <span className="home-media-chip">{firstCategory(lead)}</span>
                  <span className="home-media-date">{formatDate(lead.published_at)}</span>
                </div>
                <h2 className="clamp-2">{lead.title}</h2>
                <p className="clamp-2">{lead.summary ?? "Contexto, análisis y señal editorial con los hechos por delante."}</p>
                <Link className="button" href={newsHref(lead)}>
                  LEER ANÁLISIS
                </Link>
              </div>
            </>
          ) : (
            <div className="home-empty-state">
              <h2>La redacción está preparando la próxima historia</h2>
              <p>Cuando una noticia pase revisión editorial aparecerá aquí.</p>
            </div>
          )}
        </article>

        <aside className="home-media-hero-side" aria-label="Más noticias destacadas">
          {trending.length > 0 ? (
            trending.slice(0, 3).map((item) => (
              <Link key={item.id} href={newsHref(item)} className="card home-media-trend-card">
                <div className="home-media-trend-thumb">
                  <SafeImage src={item.cover_url} alt={item.title} loading="lazy" />
                </div>
                <div className="home-media-trend-body">
                  <div className="home-media-chip-row">
                    <span className="home-media-chip">{firstCategory(item)}</span>
                    <span className="home-media-date">{formatDate(item.published_at)}</span>
                  </div>
                  <h3 className="clamp-2">{item.title}</h3>
                </div>
              </Link>
            ))
          ) : (
            <article className="card home-empty-state">
              <h3>Más historias pronto</h3>
              <p>La redacción todavía no tiene noticias secundarias listas.</p>
            </article>
          )}
        </aside>
      </div>
    </section>
  );
}
