import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { buildSeoMetadata } from "@/lib/seo/meta";
import { getPublishedEpisodes } from "@/lib/seo/content";
import { buildPodcastSeriesJsonLd, jsonLdScript } from "@/lib/seo/jsonld";
import { DEFAULT_OG_IMAGE } from "@/lib/seo/constants";

export const revalidate = 180;

export const metadata: Metadata = buildSeoMetadata({
  title: "Podcast | Sin Pelos en el Micrófono",
  description: "Episodios completos del podcast Sin Pelos en el Micrófono.",
  path: "/podcast",
  image: DEFAULT_OG_IMAGE
});

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("es-PR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export default async function PodcastPage() {
  const episodes = await getPublishedEpisodes(48);
  const seriesSchema = buildPodcastSeriesJsonLd({
    canonicalPath: "/podcast",
    name: "Sin Pelos en el Micrófono",
    description: "Episodios, análisis y conversaciones sin libreto.",
    image: episodes[0]?.thumbnail_url || DEFAULT_OG_IMAGE
  });

  return (
    <main>
      <Navbar />
      <section className="section">
        <div className="container">
          <h1 className="section-title">Podcast</h1>
          <p className="muted">Todos los episodios completos en orden cronológico.</p>

          <div style={{ marginTop: 12 }}>
            <Link className="button secondary" href="/feed?view=episodes">
              Ver feed completo de episodios
            </Link>
          </div>

          <div className="grid" style={{ marginTop: 18, gridTemplateColumns: "repeat(auto-fit,minmax(min(320px,100%),1fr))" }}>
            {episodes.map((episode) => (
              <article key={episode.id} className="card" style={{ display: "grid", gap: 10 }}>
                {episode.thumbnail_url ? (
                  <img
                    src={episode.thumbnail_url}
                    alt={episode.title}
                    loading="lazy"
                    style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", borderRadius: 10 }}
                  />
                ) : null}
                <span className="muted">{formatDate(episode.published_at)}</span>
                <h2 style={{ margin: 0 }}>{episode.title}</h2>
                <p className="muted">{episode.description ?? "Episodio completo."}</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <a className="button secondary" href={`/podcast/${encodeURIComponent(episode.slug)}`}>
                    Ver episodio
                  </a>
                  {episode.youtube_url ? (
                    <a className="button secondary" href={episode.youtube_url} target="_blank" rel="noreferrer">
                      YouTube
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(seriesSchema) }} />
    </main>
  );
}
