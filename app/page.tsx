import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { NewsletterForm } from "@/components/newsletter/NewsletterForm";
import { BrandHero } from "@/components/home/BrandHero";
import { HeroNews } from "@/components/home/HeroNews";
import { TrendingBlock } from "@/components/home/TrendingBlock";
import { RegionNews } from "@/components/home/RegionNews";
import { PodcastBlock } from "@/components/home/PodcastBlock";
import { FromMicBlock } from "@/components/home/FromMicBlock";
import { FeedCentral } from "@/components/home/FeedCentral";
import { CommunityPreview } from "@/components/home/CommunityPreview";
import { EventsPreview } from "@/components/home/EventsPreview";
import { SponsorBlock } from "@/components/home/SponsorBlock";
import { MidContentAdSlot } from "@/components/promotions/MidContentAdSlot";
import {
  queryHomepageFeedPage,
  queryHomepageOverview,
  queryHomepageTrending,
  type HomeNewsItem,
  type HomePodcastItem
} from "@/lib/homepageQueries";
import { queryPodcastEditorialPosts } from "@/lib/homeEditorialQueries";
import { getPublishedEpisodes } from "@/lib/seo/content";
import { fetchLatestYouTubeEpisodeFromFeed, fetchYouTubeVideos, isFullPodcastEpisode, type YouTubeVideo } from "@/lib/youtube";

export const revalidate = 120;
const CURRENT_NEWS_MAX_AGE_DAYS = 7;

export const metadata: Metadata = {
  title: "Sin Pelos en el Micrófono | Conversaciones que se quedan contigo",
  description:
    "Podcast, historias, noticias y editoriales nacidas de conversaciones reales. Puerto Rico, Texas y el mundo con contexto claro y sin libreto.",
  alternates: { canonical: "/" }
};

