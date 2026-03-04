import type { HomePodcastItem } from "@/lib/homepageQueries";

function compact(value: unknown) {
  return new Intl.NumberFormat("es-PR", { notation: "compact" }).format(Number(value ?? 0));
}

function typeLabel(item: HomePodcastItem, index: number) {
  if (index === 0) return "VIDEO";
  if (index === 1) return "SHORT POST";
  return "MEME";
}

export function ViralSection({ items }: { items: HomePodcastItem[] }) {
  return (
    <section className="home-media-section" aria-label="Viral del dia">
      <div className="home-media-section-head">
        <h2>VIRAL DEL DIA</h2>
      </div>

      <div className="home-viral-grid">
        {items.length > 0 ? (
          items.slice(0, 3).map((item, idx) => (
            <a key={item.id} href={item.source_url ?? "/feed"} target="_blank" rel="noreferrer" className="card home-viral-card">
              <div className="home-viral-thumb">
                {item.media_url ? <img src={item.media_url} alt={item.title} loading="lazy" /> : <div className="home-media-image-fallback" aria-hidden="true" />}
                <span className="home-urgency-badge">{typeLabel(item, idx)}</span>
              </div>
              <div className="home-viral-body">
                <h3 className="clamp-2">{item.title}</h3>
                <p className="clamp-2">{item.caption ?? "Contenido viral con alto nivel de interaccion."}</p>
                <div className="home-viral-meta">
                  <span>{compact(item.metrics?.views)} views</span>
                  <span>{compact(item.metrics?.shares)} shares</span>
                </div>
              </div>
            </a>
          ))
        ) : (
          <article className="card home-empty-state">
            <p>Sin piezas virales en este momento.</p>
          </article>
        )}
      </div>
    </section>
  );
}
