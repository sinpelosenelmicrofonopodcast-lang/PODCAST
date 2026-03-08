import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { buildSeoMetadata, episodeSeoTemplate } from "@/lib/seo/meta";
import { getEpisodeBySlug, getPublishedEpisodes } from "@/lib/seo/content";
import { buildPodcastEpisodeJsonLd, jsonLdScript } from "@/lib/seo/jsonld";
import { DEFAULT_OG_IMAGE } from "@/lib/seo/constants";

export const revalidate = 180;

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const episode = await getEpisodeBySlug(params.slug);
  if (!episode) {
    return buildSeoMetadata({
      title: "Episodio no encontrado | Sin Pelos en el Micrófono",
      description: "El episodio solicitado no existe.",
      path: `/podcast/${encodeURIComponent(params.slug)}`
    });
  }
  const seo = episodeSeoTemplate(episode.title, episode.description);
  return buildSeoMetadata({
    title: seo.title,
    description: seo.description,
    path: `/podcast/${encodeURIComponent(episode.slug)}`,
    image: episode.thumbnail_url || DEFAULT_OG_IMAGE
  });
}

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("es-PR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export default async function PodcastEpisodePage({ params }: { params: { slug: string } }) {
  const episode = await getEpisodeBySlug(params.slug);
  if (!episode) notFound();

  const allEpisodes = await getPublishedEpisodes(24);
  const idx = allEpisodes.findIndex((row) => row.slug === episode.slug || row.id === episode.id);
  const prevEpisode = idx > 0 ? allEpisodes[idx - 1] : null;
  const nextEpisode = idx >= 0 && idx + 1 < allEpisodes.length ? allEpisodes[idx + 1] : null;
  const related = allEpisodes.filter((row) => row.id !== episode.id).slice(0, 6);

  const schema = buildPodcastEpisodeJsonLd({
    canonicalPath: `/podcast/${encodeURIComponent(episode.slug)}`,
    title: episode.title,
    description: episode.description,
    datePublished: episode.published_at,
    audioUrl: episode.audio_url,
    youtubeUrl: episode.youtube_url,
    thumbnailUrl: episode.thumbnail_url || undefined
  });

  return (
    <main>
      <Navbar />
      <section className="section">
        <div className="container">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <Link className="button secondary" href="/podcast">
              Volver a podcast
            </Link>
            <span className="muted">{formatDate(episode.published_at)}</span>
          </div>

          <article className="card" style={{ marginTop: 12, display: "grid", gap: 14 }}>
            <h1 style={{ margin: 0 }}>{episode.title}</h1>
            {episode.thumbnail_url ? (
              <img
                src={episode.thumbnail_url}
                alt={episode.title}
                loading="eager"
                decoding="async"
                style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", borderRadius: 12 }}
              />
            ) : null}
            <p className="muted">{episode.description ?? "Episodio completo."}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {episode.youtube_url ? (
                <a className="button secondary" href={episode.youtube_url} target="_blank" rel="noreferrer">
                  Ver en YouTube
                </a>
              ) : null}
              {episode.audio_url ? (
                <a className="button secondary" href={episode.audio_url} target="_blank" rel="noreferrer">
                  Escuchar audio
                </a>
              ) : null}
            </div>
          </article>

          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {prevEpisode ? (
              <Link className="button secondary" href={`/podcast/${encodeURIComponent(prevEpisode.slug)}`}>
                Episodio anterior
              </Link>
            ) : null}
            {nextEpisode ? (
              <Link className="button secondary" href={`/podcast/${encodeURIComponent(nextEpisode.slug)}`}>
                Siguiente episodio
              </Link>
            ) : null}
          </div>

          {related.length > 0 ? (
            <section style={{ marginTop: 18 }}>
              <h2 className="section-title" style={{ marginBottom: 10 }}>
                Episodios relacionados
              </h2>
              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(280px,100%),1fr))" }}>
                {related.map((item) => (
                  <article key={item.id} className="card" style={{ display: "grid", gap: 8 }}>
                    <h3 style={{ margin: 0 }}>{item.title}</h3>
                    <p className="muted">{item.description ?? "Episodio completo."}</p>
                    <Link className="button secondary" href={`/podcast/${encodeURIComponent(item.slug)}`}>
                      Ver episodio
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </section>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(schema) }} />
    </main>
  );
}
