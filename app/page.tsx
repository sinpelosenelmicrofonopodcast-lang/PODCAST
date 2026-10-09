import type { Metadata } from "next";
import Link from "next/link";
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


export const revalidate = 120;
const CURRENT_NEWS_MAX_AGE_DAYS = 7;

export const metadata: Metadata = {
  title: "Sin Pelos en el Micrófono | Podcast en Killeen, Texas",
  description:
    "Podcast de Bebo y Bito desde Killeen, Central Texas. Entrevistas, música, cultura, noticias y vivencias reales de Puerto Rico y Texas.",
  alternates: { canonical: "/" }
};

function isFreshApprovedNews(item: HomeNewsItem | null | undefined) {
  if (!item?.published_at) return false;
  const publishedAt = new Date(item.published_at).getTime();
  if (!Number.isFinite(publishedAt)) return false;
  const ageMs = Date.now() - publishedAt;
  return ageMs >= 0 && ageMs <= CURRENT_NEWS_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
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
      posted_at: episode.published_at || null,
      platform: episode.youtube_url ? "YouTube" : episode.audio_url ? "Podcast" : "Sin Pelos",
      metrics: episode.duration_seconds ? { durationSeconds: episode.duration_seconds, isShort: false } : null
    };
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const [overview, trending, podcastEditorials, storedPodcast] = await Promise.all([
    queryHomepageOverview(),
    queryHomepageTrending(),
    queryPodcastEditorialPosts(3),
    latestStoredPodcast()
  ]);

  const featuredPodcast = storedPodcast;
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
      <section className="section spm-section-breathe" aria-labelledby="killeen-local-heading"><div className="container">
        <div className="card" style={{ padding: "clamp(20px,4vw,32px)" }}>
          <p className="page-kicker">DESDE KILLEEN · CENTRAL TEXAS</p>
          <h2 id="killeen-local-heading" className="section-title">PODCAST LATINO EN KILLEEN, TEXAS</h2>
          <p className="muted">Bebo y Bito conectan historias de Puerto Rico y Texas: entrevistas, negocios, cultura y vivencias de nuestra comunidad en Central Texas.</p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link className="button" href="/killeen">CONOCE SIN PELOS EN TEXAS</Link>
            <Link className="button secondary" href="/podcast/ggVum3q0kss">EL PARCE DE KILLEEN</Link>
            <Link className="button secondary" href="/podcast/3xo-EI-vzy0">COMPRANDO CASA EN TEXAS</Link>
          </div>
        </div>
      </div></section>
      <section className="section spm-section-breathe" aria-label="Trabaja con Sin Pelos">
        <div className="container">
          <div className="card" style={{padding:"clamp(20px,4vw,34px)"}}>
            <p className="page-kicker">MÁS QUE UN PODCAST · B&B ENTERTAINMENT HUB</p>
            <h2 className="section-title">¿TIENES UN NEGOCIO O UN PROYECTO?</h2>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,230px),1fr))",gap:14}}>
              <div><h3>Producción audiovisual</h3><p className="muted">Videos, fotos, entrevistas y cobertura de eventos.</p><Link className="button" href="/servicios">SOLICITAR COTIZACIÓN</Link></div>
              <div><h3>Publicidad y patrocinio</h3><p className="muted">Haz que tu marca sea parte de la conversación.</p><Link className="button secondary" href="/media-kit">VER PAQUETES</Link></div>
              <div><h3>Eventos y comunidad</h3><p className="muted">Comparte tu evento o actividad con nuestro equipo.</p><Link className="button secondary" href="/eventos/proponer">PROPONER EVENTO</Link></div>
            </div>
          </div>
        </div>
      </section>


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
