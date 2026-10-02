import type { HomeTrendItem } from "@/lib/homepageQueries";

function compact(value: number) {
  return new Intl.NumberFormat("es-PR", { notation: "compact" }).format(Number(value ?? 0));
}

function TrendColumn({
  title,
  items,
  showMetrics
}: {
  title: string;
  items: HomeTrendItem[];
  showMetrics: boolean;
}) {
  return (
    <article className="card home-trending-column">
      <header>
        <h3>{title}</h3>
      </header>
      {items.length === 0 ? (
        <p className="home-muted">Sin datos en esta ventana.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={`${title}-${item.id}`}>
              <a href={item.href} className="home-trending-link">
                <span className="home-trending-headline clamp-2">{item.title}</span>
                <span className="home-trending-meta">
                  <span className="home-media-chip">{item.category}</span>
                  {showMetrics && item.views > 0 ? <span>{compact(item.views)} views</span> : null}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function TrendingBlock({
  enTendencia,
  subiendo,
  viral
}: {
  enTendencia: HomeTrendItem[];
  subiendo: HomeTrendItem[];
  viral: HomeTrendItem[];
}) {
  const allItems = [...enTendencia, ...subiendo, ...viral];
  const hasEngagement = allItems.some((item) => item.views > 0 || item.shares > 0 || item.comments > 0);

  return (
    <section className="home-media-section" aria-label={hasEngagement ? "Tendencias de las últimas 24 horas" : "Historias recientes"}>
      <div className="home-media-section-head">
        <h2>{hasEngagement ? "TENDENCIAS 24H" : "LO MÁS RECIENTE"}</h2>
      </div>
      <div className="home-trending-grid">
        <TrendColumn title={hasEngagement ? "EN TENDENCIA" : "PORTADA"} items={enTendencia} showMetrics={hasEngagement} />
        <TrendColumn title={hasEngagement ? "SUBIENDO" : "PARA LEER"} items={subiendo} showMetrics={hasEngagement} />
        <TrendColumn title={hasEngagement ? "VIRAL" : "MÁS HISTORIAS"} items={viral} showMetrics={hasEngagement} />
      </div>
    </section>
  );
}
