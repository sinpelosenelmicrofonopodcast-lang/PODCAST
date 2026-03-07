import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { buildSeoMetadata, regionSeoTemplate } from "@/lib/seo/meta";
import { getPublishedPostsByRegion, normalizeRegion } from "@/lib/seo/content";
import { jsonLdScript } from "@/lib/seo/jsonld";

const REGION_LINKS = ["PR", "TX", "USA", "Mundo"] as const;

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("es-PR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export async function generateMetadata({ params }: { params: { region: string } }): Promise<Metadata> {
  const region = normalizeRegion(params.region) ?? "PR";
  const seo = regionSeoTemplate(region);
  return buildSeoMetadata({
    title: seo.title,
    description: seo.description,
    path: `/regiones/${encodeURIComponent(region)}`
  });
}

export default async function RegionPage({ params }: { params: { region: string } }) {
  const region = normalizeRegion(params.region);
  if (!region) {
    return (
      <main>
        <Navbar />
        <section className="section">
          <div className="container">
            <h1 className="section-title">Región no válida</h1>
            <p className="muted">Usa PR, TX, USA o Mundo.</p>
          </div>
        </section>
        <Footer />
      </main>
    );
  }

  const posts = await getPublishedPostsByRegion(region, 40);
  const listSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Noticias ${region}`,
    itemListElement: posts.slice(0, 20).map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `https://www.sinpelosenelmicrofono.com/noticias/${encodeURIComponent(item.slug)}`
    }))
  };

  return (
    <main>
      <Navbar />
      <section className="section">
        <div className="container">
          <h1 className="section-title">Noticias {region}</h1>
          <p className="muted">Cobertura, análisis y debate de {region}.</p>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {REGION_LINKS.map((value) => (
              <a key={value} className={value === region ? "button" : "button secondary"} href={`/regiones/${value}`}>
                {value}
              </a>
            ))}
          </div>

          <div className="grid" style={{ marginTop: 18, gridTemplateColumns: "repeat(auto-fit,minmax(min(320px,100%),1fr))" }}>
            {posts.map((post) => (
              <article key={post.id} className="card" style={{ display: "grid", gap: 10 }}>
                {post.cover_image_url ? (
                  <img
                    src={post.cover_image_url}
                    alt={post.title}
                    loading="lazy"
                    style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", borderRadius: 10 }}
                  />
                ) : null}
                <span className="muted">{formatDate(post.published_at)}</span>
                <h2 style={{ margin: 0 }}>{post.title}</h2>
                <p className="muted">{post.excerpt ?? "Cobertura editorial de Sin Pelos."}</p>
                <a className="button secondary" href={`/noticias/${encodeURIComponent(post.slug)}`}>
                  Leer noticia
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(listSchema) }} />
    </main>
  );
}
