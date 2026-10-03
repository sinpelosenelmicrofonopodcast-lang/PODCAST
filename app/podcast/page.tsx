import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { buildSeoMetadata } from "@/lib/seo/meta";
import { getPublishedEpisodes } from "@/lib/seo/content";
import { buildPodcastSeriesJsonLd, jsonLdScript } from "@/lib/seo/jsonld";
import { DEFAULT_OG_IMAGE } from "@/lib/seo/constants";
import { supabaseServer } from "@/lib/supabaseServer";
import { fetchYouTubeVideos, getYouTubeVideoId, isFullPodcastEpisode } from "@/lib/youtube";
import { PodcastHubClient, type PodcastEpisodeCardData } from "@/components/podcast/PodcastHubClient";

export const revalidate = 120;

type EpisodeMetricRow = {
  source_url: string | null;
  metrics: {
    views?: number;
    viewCount?: number;
  } | null;
};

function safeDateToTs(value?: string | null) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function fallbackThumbnail(videoId?: string | null) {
  return videoId ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg` : null;
}

function cleanDescription(title: string, value?: string | null) {
  let raw = String(value ?? "").replace(/\r/g, "").trim();
  if (!raw) return "Una conversación real, sin libreto y sin filtro.";

  const titleText = String(title ?? "").trim();
  const escapedTitle = titleText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (escapedTitle) {
    raw = raw.replace(new RegExp(`^(?:${escapedTitle}\\s*){1,3}`, "i"), "").trim();
  }

  const markers = [
    /\n\s*¿Te atreves a escuchar la verdad\?/i,
    /\n\s*🔗\s*Conecta con la Comunidad/i,
    /\n\s*Conecta con la Comunidad/i,
    /\n\s*🌐\s*Website:/i,
    /\n\s*Si no has visto este episodio/i,
    /\n\s*©\s*B&B Entertainment/i
  ];
  for (const marker of markers) {
    const match = raw.search(marker);
    if (match > 0) raw = raw.slice(0, match);
  }

  raw = raw
    .replace(/^\s*[_=-]{10,}\s*$/gm, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  return raw || "Una conversación real, sin libreto y sin filtro.";
}

async function getLiveEpisodes() {
  try {
    const videos = await fetchYouTubeVideos(180, { revalidateSeconds: 120 });
    return videos.filter(isFullPodcastEpisode);
  } catch {
    return [];
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const live = await getLiveEpisodes();
  const stored = live.length === 0 ? (await getPublishedEpisodes(1))[0] : null;
  const latest = live[0];
  return buildSeoMetadata({
    title: "Podcast | Episodios Sin Pelos en el Micrófono",
    description:
      "Todos los episodios completos de Sin Pelos en el Micrófono: conversaciones reales, invitados, historias y debates sin libreto.",
    path: "/podcast",
    image: latest?.thumbnailUrl || stored?.thumbnail_url || DEFAULT_OG_IMAGE
  });
}

export default async function PodcastPage() {
  const supabase = supabaseServer();
  const [storedEpisodes, liveEpisodes] = await Promise.all([getPublishedEpisodes(400), getLiveEpisodes()]);

  const { data: metricsRows } = await supabase
    .from("external_posts")
    .select("source_url, metrics")
    .not("source_url", "is", null)
    .or("platform.ilike.%youtube%,source_url.ilike.%youtube.com%,source_url.ilike.%youtu.be%")
    .order("posted_at", { ascending: false })
    .limit(2200);

  const viewsByVideoId = new Map<string, number>();
  ((metricsRows ?? []) as EpisodeMetricRow[]).forEach((row) => {
    const id = getYouTubeVideoId(row.source_url);
    if (!id) return;
    const views = Number(row?.metrics?.views ?? row?.metrics?.viewCount ?? 0);
    if (!Number.isFinite(views) || views <= 0) return;
    viewsByVideoId.set(id, Math.max(viewsByVideoId.get(id) ?? 0, views));
  });
  liveEpisodes.forEach((video) => viewsByVideoId.set(video.id, video.viewCount));

  const byVideoId = new Map<string, PodcastEpisodeCardData>();
  const noVideoId: PodcastEpisodeCardData[] = [];

  storedEpisodes.forEach((episode) => {
    const youtubeId =
      getYouTubeVideoId(episode.youtube_url) ??
      (/^[A-Za-z0-9_-]{11}$/.test(String(episode.slug ?? "")) ? String(episode.slug) : null);
    const item: PodcastEpisodeCardData = {
      id: episode.id,
      slug: episode.slug,
      title: episode.title,
      description: cleanDescription(episode.title, episode.description),
      publishedAt: episode.published_at ?? episode.updated_at ?? null,
      thumbnailUrl: episode.thumbnail_url || fallbackThumbnail(youtubeId),
      youtubeUrl: episode.youtube_url || (youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : null),
      audioUrl: episode.audio_url,
      durationSeconds: episode.duration_seconds,
      viewCount: youtubeId ? viewsByVideoId.get(youtubeId) ?? null : null
    };
    if (youtubeId) byVideoId.set(youtubeId, item);
    else noVideoId.push(item);
  });

  // Live YouTube data wins for title, description, date, thumbnail, duration and metrics.
  // Stored IDs/slugs are preserved when a historical database row already exists.
  liveEpisodes.forEach((video) => {
    const stored = byVideoId.get(video.id);
    byVideoId.set(video.id, {
      id: stored?.id || video.id,
      slug: stored?.slug || video.id,
      title: video.title || stored?.title || "Episodio",
      description: cleanDescription(video.title || stored?.title || "Episodio", video.description || stored?.description),
      publishedAt: video.publishedAt || stored?.publishedAt || null,
      thumbnailUrl: video.thumbnailUrl || stored?.thumbnailUrl || fallbackThumbnail(video.id),
      youtubeUrl: `https://www.youtube.com/watch?v=${video.id}`,
      audioUrl: stored?.audioUrl || null,
      durationSeconds: video.durationSeconds || stored?.durationSeconds || null,
      viewCount: video.viewCount || stored?.viewCount || null
    });
  });

  const uiEpisodes = [...byVideoId.values(), ...noVideoId]
    .filter((episode, index, rows) => {
      const key = String(episode.slug || episode.id).trim();
      return key && rows.findIndex((candidate) => String(candidate.slug || candidate.id).trim() === key) === index;
    })
    .sort((a, b) => safeDateToTs(b.publishedAt) - safeDateToTs(a.publishedAt));

  const featured = uiEpisodes[0] ?? null;
  const seriesSchema = buildPodcastSeriesJsonLd({
    canonicalPath: "/podcast",
    name: "Sin Pelos en el Micrófono",
    description: "Episodios completos, debates, historias e invitados de Sin Pelos en el Micrófono.",
    image: featured?.thumbnailUrl || DEFAULT_OG_IMAGE
  });

  return (
    <main className="podcast-page-shell">
      <Navbar />
      <section className="section podcast-page-section">
        <div className="container">
          <PodcastHubClient episodes={uiEpisodes} featuredEpisodeId={featured?.id ?? null} />
        </div>
      </section>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(seriesSchema) }} />
    </main>
  );
}
