import Link from "next/link";
import { newsHref } from "@/lib/newsRoute";
import type { HomeNewsItem } from "@/lib/homepageQueries";

function regionCard(item: HomeNewsItem) {
  const category = Array.isArray(item.categories) ? item.categories[0] : null;
  return (
    <Link key={item.id} href={newsHref(item)} className="card home-region-card">
      <div className="home-region-thumb">
        {item.cover_url ? <img src={item.cover_url} alt={item.title} loading="lazy" /> : <div className="home-media-image-fallback" aria-hidden="true" />}
      </div>
      <div className="home-region-body">
        <span className="home-media-chip">{category || "Noticias"}</span>
        <h4 className="clamp-2">{item.title}</h4>
      </div>
    </Link>
  );
}

function RegionBlock({ title, items }: { title: string; items: HomeNewsItem[] }) {
  return (
    <article className="home-region-block" aria-label={title}>
      <header className="home-region-head">
        <h3>{title}</h3>
      </header>
      {items.length === 0 ? (
        <div className="card home-empty-state">
          <p>Sin publicaciones recientes para {title}.</p>
        </div>
      ) : (
        <div className="home-region-grid">{items.slice(0, 4).map(regionCard)}</div>
      )}
    </article>
  );
}

export function RegionNews({
  regions
}: {
  regions: {
    puertoRico: HomeNewsItem[];
    texas: HomeNewsItem[];
    usa: HomeNewsItem[];
    mundo: HomeNewsItem[];
  };
}) {
  return (
    <section className="home-media-section" aria-label="Noticias por region">
      <div className="home-media-section-head">
        <h2>NOTICIAS POR REGION</h2>
      </div>
      <div className="home-region-layout">
        <RegionBlock title="Puerto Rico" items={regions.puertoRico} />
        <RegionBlock title="Texas" items={regions.texas} />
        <RegionBlock title="USA" items={regions.usa} />
        <RegionBlock title="Mundo" items={regions.mundo} />
      </div>
    </section>
  );
}
