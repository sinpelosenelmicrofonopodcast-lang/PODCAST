import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { SafeImage } from "@/components/home/SafeImage";
import { EpisodeEditorial } from "@/components/podcast/EpisodeEditorial";
import { buildSeoMetadata, episodeSeoTemplate } from "@/lib/seo/meta";
import { getPublishedEpisodes, type SeoEpisode } from "@/lib/seo/content";
import { resolveEpisodeBySlug } from "@/lib/episodeResolver";
import { getPublishedEpisodeEditorial } from "@/lib/episodeEditorials";
import { buildPodcastEpisodeJsonLd, jsonLdScript } from "@/lib/seo/jsonld";
import { DEFAULT_OG_IMAGE } from "@/lib/seo/constants";
import { fetchYouTubeVideos, getYouTubeVideoId, isFullPodcastEpisode } from "@/lib/youtube";

export const revalidate = 120;

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

function cleanEpisodeDescription(value?: string | null) {
  const raw = String(value ?? "").replace(/\r/g, "").trim();
  if (!raw) return "Una conversación real, sin libreto y sin filtro.";

  const cutMarkers = [
    "\n\nSin Pelos en el Micrófono.",
    "\n\n¿Te atreves",
    "\n\n🔗",
    "\n\nWebsite:",
    "\n\nInstagram:",
    "\n\nSi no has visto este episodio"
  ];
  let cleaned = raw;
  for (const marker of cutMarkers) {
    const index = cleaned.indexOf(marker);
    if (index >= 0) cleaned = cleaned.slice(0, index);
  }

  const separatorIndex = cleaned.search(/\n\s*_{12,}\s*(?:\n|$)/);
  if (separatorIndex >= 0) cleaned = cleaned.slice(0, separatorIndex);

  cleaned = cleaned
    .replace(/^\s*[_=-]{12,}\s*$/gm, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!cleaned) return "Una conversación real, sin libreto y sin filtro.";
  return cleaned.length > 1500 ? `${cleaned.slice(0, 1497).trimEnd()}…` : cleaned;
}

function safeTs(value?: string | null) {
  const ts = new Date(String(value ?? "")).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function catalogKey(episode: Pick<SeoEpisode, "id" | "slug" | "youtube_url">) {
  return getYouTubeVideoId(episode.youtube_url) || (/^[A-Za-z0-9_-]{11}$/.test(episode.slug) ? episode.slug : episode.id);
}

async function getCurrentCatalog(): Promise<SeoEpisode[]> {
  const [stored, liveVideos] = await Promise.all([
    getPublishedEpisodes(180),
    fetchYouTubeVideos(180, { revalidateSeconds: 120 }).catch(() => [])
  ]);
  const live = liveVideos.filter(isFullPodcastEpisode);
  const storedByVideo = new Map<string, SeoEpisode>();
  stored.forEach((item) => {
    const key = getYouTubeVideoId(item.youtube_url) || (/^[A-Za-z0-9_-]{11}$/.test(item.slug) ? item.slug : null);
    if (key) storedByVideo.set(key, item);
  });

  const mergedByKey = new Map<string, SeoEpisode>();
  live.forEach((video) => {
    const saved = storedByVideo.get(video.id);
    mergedByKey.set(video.id, {
      id: saved?.id || video.id,
      slug: saved?.slug || video.id,
      title: video.title || saved?.title || "Episodio",
      description: video.description || saved?.description || null,
      youtube_url: `https://www.youtube.com/watch?v=${video.id}`,
      audio_url: saved?.audio_url || null,
      thumbnail_url: video.thumbnailUrl || saved?.thumbnail_url || `https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`,
      duration_seconds: video.durationSeconds || saved?.duration_seconds || null,
      is_published: true,
      published_at: video.publishedAt || saved?.published_at || null,
      updated_at: saved?.updated_at || video.publishedAt || null
    });
  });

  stored.forEach((item) => {
    const key = catalogKey(item);
    if (!mergedByKey.has(key)) mergedByKey.set(key, item);
  });

  return [...mergedByKey.values()].sort((a, b) => safeTs(b.published_at) - safeTs(a.published_at));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const episode = await resolveEpisodeBySlug(params.slug);
  if (!episode) {
    return buildSeoMetadata({
      title: "Episodio no encontrado",
      description: "El episodio solicitado no existe.",
      path: `/podcast/${encodeURIComponent(params.slug)}`
    });
  }
  const seo = episodeSeoTemplate(episode.title, cleanEpisodeDescription(episode.description));
  return buildSeoMetadata({
    title: seo.title,
    description: seo.description,
    path: `/podcast/${encodeURIComponent(episode.slug)}`,
    image: episode.thumbnail_url || DEFAULT_OG_IMAGE
  });
}

export default async function PodcastEpisodePage({ params }: { params: { slug: string } }) {
  const episode = await resolveEpisodeBySlug(params.slug);
  if (!episode) notFound();

  const [catalog, editorial] = await Promise.all([
    getCurrentCatalog(),
    getPublishedEpisodeEditorial(episode)
  ]);

  const currentKey = catalogKey(episode);
  const allEpisodes = catalog.some((row) => catalogKey(row) === currentKey)
    ? catalog
    : [episode, ...catalog].sort((a, b) => safeTs(b.published_at) - safeTs(a.published_at));
  const idx = allEpisodes.findIndex((row) => catalogKey(row) === currentKey);

  // Catalog is newest -> oldest. "Anterior" means the older episode; "Siguiente" means the newer episode.
  const prevEpisode = idx >= 0 && idx + 1 < allEpisodes.length ? allEpisodes[idx + 1] : null;
  const nextEpisode = idx > 0 ? allEpisodes[idx - 1] : null;
  const related = allEpisodes.filter((row) => catalogKey(row) !== currentKey).slice(0, 4);
  const duration = formatDuration(episode.duration_seconds);
  const heroDescription = cleanEpisodeDescription(episode.description);

  const schema = buildPodcastEpisodeJsonLd({
    canonicalPath: `/podcast/${encodeURIComponent(episode.slug)}`,
    title: episode.title,
    description: heroDescription,
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
            <p className="episode-hero-description">{heroDescription}</p>
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
              <Link className="episode-nav-card" href={`/podcast/${encodeURIComponent(prevEpisode.slug)}` as any}>
                <small>EPISODIO ANTERIOR</small>
                <strong>{prevEpisode.title}</strong>
              </Link>
            ) : <span />}
            {nextEpisode ? (
              <Link className="episode-nav-card is-next" href={`/podcast/${encodeURIComponent(nextEpisode.slug)}` as any}>
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
                  <Link key={catalogKey(item)} className="episode-related-card" href={`/podcast/${encodeURIComponent(item.slug)}` as any}>
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
