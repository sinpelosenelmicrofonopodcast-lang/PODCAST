import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Logo } from "@/components/Logo";
import { GuestInvitePopup } from "@/components/GuestInvitePopup";
import { supabaseServer } from "@/lib/supabaseServer";

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
  const nowIso = new Date().toISOString();

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
      .order("display_order", { ascending: true })
      .limit(10)
  ]);

  const settings = (settingsData as HomeSettings | null) ?? {
    hero_kicker: "Plataforma 21+ · Sin censura ideologica",
    hero_title: "Sin Pelos en el Microfono",
    hero_subtitle: "Centro de contenido, noticias y comunidad real. Hablar claro no es opcion: es la norma.",
    show_latest_news: true,
    show_latest_blog: true,
    show_latest_community_post: true,
    show_upcoming_events: true,
    show_promotions: true
  };

  const posts = (youtubePosts ?? []) as ExternalPost[];
  const latestEpisode = posts.find((post) => !isShort(post));
  const promotions = ((promotionsRaw ?? []) as Promotion[])
    .filter((promo) => (!promo.starts_at || promo.starts_at <= nowIso) && (!promo.ends_at || promo.ends_at >= nowIso))
    .slice(0, 3);

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
            <h1 className="hero-title">{settings.hero_title}</h1>
            <p className="hero-sub">{settings.hero_subtitle}</p>
          </div>
        </div>
        <div className="home-cta-row">
          <Link className="button" href="/register">
            Entrar ahora
          </Link>
          <Link className="button secondary" href="/feed">
            Ver feed unificado
          </Link>
        </div>
      </section>

      <section className="section home-grid-wrap">
        <div className="container">
          <article className="card home-lead-card">
            <span className="badge">Último episodio completo</span>
            {latestEpisode?.media_url ? <img className="cover-wide" src={latestEpisode.media_url} alt={latestEpisode.title} /> : null}
            <h2 style={{ marginTop: 10 }}>{latestEpisode?.title ?? "Aún no hay episodios"}</h2>
            <div className="muted metrics-row">
              <span>Views: {formatMetric(latestEpisode?.metrics?.views)}</span>
              <span>Likes: {formatMetric(latestEpisode?.metrics?.likes)}</span>
              <span>{formatDate(latestEpisode?.posted_at)}</span>
            </div>
            {latestEpisode?.source_url ? (
              <a className="button secondary" href={latestEpisode.source_url} target="_blank" rel="noreferrer">
                Ver episodio
              </a>
            ) : (
              <Link className="button secondary" href="/feed">
                Ver feed
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
                  {latestNews?.cover_url ? <img className="cover-news" src={latestNews.cover_url} alt={latestNews.title} /> : null}
                  <h3>{latestNews?.title ?? "Aún no hay noticias"}</h3>
                  <p className="muted">{latestNews?.summary ?? "Publica noticias desde admin."}</p>
                  <Link className="button secondary" href={latestNews?.id ? `/noticias/${latestNews.id}` : "/noticias"}>
                    Leer noticia
                  </Link>
                </article>
              ) : null}

              {settings.show_latest_blog ? (
                <article className="card">
                  <span className="badge">Último blog</span>
                  {latestBlog?.cover_url ? <img className="cover-news" src={latestBlog.cover_url} alt={latestBlog.title} /> : null}
                  <h3>{latestBlog?.title ?? "Aún no hay blogs"}</h3>
                  <p className="muted">{latestBlog?.excerpt ?? "Próximamente."}</p>
                  <Link className="button secondary" href="/blog">
                    Ir al blog
                  </Link>
                </article>
              ) : null}

              {settings.show_latest_community_post ? (
                <article className="card">
                  <span className="badge">Último post</span>
                  <h3>{latestCommunity?.title ?? "Aún no hay actividad"}</h3>
                  <p className="muted">{latestCommunity?.body ?? "Crea el primer post en comunidad."}</p>
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
                  <h3>No hay eventos próximos</h3>
                  <p className="muted">Crea eventos desde Admin / Eventos.</p>
                  <Link className="button secondary" href="/eventos">
                    Ir a eventos
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
              <h2 className="section-title">Promociones y anuncios</h2>
              <Link className="muted" href="/admin/promotions">
                Gestionar desde admin
              </Link>
            </div>
            <div className="home-grid-ads">
              {(promotions as Promotion[] | null)?.map((promo) => (
                <a
                  key={promo.id}
                  className="card ad-slot ad-banner"
                  href={promo.cta_url ?? "#"}
                  target={promo.cta_url ? "_blank" : undefined}
                  rel={promo.cta_url ? "noreferrer" : undefined}
                  aria-disabled={!promo.cta_url}
                  onClick={(e) => {
                    if (!promo.cta_url) e.preventDefault();
                  }}
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
                    {promo.cta_url ? (
                      <span className="ad-banner-cta">{promo.cta_label ?? "Ver promoción"}</span>
                    ) : (
                      <span className="muted" style={{ fontSize: 12 }}>
                        Sin link configurado
                      </span>
                    )}
                  </div>
                </a>
              ))}
              {(!promotions || promotions.length === 0) ? (
                <article className="card ad-slot hero-ad">
                  <span className="badge">Disponible</span>
                  <h3>Espacio para marcas</h3>
                  <p className="muted">Activa promociones desde Admin / Promociones o solicita media kit.</p>
                  <a className="button secondary" href="mailto:sinpelosenelmicrofonopodcast@gmail.com?subject=Media%20Kit%20Sin%20Pelos">
                    Solicitar media kit
                  </a>
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
