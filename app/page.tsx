import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Logo } from "@/components/Logo";
import { GuestInvitePopup } from "@/components/GuestInvitePopup";
import { supabaseServer } from "@/lib/supabaseServer";
import { ui } from "@/lib/i18n";
import { getServerLang } from "@/lib/i18nServer";

export const revalidate = 86400;

type ExternalPost = {
  id: string;
  title: string;
  source_url: string;
  media_url: string | null;
  posted_at: string;
  metrics: {
    views?: number;
    likes?: number;
    durationSeconds?: number;
    isShort?: boolean;
  } | null;
};

type HomeSettings = {
  hero_kicker: string;
  hero_title: string;
  hero_subtitle: string;
  show_latest_news: boolean;
  show_latest_blog: boolean;
  show_latest_community_post: boolean;
  show_upcoming_events: boolean;
  show_promotions: boolean;
};

type LiveEvent = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string | null;
  join_url: string | null;
};

type Promotion = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
};

const formatDate = (value?: string | null) => {
  if (!value) return "";
  return new Date(value).toLocaleDateString("es-PR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleString("es-PR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const formatMetric = (value?: number) => {
  if (typeof value !== "number") return "-";
  return new Intl.NumberFormat("es-PR", { notation: "compact" }).format(value);
};

const isShort = (post: ExternalPost) => {
  const metrics = post.metrics ?? {};
  if (metrics.isShort === true) return true;
  const duration = Number(metrics.durationSeconds);
  return !Number.isNaN(duration) && duration > 0 && duration <= 60;
};

export default async function HomePage() {
  const supabase = supabaseServer();
  const lang = getServerLang();
  const t = ui[lang];
  const nowIso = new Date().toISOString();
  const brandTitle = "Sin Pelos en el Micrófono";

  const [
    { data: settingsData },
    { data: youtubePosts },
    { data: latestNews },
    { data: latestBlog },
    { data: latestCommunity },
    { data: upcomingEvents },
    { data: promotionsRaw }
  ] = await Promise.all([
    supabase
      .from("home_settings")
      .select(
        "hero_kicker, hero_title, hero_subtitle, show_latest_news, show_latest_blog, show_latest_community_post, show_upcoming_events, show_promotions"
      )
      .order("updated_at", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("external_posts")
      .select("id, title, source_url, media_url, posted_at, metrics")
      .eq("platform", "YouTube")
      .order("posted_at", { ascending: false })
      .limit(30),
    supabase
      .from("news_items")
      .select("id, title, summary, published_at, cover_url")
      .order("published_at", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("blog_posts")
      .select("id, title, excerpt, created_at, cover_url")
      .order("created_at", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("threads")
      .select("id, title, body, created_at")
      .eq("space", "community")
      .order("created_at", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("live_events")
      .select("id, title, description, starts_at, join_url")
      .gte("starts_at", nowIso)
      .order("starts_at", { ascending: true })
      .limit(3),
    supabase
      .from("promotions")
      .select("id, title, description, image_url, cta_label, cta_url, starts_at, ends_at")
      .eq("placement", "home")
      .eq("is_active", true)
      // Keep filtering in SQL so we don't depend on string comparisons.
      .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
      .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
      .order("display_order", { ascending: true })
      .limit(3)
  ]);

  const settings = (settingsData as HomeSettings | null) ?? {
    hero_kicker: "Plataforma 21+ · Sin censura ideológica",
    hero_title: "Sin Pelos en el Micrófono",
    hero_subtitle: "Centro de contenido, noticias y comunidad real. Hablar claro no es opción: es la norma.",
    show_latest_news: true,
    show_latest_blog: true,
    show_latest_community_post: true,
    show_upcoming_events: true,
    show_promotions: true
  };

  const posts = (youtubePosts ?? []) as ExternalPost[];
  const latestEpisode = posts.find((post) => !isShort(post));
  const promotions = ((promotionsRaw ?? []) as Promotion[]);

  const hasLatestSection = settings.show_latest_news || settings.show_latest_blog || settings.show_latest_community_post;

  return (
    <main className="app-enter home-v2">
      <GuestInvitePopup />
      <Navbar />

      <section className="hero container home-hero">
        <span className="kicker">{settings.hero_kicker}</span>
        <div className="home-hero-top">
          <Logo size={90} animated />
          <div>
            <h1 className="hero-title">{brandTitle}</h1>
            <p className="hero-sub">{settings.hero_subtitle}</p>
          </div>
        </div>
        <div className="home-cta-row">
          <Link className="button" href="/register">
            {t.home.enterNow}
          </Link>
          <Link className="button secondary" href="/feed">
            {t.home.viewUnifiedFeed}
          </Link>
        </div>
      </section>

      <section className="section home-grid-wrap">
        <div className="container">
          <article className="card home-lead-card">
            <span className="badge">{t.home.latestFullEpisode}</span>
            {latestEpisode?.media_url ? <img className="cover-wide" src={latestEpisode.media_url} alt={latestEpisode.title} /> : null}
            <h2 style={{ marginTop: 10 }}>{latestEpisode?.title ?? t.home.noEpisodes}</h2>
            <div className="muted metrics-row">
              <span>Views: {formatMetric(latestEpisode?.metrics?.views)}</span>
              <span>Likes: {formatMetric(latestEpisode?.metrics?.likes)}</span>
              <span>{formatDate(latestEpisode?.posted_at)}</span>
            </div>
            {latestEpisode?.source_url ? (
              <a className="button secondary" href={latestEpisode.source_url} target="_blank" rel="noreferrer">
                {t.home.viewEpisode}
              </a>
            ) : (
              <Link className="button secondary" href="/feed">
                {t.home.viewFeed}
              </Link>
            )}
          </article>
        </div>
      </section>

      {hasLatestSection ? (
        <section className="section">
          <div className="container">
            <div className="home-section-head">
              <h2 className="section-title">Lo último</h2>
            </div>
            <div className="home-grid-3">
              {settings.show_latest_news ? (
                <article className="card home-news-card">
                  <span className="badge">Última noticia</span>
                  {latestNews?.cover_url ? (
                    <img className="home-latest-thumb" src={latestNews.cover_url} alt={latestNews.title} />
                  ) : null}
                  <h3 className="clamp-2">{latestNews?.title ?? "Aún no hay noticias"}</h3>
                  <p className="muted clamp-3">{latestNews?.summary ?? "Próximamente."}</p>
                  <Link className="button secondary" href={latestNews?.id ? `/noticias/${latestNews.id}` : "/noticias"}>
                    Leer noticia
                  </Link>
                </article>
              ) : null}

              {settings.show_latest_blog ? (
                <article className="card">
                  <span className="badge">Último blog</span>
                  {latestBlog?.cover_url ? <img className="home-latest-thumb" src={latestBlog.cover_url} alt={latestBlog.title} /> : null}
                  <h3 className="clamp-2">{latestBlog?.title ?? "Aún no hay blogs"}</h3>
                  <p className="muted clamp-3">{latestBlog?.excerpt ?? "Próximamente."}</p>
                  <Link className="button secondary" href="/blog">
                    Ir al blog
                  </Link>
                </article>
              ) : null}

              {settings.show_latest_community_post ? (
                <article className="card">
                  <span className="badge">Último post</span>
                  <h3 className="clamp-2">{latestCommunity?.title ?? "Aún no hay actividad"}</h3>
                  <p className="muted clamp-3">{latestCommunity?.body ?? "Crea el primer post en comunidad."}</p>
                  <Link className="button secondary" href="/community">
                    Ir a comunidad
                  </Link>
                </article>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {settings.show_upcoming_events ? (
        <section className="section">
          <div className="container">
            <div className="home-section-head">
              <h2 className="section-title">Próximos eventos</h2>
              <Link className="muted" href="/eventos">
                Ver todos
              </Link>
            </div>
            <div className="home-grid-3">
              {(upcomingEvents as LiveEvent[] | null)?.map((event) => (
                <article key={event.id} className="card">
                  <span className="badge">Evento en vivo</span>
                  <h3>{event.title}</h3>
                  <p className="muted">{event.description ?? "Debate o audio room para adultos."}</p>
                  <p className="muted" style={{ marginTop: -6 }}>
                    {formatDateTime(event.starts_at)}
                  </p>
                  {event.join_url ? (
                    <a className="button secondary" href={event.join_url} target="_blank" rel="noreferrer">
                      Reservar / entrar
                    </a>
                  ) : (
                    <Link className="button secondary" href="/eventos">
                      Ver evento
                    </Link>
                  )}
                </article>
              ))}
              {(!upcomingEvents || upcomingEvents.length === 0) ? (
                <article className="card">
                  <span className="badge">Sin agenda</span>
                  <h3>{t.home.noUpcomingEventsTitle}</h3>
                  <p className="muted">{t.home.noUpcomingEventsBody}</p>
                  <Link className="button secondary" href="/eventos">
                    {t.home.goToEvents}
                  </Link>
                </article>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {settings.show_promotions ? (
        <section className="section ad-zone-wrap">
          <div className="container">
            <div className="home-section-head">
              <h2 className="section-title">{t.home.promotions}</h2>
            </div>
            <div className="home-grid-ads">
              {(promotions as Promotion[] | null)?.map((promo) => (
                promo.cta_url ? (
                  <a
                    key={promo.id}
                    className="card ad-slot ad-banner"
                    href={promo.cta_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="badge">Promoción</span>
                    {promo.image_url ? (
                      <div className="ad-banner-media" style={{ backgroundImage: `url(${promo.image_url})` }} aria-hidden="true" />
                    ) : (
                      <div className="ad-banner-media ad-banner-fallback" aria-hidden="true" />
                    )}
                    <div className="ad-banner-overlay" aria-hidden="true" />
                    <div className="ad-banner-body">
                      <h3 style={{ marginTop: 0 }}>{promo.title}</h3>
                      <p className="muted" style={{ marginBottom: 0 }}>
                        {promo.description ?? "Promoción destacada"}
                      </p>
                      <span className="ad-banner-cta">{promo.cta_label ?? "Ver promoción"}</span>
                    </div>
                  </a>
                ) : (
                  <article key={promo.id} className="card ad-slot ad-banner" aria-disabled="true">
                    <span className="badge">Promoción</span>
                    {promo.image_url ? (
                      <div className="ad-banner-media" style={{ backgroundImage: `url(${promo.image_url})` }} aria-hidden="true" />
                    ) : (
                      <div className="ad-banner-media ad-banner-fallback" aria-hidden="true" />
                    )}
                    <div className="ad-banner-overlay" aria-hidden="true" />
                    <div className="ad-banner-body">
                      <h3 style={{ marginTop: 0 }}>{promo.title}</h3>
                      <p className="muted" style={{ marginBottom: 0 }}>
                        {promo.description ?? "Promoción destacada"}
                      </p>
                      <span className="muted" style={{ fontSize: 12 }}>
                        Sin link configurado
                      </span>
                    </div>
                  </article>
                )
              ))}
              {(!promotions || promotions.length === 0) ? (
                <article className="card ad-slot hero-ad">
                  <span className="badge">Disponible</span>
                  <h3>{t.home.brandSlotTitle}</h3>
                  <p className="muted">{t.home.brandSlotBody}</p>
                  <Link className="button secondary" href="/publicidad">
                    {t.home.requestMediaKit}
                  </Link>
                </article>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <Footer />
    </main>
  );
}
