import Link from "next/link";
import type { HomePodcastItem } from "@/lib/homepageQueries";

function compact(value: unknown) {
  return new Intl.NumberFormat("es-PR", { notation: "compact" }).format(Number(value ?? 0));
}

function sourceLink(item: HomePodcastItem | null | undefined) {
  const href = String(item?.source_url ?? "").trim();
  return href || "/feed";
}

export function PodcastBlock({
  featured
}: {
  featured: HomePodcastItem | null;
}) {
  return (
    <section className="home-media-section" aria-label="Podcast destacado">
      <div className="home-media-section-head">
        <h2>PODCAST DESTACADO</h2>
      </div>

      <article className="card home-podcast-featured">
        <div className="home-podcast-media">
          {featured?.media_url ? <img src={featured.media_url} alt={featured.title} loading="lazy" /> : <div className="home-media-image-fallback" aria-hidden="true" />}
        </div>
        <div className="home-podcast-body">
          <span className="home-urgency-badge">EN VIVO</span>
          <h3 className="clamp-2">{featured?.title ?? "No hay episodio sincronizado"}</h3>
          <p className="clamp-2">
            {featured?.caption ??
              "Activa la sincronizacion de YouTube para mostrar automaticamente el episodio mas reciente."}
          </p>
          <div className="home-podcast-metrics">
            <span>{compact(featured?.metrics?.views)} views</span>
            <span>{compact(featured?.metrics?.likes)} likes</span>
          </div>
          <div className="home-cta-row">
            <a className="button" href={sourceLink(featured)} target={featured?.source_url ? "_blank" : undefined} rel="noreferrer">
              VER EPISODIO
            </a>
            <Link className="button secondary" href="/feed">
              IR AL PODCAST
            </Link>
          </div>
        </div>
      </article>
    </section>
  );
}
