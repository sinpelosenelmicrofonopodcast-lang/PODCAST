import type { HomeTrendItem } from "@/lib/homepageQueries";

function compact(value: number) {
  return new Intl.NumberFormat("es-PR", { notation: "compact" }).format(Number(value ?? 0));
}

function TrendColumn({
  title,
  items
}: {
  title: "EN TENDENCIA" | "SUBIENDO" | "VIRAL";
  items: HomeTrendItem[];
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
                  <span>{compact(item.views)} views</span>
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
  return (
    <section className="home-media-section" aria-label="Tendencias 24h">
      <div className="home-media-section-head">
        <h2>TENDENCIAS 24H</h2>
      </div>
      <div className="home-trending-grid">
        <TrendColumn title="EN TENDENCIA" items={enTendencia} />
        <TrendColumn title="SUBIENDO" items={subiendo} />
        <TrendColumn title="VIRAL" items={viral} />
      </div>
    </section>
  );
}
