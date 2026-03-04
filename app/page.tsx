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
import { EditorialStories } from "@/components/home/EditorialStories";
import { CommunityPreview } from "@/components/home/CommunityPreview";
import { EventsPreview } from "@/components/home/EventsPreview";
import { ViralSection } from "@/components/home/ViralSection";
import { SponsorBlock } from "@/components/home/SponsorBlock";
import { queryHomepageFeedPage, queryHomepageOverview, queryHomepageTrending } from "@/lib/homepageQueries";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "Sin Pelos en el Micrófono | Noticias, podcast, comunidad y viral",
  description:
    "Portada editorial de alto impacto para descubrir noticias, clips virales, podcast, comunidad y eventos en tiempo real.",
  alternates: { canonical: "/" }
};

export default async function HomePage() {
  const [overview, trending, feed] = await Promise.all([
    queryHomepageOverview(),
    queryHomepageTrending(),
    queryHomepageFeedPage(null, 12)
  ]);

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
          <PodcastBlock featured={overview.podcast.featured} clips={overview.podcast.clips} />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <FeedCentral initialItems={feed.items} initialCursor={feed.nextCursor} initialHasMore={feed.hasMore} />
        </div>
      </section>

      {overview.flags.showPromotions ? (
        <section className="section">
          <div className="container">
            <SponsorBlock title="SPONSOR DESTACADO" sponsor={overview.sponsors.mid} slot="mid" />
          </div>
        </section>
      ) : null}

      {overview.flags.showLatestBlog ? (
        <section className="section">
          <div className="container">
            <EditorialStories stories={overview.editorialStories} />
          </div>
        </section>
      ) : null}

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
          <ViralSection items={overview.viral} />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="home-media-newsletter-wrap">
            <NewsletterForm
              variant="cta"
              title="Recibe lo mas polemico antes que nadie"
              subtitle="Alertas de portada, contenido viral y picks editoriales sin ruido."
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
