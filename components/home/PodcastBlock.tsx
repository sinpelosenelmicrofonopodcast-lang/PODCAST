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
  featured,
  clips
}: {
  featured: HomePodcastItem | null;
  clips: HomePodcastItem[];
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
              "Activa la sincronizacion de YouTube para mostrar automaticamente el episodio mas reciente y sus clips."}
          </p>
          <div className="home-podcast-metrics">
            <span>{compact(featured?.metrics?.views)} views</span>
            <span>{compact(featured?.metrics?.likes)} likes</span>
          </div>
          <div className="home-cta-row">
            <a className="button" href={sourceLink(featured)} target={featured?.source_url ? "_blank" : undefined} rel="noreferrer">
              VER EPISODIO
            </a>
            <Link className="button secondary" href="/feed?view=shorts">
              VER CLIPS
            </Link>
          </div>
        </div>
      </article>

      <div className="home-clips-scroll" role="list" aria-label="Ultimos clips">
        {clips.length > 0 ? (
          clips.map((clip) => (
            <a
              key={clip.id}
              href={sourceLink(clip)}
              className="card home-clip-card"
              target={clip.source_url ? "_blank" : undefined}
              rel={clip.source_url ? "noreferrer" : undefined}
              role="listitem"
            >
              <div className="home-clip-thumb">
                {clip.media_url ? <img src={clip.media_url} alt={clip.title} loading="lazy" /> : <div className="home-media-image-fallback" aria-hidden="true" />}
              </div>
              <div className="home-clip-body">
                <span className="home-media-chip">Clip</span>
                <h4 className="clamp-2">{clip.title}</h4>
                <span className="home-muted">{compact(clip.metrics?.views)} views</span>
              </div>
            </a>
          ))
        ) : (
          <article className="card home-empty-state" role="listitem">
            <p>No hay clips recientes.</p>
          </article>
        )}
      </div>
    </section>
  );
}
