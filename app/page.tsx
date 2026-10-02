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
import { queryHomepageFeedPage, queryHomepageOverview, queryHomepageTrending, type HomeNewsItem } from "@/lib/homepageQueries";
import { queryPodcastEditorialPosts } from "@/lib/homeEditorialQueries";

export const revalidate = 120;

const CURRENT_NEWS_MAX_AGE_DAYS = 7;

export const metadata: Metadata = {
  title: "Sin Pelos en el Micrófono | Conversaciones que se quedan contigo",
  description:
    "Podcast, historias y editoriales nacidas de conversaciones reales. Lo que nos impactó, lo que aprendimos y lo que vale la pena seguir hablando.",
  alternates: { canonical: "/" }
};

function isFreshApprovedNews(item: HomeNewsItem | null | undefined) {
  if (!item?.published_at) return false;
  const publishedAt = new Date(item.published_at).getTime();
  if (!Number.isFinite(publishedAt)) return false;
  const ageMs = Date.now() - publishedAt;
  return ageMs >= 0 && ageMs <= CURRENT_NEWS_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

export default async function HomePage() {
  const [overview, trending, podcastEditorials] = await Promise.all([
    queryHomepageOverview(),
    queryHomepageTrending(),
    queryPodcastEditorialPosts(3)
  ]);

  const freshHeroLead = isFreshApprovedNews(overview.hero.lead) ? overview.hero.lead : null;
  const freshHeroTrending = overview.hero.trending.filter(isFreshApprovedNews);
  const freshRegions = {
    puertoRico: overview.regions.puertoRico.filter(isFreshApprovedNews),
    texas: overview.regions.texas.filter(isFreshApprovedNews),
    usa: overview.regions.usa.filter(isFreshApprovedNews),
    mundo: overview.regions.mundo.filter(isFreshApprovedNews)
  };

  const freshNewsIds = new Set<string>();
  if (freshHeroLead?.id) freshNewsIds.add(freshHeroLead.id);
  freshHeroTrending.forEach((item) => freshNewsIds.add(item.id));
  [
    ...freshRegions.puertoRico,
    ...freshRegions.texas,
    ...freshRegions.usa,
    ...freshRegions.mundo
  ].forEach((item) => freshNewsIds.add(item.id));

  const freshTrending = {
    enTendencia: trending.enTendencia.filter((item) => freshNewsIds.has(item.id)),
    subiendo: trending.subiendo.filter((item) => freshNewsIds.has(item.id)),
    viral: trending.viral.filter((item) => freshNewsIds.has(item.id))
  };

  const hasFreshCoverage = Boolean(freshHeroLead) || freshHeroTrending.length > 0;
  const hasFreshTrending =
    freshTrending.enTendencia.length + freshTrending.subiendo.length + freshTrending.viral.length > 0;
  const hasFreshRegions =
    freshRegions.puertoRico.length + freshRegions.texas.length + freshRegions.usa.length + freshRegions.mundo.length > 0;

  const newsExcludeIds = new Set<string>(freshNewsIds);
  [
    ...freshTrending.enTendencia,
    ...freshTrending.subiendo,
    ...freshTrending.viral
  ].forEach((item) => {
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
          <PodcastBlock featured={overview.podcast.featured} />
        </div>
      </section>

      {podcastEditorials.length ? (
        <section className="section spm-editorial-zone spm-section-breathe">
          <div className="container">
            <FromMicBlock posts={podcastEditorials} />
          </div>
        </section>
      ) : null}

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
            <TrendingBlock
              enTendencia={freshTrending.enTendencia}
              subiendo={freshTrending.subiendo}
              viral={freshTrending.viral}
            />
          </div>
        </section>
      ) : null}

      {hasFreshRegions ? (
        <section className="section spm-section-breathe">
          <div className="container">
            <RegionNews regions={freshRegions} />
          </div>
        </section>
      ) : null}

      <section className="section spm-feed-zone spm-section-breathe">
        <div className="container">
          <FeedCentral
            initialItems={feed.items}
            initialCursor={feed.nextCursor}
            initialHasMore={feed.hasMore}
            excludeIds={feedExcludeIds}
          />
        </div>
      </section>

      {overview.flags.showCommunity ? (
        <section className="section spm-community-zone spm-section-breathe">
          <div className="container">
            <CommunityPreview threads={overview.community.threads} fallbackTopics={overview.community.fallbackTopics} />
          </div>
        </section>
      ) : null}

      {overview.flags.showEvents ? (
        <section className="section spm-events-zone spm-section-breathe">
          <div className="container">
            <EventsPreview events={overview.events} />
          </div>
        </section>
      ) : null}

      <section className="section spm-newsletter-zone spm-section-breathe">
        <div className="container">
          <div className="home-media-newsletter-wrap">
            <NewsletterForm
              variant="cta"
              title="Lo bueno no debería depender del algoritmo"
              subtitle="Episodios, historias y lo que de verdad vale la pena — directo a tu correo."
              buttonLabel="QUIERO ESTAR AL DÍA"
            />
          </div>
        </div>
      </section>

      {overview.flags.showPromotions ? (
        <section className="section spm-sponsor-zone spm-section-breathe">
          <div className="container">
            <SponsorBlock title="CON LOS QUE CREEN EN ESTO" sponsor={overview.sponsors.footer} slot="footer" />
          </div>
        </section>
      ) : null}

      <Footer />
    </main>
  );
}
