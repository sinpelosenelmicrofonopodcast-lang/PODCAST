import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { GuestInvitePopup } from "@/components/GuestInvitePopup";
import { NewsletterForm } from "@/components/newsletter/NewsletterForm";
import { HeroNews } from "@/components/home/HeroNews";
import { TrendingBlock } from "@/components/home/TrendingBlock";
import { RegionNews } from "@/components/home/RegionNews";
import { PodcastBlock } from "@/components/home/PodcastBlock";
import { FeedCentral } from "@/components/home/FeedCentral";
import { CommunityPreview } from "@/components/home/CommunityPreview";
import { EventsPreview } from "@/components/home/EventsPreview";
import { SponsorBlock } from "@/components/home/SponsorBlock";
import { queryHomepageFeedPage, queryHomepageOverview, queryHomepageTrending } from "@/lib/homepageQueries";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "Sin Pelos en el Micrófono | Noticias, podcast y comunidad",
  description:
    "Portada editorial para descubrir noticias, podcast, comunidad y eventos con jerarquía clara y sin contenido repetido.",
  alternates: { canonical: "/" }
};

export default async function HomePage() {
  const [overview, trending] = await Promise.all([queryHomepageOverview(), queryHomepageTrending()]);

  const newsExcludeIds = new Set<string>();
  if (overview.hero.lead?.id) newsExcludeIds.add(overview.hero.lead.id);
  overview.hero.trending.forEach((item) => {
    if (item?.id) newsExcludeIds.add(item.id);
  });
  [
    ...overview.regions.puertoRico,
    ...overview.regions.texas,
    ...overview.regions.usa,
    ...overview.regions.mundo,
    ...trending.enTendencia.map((item) => ({ id: item.id })),
    ...trending.subiendo.map((item) => ({ id: item.id })),
    ...trending.viral.map((item) => ({ id: item.id }))
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
    <main className="app-enter home-media-v6">
      <GuestInvitePopup />
      <Navbar />

      {overview.flags.showLatestNews ? (
        <>
          <section className="section">
            <div className="container">
              <HeroNews
                kicker={overview.hero.kicker}
                title={overview.hero.title}
                subtitle={overview.hero.subtitle}
                lead={overview.hero.lead}
                trending={overview.hero.trending}
              />
            </div>
          </section>

          <section className="section">
            <div className="container">
              <TrendingBlock enTendencia={trending.enTendencia} subiendo={trending.subiendo} viral={trending.viral} />
            </div>
          </section>

          <section className="section">
            <div className="container">
              <RegionNews regions={overview.regions} />
            </div>
          </section>
        </>
      ) : null}

      <section className="section">
        <div className="container">
          <PodcastBlock featured={overview.podcast.featured} />
        </div>
      </section>

      <section className="section">
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
        <section className="section">
          <div className="container">
            <CommunityPreview threads={overview.community.threads} fallbackTopics={overview.community.fallbackTopics} />
          </div>
        </section>
      ) : null}

      {overview.flags.showEvents ? (
        <section className="section">
          <div className="container">
            <EventsPreview events={overview.events} />
          </div>
        </section>
      ) : null}

      <section className="section">
        <div className="container">
          <div className="home-media-newsletter-wrap">
            <NewsletterForm
              variant="cta"
              title="Recibe lo mas polemico antes que nadie"
              subtitle="Alertas de portada y picks editoriales sin ruido."
              buttonLabel="SUSCRIBIRME"
            />
          </div>
        </div>
      </section>

      {overview.flags.showPromotions ? (
        <section className="section">
          <div className="container">
            <SponsorBlock title="SPONSOR DE CIERRE" sponsor={overview.sponsors.footer} slot="footer" />
          </div>
        </section>
      ) : null}

      <Footer />
    </main>
  );
}
