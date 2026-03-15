import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { buildSeoMetadata } from "@/lib/seo/meta";
import { getPublishedEpisodes } from "@/lib/seo/content";
import { buildPodcastSeriesJsonLd, jsonLdScript } from "@/lib/seo/jsonld";
import { DEFAULT_OG_IMAGE } from "@/lib/seo/constants";
import { supabaseServer } from "@/lib/supabaseServer";
import { getYouTubeVideoId } from "@/lib/youtube";
import { PodcastHubClient, type PodcastEpisodeCardData } from "@/components/podcast/PodcastHubClient";

export const revalidate = 180;

export async function generateMetadata(): Promise<Metadata> {
  const latest = (await getPublishedEpisodes(1))[0];
  return buildSeoMetadata({
    title: "Podcast | Episodios Sin Pelos en el Micrófono",
    description:
      "Todos los episodios completos de Sin Pelos en el Micrófono con búsqueda rápida, filtros por tema y acceso directo a YouTube.",
    path: "/podcast",
    image: latest?.thumbnail_url || DEFAULT_OG_IMAGE
  });
}

type EpisodeMetricRow = {
  source_url: string | null;
  metrics: {
    views?: number;
    viewCount?: number;
  } | null;
};

function dedupeEpisodes(rows: Awaited<ReturnType<typeof getPublishedEpisodes>>) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const slug = String(row.slug ?? "").trim();
    const id = String(row.id ?? "").trim();
    const key = slug || id;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function safeDateToTs(value?: string | null) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export default async function PodcastPage() {
  const supabase = supabaseServer();
  const episodes = dedupeEpisodes(await getPublishedEpisodes(400));

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
    const prev = viewsByVideoId.get(id) ?? 0;
    if (views > prev) viewsByVideoId.set(id, views);
  });

  const uiEpisodes: PodcastEpisodeCardData[] = episodes.map((episode) => {
    const youtubeId = getYouTubeVideoId(episode.youtube_url) ?? (/^[a-zA-Z0-9_-]{11}$/.test(episode.slug) ? episode.slug : null);
    return {
      id: episode.id,
      slug: episode.slug,
      title: episode.title,
      description: episode.description,
      publishedAt: episode.published_at ?? episode.updated_at ?? null,
      thumbnailUrl: episode.thumbnail_url,
      youtubeUrl: episode.youtube_url,
      audioUrl: episode.audio_url,
      durationSeconds: episode.duration_seconds,
      viewCount: youtubeId ? viewsByVideoId.get(youtubeId) ?? null : null
    };
  });

  const featured = [...uiEpisodes].sort((a, b) => safeDateToTs(b.publishedAt) - safeDateToTs(a.publishedAt))[0] ?? null;

  const seriesSchema = buildPodcastSeriesJsonLd({
    canonicalPath: "/podcast",
    name: "Sin Pelos en el Micrófono",
    description: "Episodios completos, debates y análisis directos de Sin Pelos en el Micrófono.",
    image: featured?.thumbnailUrl || DEFAULT_OG_IMAGE
  });

  return (
    <main>
      <Navbar />
      <section className="section">
        <div className="container">
          <PodcastHubClient episodes={uiEpisodes} featuredEpisodeId={featured?.id ?? null} />
        </div>
      </section>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(seriesSchema) }} />
    </main>
  );
}
