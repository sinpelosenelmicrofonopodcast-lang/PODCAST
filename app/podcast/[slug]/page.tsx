import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { SafeImage } from "@/components/home/SafeImage";
import { EpisodeEditorial } from "@/components/podcast/EpisodeEditorial";
import { buildSeoMetadata, episodeSeoTemplate } from "@/lib/seo/meta";
import { getPublishedEpisodes } from "@/lib/seo/content";
import { resolveEpisodeBySlug } from "@/lib/episodeResolver";
import { getPublishedEpisodeEditorial } from "@/lib/episodeEditorials";
import { buildPodcastEpisodeJsonLd, jsonLdScript } from "@/lib/seo/jsonld";
import { DEFAULT_OG_IMAGE } from "@/lib/seo/constants";

export const revalidate = 180;

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const episode = await resolveEpisodeBySlug(params.slug);
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
    month: "long",
    year: "numeric"
  });
}

function formatDuration(seconds?: number | null) {
  const total = Number(seconds ?? 0);
  if (!Number.isFinite(total) || total <= 0) return null;
  const hours = Math.floor(total / 3600);
  const minutes = Math.round((total % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes} min`;
}

export default async function PodcastEpisodePage({ params }: { params: { slug: string } }) {
  const episode = await resolveEpisodeBySlug(params.slug);
  if (!episode) notFound();

  const [storedEpisodes, editorial] = await Promise.all([
    getPublishedEpisodes(24),
    getPublishedEpisodeEditorial(episode)
  ]);

  const allEpisodes = storedEpisodes.some((row) => row.slug === episode.slug || row.id === episode.id)
    ? storedEpisodes
    : [episode, ...storedEpisodes];
  const idx = allEpisodes.findIndex((row) => row.slug === episode.slug || row.id === episode.id);
  const prevEpisode = idx > 0 ? allEpisodes[idx - 1] : null;
  const nextEpisode = idx >= 0 && idx + 1 < allEpisodes.length ? allEpisodes[idx + 1] : null;
  const related = allEpisodes.filter((row) => row.id !== episode.id).slice(0, 4);
  const duration = formatDuration(episode.duration_seconds);

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
    <main className="episode-page">
      <Navbar />

      <section className="episode-hero">
        <div className="container episode-hero-grid">
          <div className="episode-hero-copy">
            <Link className="episode-back" href="/podcast">
              ← Todos los episodios
            </Link>
            <span className="episode-kicker">SIN PELOS EN EL MICRÓFONO</span>
            <h1>{episode.title}</h1>
            <div className="episode-meta">
              {episode.published_at ? <span>{formatDate(episode.published_at)}</span> : null}
              {duration ? <span>{duration}</span> : null}
              <span>Conversación completa</span>
            </div>
            <p>{episode.description ?? "Una conversación real, sin libreto y sin filtro."}</p>
            <div className="episode-actions">
              {episode.youtube_url ? (
                <a className="button episode-primary-cta" href={episode.youtube_url} target="_blank" rel="noreferrer">
                  ▶ Ver episodio completo
                </a>
              ) : null}
              {episode.audio_url ? (
                <a className="button secondary" href={episode.audio_url} target="_blank" rel="noreferrer">
                  Escuchar audio
                </a>
              ) : null}
            </div>
          </div>

          <div className="episode-hero-media">
            <div className="episode-hero-glow" aria-hidden="true" />
            <SafeImage src={episode.thumbnail_url} alt={episode.title} loading="eager" />
            <span className="episode-media-tag">SIN PELOS</span>
          </div>
        </div>
      </section>

      {editorial ? (
        <section className="episode-editorial-zone">
          <div className="container">
            <EpisodeEditorial editorial={editorial} />
          </div>
        </section>
      ) : null}

      <section className="episode-navigation-zone">
        <div className="container">
          <div className="episode-nav-row">
            {prevEpisode ? (
              <Link className="episode-nav-card" href={`/podcast/${encodeURIComponent(prevEpisode.slug)}`}>
                <small>EPISODIO ANTERIOR</small>
                <strong>{prevEpisode.title}</strong>
              </Link>
            ) : <span />}
            {nextEpisode ? (
              <Link className="episode-nav-card is-next" href={`/podcast/${encodeURIComponent(nextEpisode.slug)}`}>
                <small>SIGUIENTE EPISODIO</small>
                <strong>{nextEpisode.title}</strong>
              </Link>
            ) : null}
          </div>

          {related.length > 0 ? (
            <section className="episode-related">
              <div className="episode-related-heading">
                <span>SEGUIMOS HABLANDO</span>
                <h2>Más conversaciones que valen la pena</h2>
              </div>
              <div className="episode-related-grid">
                {related.map((item) => (
                  <Link key={item.id} className="episode-related-card" href={`/podcast/${encodeURIComponent(item.slug)}`}>
                    <div className="episode-related-media">
                      <SafeImage src={item.thumbnail_url} alt={item.title} loading="lazy" />
                    </div>
                    <div>
                      <small>{formatDate(item.published_at)}</small>
                      <h3>{item.title}</h3>
                      <span>Ver episodio →</span>
                    </div>
                  </Link>
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