function isFreshApprovedNews(item: HomeNewsItem | null | undefined) {
  if (!item?.published_at) return false;
  const publishedAt = new Date(item.published_at).getTime();
  if (!Number.isFinite(publishedAt)) return false;
  const ageMs = Date.now() - publishedAt;
  return ageMs >= 0 && ageMs <= CURRENT_NEWS_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

function podcastFromVideo(video: YouTubeVideo): HomePodcastItem {
  return {
    id: video.id,
    title: video.title || "Último episodio",
    caption: video.description || null,
    source_url: `https://www.youtube.com/watch?v=${video.id}`,
    media_url: video.thumbnailUrl || `https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`,
    posted_at: video.publishedAt || null,
    platform: "YouTube",
    metrics: {
      views: video.viewCount || 0,
      likes: video.likeCount || 0,
      comments: video.commentCount || 0,
      durationSeconds: video.durationSeconds || 0,
      isShort: false
    }
  };
}

async function latestPodcastFromYouTube(): Promise<HomePodcastItem | null> {
  try {
    const videos = await fetchYouTubeVideos(80, { revalidateSeconds: 120 });
    const video = videos.find(isFullPodcastEpisode);
    if (video) return podcastFromVideo(video);
  } catch {
    // Data API can hit quota or temporary provider errors. Fall through to the public channel feed.
  }

  try {
    const feedEpisode = await fetchLatestYouTubeEpisodeFromFeed({ revalidateSeconds: 120 });
    return feedEpisode ? podcastFromVideo(feedEpisode) : null;
  } catch {
    return null;
  }
}

async function latestStoredPodcast(): Promise<HomePodcastItem | null> {
  try {
    const episode = (await getPublishedEpisodes(1))[0];
    if (!episode) return null;
    return {
      id: episode.slug || episode.id,
      title: episode.title || "Último episodio",
      caption: episode.description || null,
      source_url: episode.youtube_url || episode.audio_url || `/podcast/${encodeURIComponent(episode.slug || episode.id)}`,
      media_url: episode.thumbnail_url || null,
      posted_at: episode.published_at || episode.updated_at || null,
      platform: episode.youtube_url ? "YouTube" : episode.audio_url ? "Podcast" : "Sin Pelos",
      metrics: episode.duration_seconds ? { durationSeconds: episode.duration_seconds, isShort: false } : null
    };
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const [overview, trending, podcastEditorials, livePodcast, storedPodcast] = await Promise.all([
    queryHomepageOverview(),
    queryHomepageTrending(),
    queryPodcastEditorialPosts(3),
    latestPodcastFromYouTube(),
    latestStoredPodcast()
  ]);

  const featuredPodcast = livePodcast ?? overview.podcast.featured ?? storedPodcast;
  const approvedHeroLead = isFreshApprovedNews(overview.hero.lead) ? overview.hero.lead : null;
  const approvedHeroTrending = overview.hero.trending.filter(isFreshApprovedNews);
  const freshRegions = {
    puertoRico: overview.regions.puertoRico.filter(isFreshApprovedNews),
    texas: overview.regions.texas.filter(isFreshApprovedNews),
    usa: overview.regions.usa.filter(isFreshApprovedNews),
    mundo: overview.regions.mundo.filter(isFreshApprovedNews)
  };

  const freshCandidates = [
    ...approvedHeroTrending,
    ...freshRegions.puertoRico,
    ...freshRegions.texas,
    ...freshRegions.usa,
    ...freshRegions.mundo
  ].sort((a, b) => new Date(b.published_at ?? "").getTime() - new Date(a.published_at ?? "").getTime());
  const freshHeroLead = approvedHeroLead ?? freshCandidates[0] ?? null;
  const seenHeroIds = new Set<string>(freshHeroLead ? [freshHeroLead.id] : []);
  const freshHeroTrending = [...approvedHeroTrending, ...freshCandidates].filter((item) => {
    if (seenHeroIds.has(item.id)) return false;
    seenHeroIds.add(item.id);
    return true;
  }).slice(0, 3);

  const freshNewsIds = new Set<string>();
  if (freshHeroLead?.id) freshNewsIds.add(freshHeroLead.id);
  freshHeroTrending.forEach((item) => freshNewsIds.add(item.id));
  [...freshRegions.puertoRico, ...freshRegions.texas, ...freshRegions.usa, ...freshRegions.mundo].forEach((item) =>
    freshNewsIds.add(item.id)
  );

  const freshTrending = {
    enTendencia: trending.enTendencia.filter((item) => freshNewsIds.has(item.id)),
    subiendo: trending.subiendo.filter((item) => freshNewsIds.has(item.id)),
    viral: trending.viral.filter((item) => freshNewsIds.has(item.id))
  };

  const hasFreshCoverage = Boolean(freshHeroLead) || freshHeroTrending.length > 0;
  const hasFreshTrending = freshTrending.enTendencia.length + freshTrending.subiendo.length + freshTrending.viral.length > 0;
  const hasFreshRegions =
    freshRegions.puertoRico.length + freshRegions.texas.length + freshRegions.usa.length + freshRegions.mundo.length > 0;

  const newsExcludeIds = new Set<string>(freshNewsIds);
  [...freshTrending.enTendencia, ...freshTrending.subiendo, ...freshTrending.viral].forEach((item) => {
    if (item?.id) newsExcludeIds.add(item.id);
  });

  const communityExcludeIds = new Set<string>();
  overview.community.threads.forEach((thread) => {
    if (thread?.id) communityExcludeIds.add(thread.id);
  });

  const feedExcludeIds = [
    ...Array.from(newsExcludeIds).map((id) => `news:${id}`),
    ...Array.from(communityExcludeIds).map((id) => `community:${id}`)
  ];
  const feed = await queryHomepageFeedPage(null, 8, feedExcludeIds);

  return (
    <main className="app-enter home-media-v6 spm-media-hub">
      <Navbar />
      <BrandHero />

      <section className="section spm-podcast-zone spm-section-breathe">
        <div className="container">
          <PodcastBlock featured={featuredPodcast} />
        </div>
      </section>

      {overview.flags.showLatestNews && hasFreshCoverage ? (
        <section className="section spm-news-zone spm-section-breathe">
          <div className="container">
            <HeroNews
              kicker="SPM NEWS · SOLO LO QUE MERECE TU TIEMPO"
              title="Lo que está pasando"
              subtitle="Noticias revisadas, contexto claro y cero relleno. Si no hay nada que valga la pena, no llenamos la portada por llenar."
              lead={freshHeroLead}
              trending={freshHeroTrending}
            />
          </div>
        </section>
      ) : null}

      {hasFreshTrending ? (
        <section className="section spm-section-breathe">
          <div className="container">
            <TrendingBlock enTendencia={freshTrending.enTendencia} subiendo={freshTrending.subiendo} viral={freshTrending.viral} />
          </div>
        </section>
      ) : null}

      <section className="section spm-ad-zone spm-section-breathe" aria-label="Sponsor destacado">
        <div className="container">
          <MidContentAdSlot placement="home_featured" section="home" className="home-featured-ad-slot" />
        </div>
      </section>

      {podcastEditorials.length ? (
        <section className="section spm-editorial-zone spm-section-breathe">
          <div className="container"><FromMicBlock posts={podcastEditorials} /></div>
        </section>
      ) : null}

      {hasFreshRegions ? (
        <section className="section spm-section-breathe">
          <div className="container"><RegionNews regions={freshRegions} /></div>
        </section>
      ) : null}

      <section className="section spm-ad-zone spm-section-breathe" aria-label="Patrocinador">
        <div className="container">
          <MidContentAdSlot placement="home_mid" section="home" className="home-mid-ad-slot" compact />
        </div>
      </section>

      <section className="section spm-feed-zone spm-section-breathe">
        <div className="container">
          <FeedCentral initialItems={feed.items} initialCursor={feed.nextCursor} initialHasMore={feed.hasMore} excludeIds={feedExcludeIds} />
        </div>
      </section>

      {overview.flags.showCommunity ? (
        <>
          <section className="section spm-ad-zone spm-section-breathe" aria-label="Community Partner">
            <div className="container"><MidContentAdSlot placement="community_partner" section="home" className="home-mid-ad-slot" compact /></div>
          </section>
          <section className="section spm-community-zone spm-section-breathe">
            <div className="container"><CommunityPreview threads={overview.community.threads} fallbackTopics={overview.community.fallbackTopics} /></div>
          </section>
        </>
      ) : null}

      {overview.flags.showEvents ? (
        <section className="section spm-events-zone spm-section-breathe">
          <div className="container"><EventsPreview events={overview.events} /></div>
        </section>
      ) : null}

      <section className="section spm-newsletter-zone spm-section-breathe">
        <div className="container">
          <div className="home-media-newsletter-wrap">
            <NewsletterForm variant="cta" title="Lo bueno no debería depender del algoritmo" subtitle="Episodios, historias y lo que de verdad vale la pena — directo a tu correo." buttonLabel="QUIERO ESTAR AL DÍA" />
          </div>
        </div>
      </section>

      {overview.flags.showPromotions ? (
        <section className="section spm-sponsor-zone spm-section-breathe">
          <div className="container"><SponsorBlock title="CON LOS QUE CREEN EN ESTO" sponsor={overview.sponsors.footer} slot="footer" /></div>
        </section>
      ) : null}

      <Footer />
    </main>
  );
}
