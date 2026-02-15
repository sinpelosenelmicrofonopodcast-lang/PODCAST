import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Logo } from "@/components/Logo";
import { GuestInvitePopup } from "@/components/GuestInvitePopup";
import { supabaseServer } from "@/lib/supabaseServer";
import { ui } from "@/lib/i18n";
import { getServerLang } from "@/lib/i18nServer";
import { YouTubeInlinePlayer } from "@/components/YouTubeInlinePlayer";
import { getYouTubeVideoId } from "@/lib/youtube";
import { ConfessionSpotlight } from "@/components/home/ConfessionSpotlight";
import { RegionalTabs } from "@/components/home/RegionalTabs";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 600;

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

type NewsItem = {
  id: string;
  title: string;
  summary: string | null;
  cover_url: string | null;
  categories: string[] | null;
  published_at: string | null;
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

const dayWindowIso = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

function supabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export default async function HomePage() {
  const supabase = supabaseServer();
  const lang = getServerLang();
  const t = ui[lang];
  const nowIso = new Date().toISOString();
  const brandTitle = "Sin Pelos en el Micrófono";
  const since24h = dayWindowIso(24);

  const [
    { data: settingsData },
    { data: youtubePosts },
    { data: latestNews },
    { data: hotNewsList },
    { data: upcomingEvents },
    { data: promosHome }
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
      .from("news_items")
      .select("id, title, summary, published_at, cover_url, categories")
      .order("published_at", { ascending: false })
      .limit(24),
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
  const latestEpisode = posts.find((post) => !isShort(post)); // full episode only
  const clips = posts.filter((p) => isShort(p)).slice(0, 3);
  const latestYtId = latestEpisode?.source_url ? getYouTubeVideoId(latestEpisode.source_url) : null;
  const promotions = ((promosHome ?? []) as Promotion[]);

  // Engagement signals (fast, small queries).
  const [
    { count: newsToday },
    { count: threadsToday },
    { count: confessionsToday }
  ] = await Promise.all([
    supabase.from("news_items").select("id", { count: "exact", head: true }).gte("published_at", since24h),
    supabase.from("threads").select("id", { count: "exact", head: true }).gte("created_at", since24h),
    supabase.from("confessions").select("id", { count: "exact", head: true }).eq("level", "public").gte("created_at", since24h)
  ]);
  const newToday = Number(newsToday ?? 0) + Number(threadsToday ?? 0) + Number(confessionsToday ?? 0);

  // Confession spotlight (public only).
  const { data: confessionsSpot } = await supabase
    .from("confessions")
    .select("id, body, created_at, users(nickname)")
    .eq("level", "public")
    .order("created_at", { ascending: false })
    .limit(8);

  // "Most read" from page_visits (service role, aggregated only).
  let mostReadNewsIds: string[] = [];
  try {
    const svc = supabaseService();
    if (svc) {
      const { data: visits } = await svc
        .from("page_visits")
        .select("path, visited_at")
        .gte("visited_at", since24h)
        .like("path", "/noticias/%")
        .limit(2000);
      const counts = new Map<string, number>();
      (visits ?? []).forEach((v: any) => {
        const m = String(v.path ?? "").match(/^\/noticias\/([0-9a-f-]{36})/i);
        if (!m) return;
        counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
      });
      mostReadNewsIds = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([id]) => id);
    }
  } catch {
    mostReadNewsIds = [];
  }

  // News cards
  const hotNews = (hotNewsList ?? []) as NewsItem[];
  const mostReadNews = mostReadNewsIds.length
    ? hotNews.filter((n) => mostReadNewsIds.includes(n.id)).sort((a, b) => mostReadNewsIds.indexOf(a.id) - mostReadNewsIds.indexOf(b.id))
    : hotNews.slice(0, 4);

  // Regional slices
  const byRegion = (key: "PR" | "TX" | "USA" | "Mundo") =>
    hotNews.filter((n) => (n.categories ?? []).map((c) => c.toUpperCase()).includes(key.toUpperCase())).slice(0, 9);

  return (
    <main className="app-enter home-v3">
      <GuestInvitePopup />
      <Navbar />

      <section className="hero container home-hero">
        <span className="kicker">{settings.hero_kicker}</span>
        <div className="home-hero-top">
          <Logo size={90} animated />
          <div className="home-hero-copy">
            <h1 className="hero-title">{brandTitle}</h1>
            <h2 className="hero-headline">{t.home.heroHeadline}</h2>
            <p className="hero-sub">{t.home.heroSubheadline}</p>
            <div className="activity-pill" aria-label="Actividad de hoy">
              <span className="pill-dot" aria-hidden="true" />
              <span>{newToday} temas nuevos hoy</span>
            </div>
          </div>
        </div>
        <div className="home-cta-row">
          <Link className="button" href={latestYtId ? "#podcast" : "/feed"}>
            Último episodio
          </Link>
          <Link className="button secondary" href={latestNews?.id ? `/noticias/${latestNews.id}` : "/noticias"}>
            Noticia caliente
          </Link>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="home-section-head">
            <h2 className="section-title">Lo que está prendiendo</h2>
            <Link className="muted" href="/noticias">
              Ver más
            </Link>
          </div>
          <div className="home-grid-3" style={{ marginTop: 12 }}>
            <article className="card">
              <span className="badge">Más leído 24h</span>
              <h3 className="clamp-2" style={{ marginTop: 10 }}>
                {mostReadNews[0]?.title ?? "Sin datos aún"}
              </h3>
              <p className="muted clamp-3">{mostReadNews[0]?.summary ?? ""}</p>
              <Link className="button secondary" href={mostReadNews[0]?.id ? `/noticias/${mostReadNews[0].id}` : "/noticias"}>
                Leer
              </Link>
            </article>

            <article className="card">
              <span className="badge">Último episodio</span>
              <h3 className="clamp-2" style={{ marginTop: 10 }}>
                {latestEpisode?.title ?? t.home.noEpisodes}
              </h3>
              <div className="muted metrics-row">
                <span>Views: {formatMetric(latestEpisode?.metrics?.views)}</span>
                <span>Likes: {formatMetric(latestEpisode?.metrics?.likes)}</span>
                <span>{formatDate(latestEpisode?.posted_at)}</span>
              </div>
              <Link className="button secondary" href="#podcast">
                Ver aquí
              </Link>
            </article>

            <article className="card">
              <span className="badge">Noticia caliente</span>
              <h3 className="clamp-2" style={{ marginTop: 10 }}>
                {latestNews?.title ?? "Aún no hay noticias"}
              </h3>
              <p className="muted clamp-3">{latestNews?.summary ?? ""}</p>
              <Link className="button secondary" href={latestNews?.id ? `/noticias/${latestNews.id}` : "/noticias"}>
                Leer
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="home-section-head">
            <h2 className="section-title">Opinión del día</h2>
            <span className="muted">Exclusiva</span>
          </div>
          <article className="card home-opinion">
            <p className="opinion-text">
              Aquí no estamos para agradarte. Estamos para pensar sin miedo.
            </p>
            <div className="home-cta-row" style={{ marginTop: 12 }}>
              <Link className="button secondary" href="/foro">
                Abrir debate
              </Link>
              <Link className="button" href="/register">
                Entrar a la comunidad
              </Link>
            </div>
          </article>
        </div>
      </section>

      <section className="section" id="podcast">
        <div className="container">
          <div className="home-section-head">
            <h2 className="section-title">Podcast Protagónico</h2>
            <Link className="muted" href="/feed">
              Ver feed
            </Link>
          </div>
          <article className="card home-lead-card">
            <span className="badge">{t.home.latestFullEpisode}</span>
            {latestYtId ? (
              <YouTubeInlinePlayer
                videoId={latestYtId}
                title={latestEpisode?.title ?? null}
                thumbnailUrl={latestEpisode?.media_url ?? null}
                className="yt-inline"
              />
            ) : latestEpisode?.media_url ? (
              <img className="cover-wide" src={latestEpisode.media_url} alt={latestEpisode.title} />
            ) : null}
            <h3 className="clamp-2" style={{ marginTop: 10 }}>
              {latestEpisode?.title ?? t.home.noEpisodes}
            </h3>
            <div className="muted metrics-row">
              <span>Views: {formatMetric(latestEpisode?.metrics?.views)}</span>
              <span>Likes: {formatMetric(latestEpisode?.metrics?.likes)}</span>
              <span>{formatDate(latestEpisode?.posted_at)}</span>
            </div>
            {latestEpisode?.source_url ? (
              <a className="button secondary" href={latestEpisode.source_url} target="_blank" rel="noreferrer">
                Ver completo en YouTube
              </a>
            ) : null}
          </article>
          <div className="home-grid-3" style={{ marginTop: 12 }}>
            {clips.map((c) => (
              <article key={c.id} className="card clip-card">
                <span className="badge">Clip</span>
                <h3 className="clamp-2" style={{ marginTop: 10 }}>
                  {c.title}
                </h3>
                <div className="muted metrics-row">
                  <span>Views: {formatMetric(c.metrics?.views)}</span>
                  <span>Likes: {formatMetric(c.metrics?.likes)}</span>
                </div>
                {c.source_url ? (
                  <a className="button secondary" href={c.source_url} target="_blank" rel="noreferrer">
                    Ver clip
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <ConfessionSpotlight items={((confessionsSpot ?? []) as any[])} rotateSeconds={10} />
        </div>
      </section>

      <RegionalTabs
        items={{
          PR: byRegion("PR"),
          TX: byRegion("TX"),
          USA: byRegion("USA"),
          Mundo: byRegion("Mundo")
        }}
      />

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
                  <p className="muted">Cuando haya un evento, aparece aqui primero.</p>
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
