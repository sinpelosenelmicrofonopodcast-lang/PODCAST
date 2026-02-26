import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { YouTubeInlinePlayer } from "@/components/YouTubeInlinePlayer";
import { GuestInvitePopup } from "@/components/GuestInvitePopup";
import { ConfessionSpotlight } from "@/components/home/ConfessionSpotlight";
import { RegionalTabs } from "@/components/home/RegionalTabs";
import { NewsletterForm } from "@/components/newsletter/NewsletterForm";
import { supabaseServer } from "@/lib/supabaseServer";
import { getYouTubeVideoId } from "@/lib/youtube";

export const revalidate = 120;

type ExternalPost = {
  id: string;
  title: string;
  caption: string | null;
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

type NewsItem = {
  id: string;
  title: string;
  summary: string | null;
  cover_url: string | null;
  categories: string[] | null;
  published_at: string | null;
};

type Promotion = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  target_sections?: string[] | null;
};

type Thread = {
  id: string;
  title: string;
  body: string | null;
  created_at: string | null;
};

const formatDate = (value?: string | null) => {
  if (!value) return "";
  return new Date(value).toLocaleDateString("es-PR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
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
  if (!Number.isNaN(duration) && duration > 0 && duration <= 180) return true;
  const sourceUrl = String(post.source_url ?? "").toLowerCase();
  if (sourceUrl.includes("youtube.com/shorts/")) return true;
  const text = `${post.title ?? ""} ${post.caption ?? ""}`.toLowerCase();
  if (
    text.includes("#shorts") ||
    text.includes(" #short ") ||
    text.includes("shorts ") ||
    text.includes(" reel ") ||
    text.includes(" reels ") ||
    text.includes("#reel")
  ) {
    return true;
  }
  return false;
};

const isEpisodeCandidate = (post: ExternalPost) => {
  if (isShort(post)) return false;
  const duration = Number(post.metrics?.durationSeconds);
  if (!Number.isNaN(duration) && duration >= 8 * 60) return true;
  const text = `${post.title ?? ""} ${post.caption ?? ""}`.toLowerCase();
  return /(episodio|episode|podcast|cap[ií]tulo|entrevista|en vivo|live)/i.test(text);
};

const dayWindowIso = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
const isFresh = (value?: string | null, hours = 24) => {
  if (!value) return false;
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts <= hours * 60 * 60 * 1000;
};

function supabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export default async function HomePage() {
  const supabase = supabaseServer();
  const nowIso = new Date().toISOString();
  const since24h = dayWindowIso(24);

  const [
    { data: youtubePosts },
    { data: latestNews },
    { data: hotNewsList },
    { data: confessionsSpot },
    { data: debateThread },
    { data: promosHome }
  ] = await Promise.all([
    supabase
      .from("external_posts")
      .select("id, title, caption, source_url, media_url, posted_at, metrics")
      .eq("platform", "YouTube")
      .order("posted_at", { ascending: false })
      .limit(18),
    (async () => {
      const primary = await supabase
        .from("news_items")
        .select("id, title, summary, published_at, cover_url")
        .eq("publication_state", "published")
        .order("published_at", { ascending: false })
        .limit(1)
        .single();
      if (primary.error && /publication_state/i.test(primary.error.message)) {
        return supabase
          .from("news_items")
          .select("id, title, summary, published_at, cover_url")
          .order("published_at", { ascending: false })
          .limit(1)
          .single();
      }
      return primary;
    })(),
    (async () => {
      const primary = await supabase
        .from("news_items")
        .select("id, title, summary, published_at, cover_url, categories")
        .eq("publication_state", "published")
        .order("published_at", { ascending: false })
        .limit(24);
      if (primary.error && /publication_state/i.test(primary.error.message)) {
        return supabase
          .from("news_items")
          .select("id, title, summary, published_at, cover_url, categories")
          .order("published_at", { ascending: false })
          .limit(24);
      }
      return primary;
    })(),
    supabase
      .from("confessions")
      .select("id, body, created_at, users(nickname)")
      .eq("level", "public")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("threads")
      .select("id, title, body, created_at")
      .eq("space", "foro")
      .order("created_at", { ascending: false })
      .limit(1)
      .single(),
    (async () => {
      const primary = await supabase
        .from("promotions")
        .select("id, title, description, image_url, cta_label, cta_url, target_sections")
        .eq("is_active", true)
        .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
        .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
        .order("display_order", { ascending: true })
        .limit(10);
      if (primary.error && /target_sections/i.test(primary.error.message)) {
        return supabase
          .from("promotions")
          .select("id, title, description, image_url, cta_label, cta_url")
          .eq("is_active", true)
          .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
          .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
          .order("display_order", { ascending: true })
          .limit(10);
      }
      return primary;
    })()
  ]);

  const posts = (youtubePosts ?? []) as ExternalPost[];
  const fullEpisodes = posts.filter((post) => isEpisodeCandidate(post));
  const fallbackEpisodes = posts.filter((post) => !isShort(post));
  const latestEpisode = fullEpisodes[0] ?? fallbackEpisodes[0] ?? null;
  const clips = posts.filter((post) => isShort(post)).slice(0, 3);
  const latestYtId = latestEpisode?.source_url ? getYouTubeVideoId(latestEpisode.source_url) : null;

  const hotNews = (hotNewsList ?? []) as NewsItem[];
  const primaryHot = hotNews[0] ?? null;
  const sideHot = hotNews.slice(1, 3);

  const [
    { count: newsToday },
    { count: threadsToday },
    { count: confessionsToday }
  ] = await Promise.all([
    (async () => {
      const primary = await supabase
        .from("news_items")
        .select("id", { count: "exact", head: true })
        .eq("publication_state", "published")
        .gte("published_at", since24h);
      if (primary.error && /publication_state/i.test(primary.error.message)) {
        return supabase.from("news_items").select("id", { count: "exact", head: true }).gte("published_at", since24h);
      }
      return primary;
    })(),
    supabase.from("threads").select("id", { count: "exact", head: true }).gte("created_at", since24h),
    supabase.from("confessions").select("id", { count: "exact", head: true }).eq("level", "public").gte("created_at", since24h)
  ]);

  const newToday = Number(newsToday ?? 0) + Number(threadsToday ?? 0) + Number(confessionsToday ?? 0);

  let mostReadNewsIds: string[] = [];
  try {
    const svc = supabaseService();
    if (svc) {
      const { data: visits } = await svc
        .from("page_visits")
        .select("path, visited_at")
        .gte("visited_at", since24h)
        .like("path", "/noticias/%")
        .limit(900);
      const counts = new Map<string, number>();
      (visits ?? []).forEach((v: any) => {
        const m = String(v.path ?? "").match(/^\/noticias\/([0-9a-f-]{36})/i);
        if (!m) return;
        counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
      });
      mostReadNewsIds = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id]) => id);
    }
  } catch {
    mostReadNewsIds = [];
  }

  const mostReadHot = mostReadNewsIds.length
    ? hotNews.filter((n) => mostReadNewsIds.includes(n.id)).sort((a, b) => mostReadNewsIds.indexOf(a.id) - mostReadNewsIds.indexOf(b.id))
    : hotNews.slice(0, 3);

  const debateQuestion = debateThread?.title?.trim()
    ? `“${debateThread.title}”`
    : "¿La gente está demasiado sensible o simplemente estamos evolucionando?";

  const promotions = ((promosHome ?? []) as Promotion[]).filter((p) => {
    const ts = (p as any).target_sections;
    if (!ts || (Array.isArray(ts) && ts.length === 0)) return true;
    if (!Array.isArray(ts)) return true;
    const normalized = (ts as any[]).map((x) => String(x).toLowerCase());
    return normalized.includes("home") || normalized.includes("all") || normalized.includes("global");
  }).slice(0, 3);

  const byRegion = (key: "PR" | "TX" | "USA" | "Mundo") =>
    hotNews.filter((n) => (n.categories ?? []).map((c) => c.toUpperCase()).includes(key.toUpperCase())).slice(0, 9);

  return (
    <main className="app-enter home-final">
      <GuestInvitePopup />
      <Navbar />

      <section className="section home-final-hero">
        <div className="container">
          {latestNews?.id ? (
            <div className="home-breaking" role="status" aria-live="polite">
              <span className="home-breaking-label">Última hora</span>
              <Link className="home-breaking-link" href={`/noticias/${latestNews.id}`}>
                {latestNews.title}
              </Link>
            </div>
          ) : null}

          <div className="home-final-hero-box">
            <p className="home-final-kicker">Noticias · Debate · Comunidad</p>
            <h1 className="home-final-title">SIN PELOS EN EL MICRÓFONO</h1>
            <p className="home-final-headline">La conversación que otros no se atreven a tener.</p>
            <p className="home-final-subheadline">
              Contenido diario y conversación directa sin filtros. Puerto Rico, Texas, USA y Mundo.
            </p>

            <div className="home-final-activity">
              <span className="pill-dot" aria-hidden="true" />
              <strong>{newToday}</strong>
              <span>temas nuevos hoy</span>
            </div>

            <div className="home-cta-row">
              <Link className="button" href="/feed">
                Entrar al Feed
              </Link>
              <Link className="button secondary" href="/community">
                Unirme a la Comunidad
              </Link>
            </div>
            <p className="home-final-microcopy">Acceso al foro, confesiones anónimas y debates exclusivos.</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="home-section-head">
            <h2 className="section-title">Lo que está prendío ahora mismo</h2>
            <Link className="muted" href="/noticias">
              Ver todas
            </Link>
          </div>

          <div className="home-hot-grid">
            {primaryHot ? (
              <Link href={`/noticias/${primaryHot.id}`} className="card home-hot-main">
                <div className="home-hot-media">
                  {primaryHot.cover_url ? (
                    <img src={primaryHot.cover_url} alt={primaryHot.title} loading="lazy" />
                  ) : (
                    <div className="news-thumb-fallback" aria-hidden="true" />
                  )}
                  <div className="news-thumb-overlay" aria-hidden="true" />
                  <span className="pill home-hot-pill">{isFresh(primaryHot.published_at) ? "Última hora" : "En foco"}</span>
                </div>
                <div className="home-hot-body">
                  <h3 className="clamp-2">{primaryHot.title}</h3>
                  <p className="muted clamp-2">{primaryHot.summary ?? "Análisis y contexto sin filtro."}</p>
                  <div className="home-hot-meta-row">
                    <span className="home-hot-meta">{formatDate(primaryHot.published_at)}</span>
                    <span className="home-hot-read">Leer análisis</span>
                  </div>
                </div>
              </Link>
            ) : (
              <article className="card home-hot-main">
                <h3>No hay noticias aún</h3>
                <p className="muted">Publica desde el panel admin para activar esta sección.</p>
              </article>
            )}

            {sideHot.map((item) => (
              <Link key={item.id} href={`/noticias/${item.id}`} className="card home-hot-side">
                <div className="home-hot-side-media">
                  {item.cover_url ? (
                    <img src={item.cover_url} alt={item.title} loading="lazy" />
                  ) : (
                    <div className="news-thumb-fallback" aria-hidden="true" />
                  )}
                </div>
                <div className="home-hot-side-body">
                  <div className="home-hot-side-top">
                    <span className="pill">{isFresh(item.published_at) ? "Última hora" : item.categories?.[0] ?? "Tendencia"}</span>
                    <span className="home-hot-meta">{formatDate(item.published_at)}</span>
                  </div>
                  <h3 className="clamp-2">{item.title}</h3>
                  <p className="muted clamp-2">{item.summary ?? "Resumen disponible al entrar."}</p>
                </div>
              </Link>
            ))}
          </div>

          {mostReadHot.length > 0 ? (
            <div className="home-ranking-head">
              <span className="badge">Tendencias 24h</span>
              <span className="muted">Lo más leído y compartido ahora</span>
            </div>
          ) : null}

          {mostReadHot.length > 0 ? (
            <div className="home-ranking-row" aria-label="Tendencias de noticias">
              {mostReadHot.map((item, index) => (
                <Link key={item.id} href={`/noticias/${item.id}`} className="home-ranking-item">
                  <span className="home-ranking-kicker">{index === 0 ? "En tendencia" : "Subiendo"}</span>
                  <span className="clamp-2">{item.title}</span>
                </Link>
              ))}
            </div>
          ) : null}

          <div style={{ marginTop: 14 }}>
            <Link className="button" href="/noticias">
              Ver todas las noticias
            </Link>
          </div>
        </div>
      </section>

      <section className="section home-podcast-wrap" id="podcast">
        <div className="container">
          <div className="home-section-head">
            <h2 className="section-title">Episodio más reciente</h2>
            <Link className="muted" href="/feed?view=episodes">
              Ver lista completa
            </Link>
          </div>

          <article className="card home-podcast-card">
            <span className="badge">Podcast destacado</span>
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

            <h3 className="clamp-2">{latestEpisode?.title ?? "Aún no hay episodio publicado"}</h3>
            <p className="muted home-podcast-summary">
              {latestEpisode
                ? "Resumen directo, análisis claro y conversación sin miedo en el episodio más reciente."
                : "Conecta YouTube y sincroniza un episodio para activar esta sección."}
            </p>
            <div className="metrics-row">
              <span>Views: {formatMetric(latestEpisode?.metrics?.views)}</span>
              <span>Likes: {formatMetric(latestEpisode?.metrics?.likes)}</span>
              <span>{formatDate(latestEpisode?.posted_at)}</span>
            </div>
            <div className="home-cta-row" style={{ marginTop: 10 }}>
              {latestEpisode?.source_url ? (
                <a className="button" href={latestEpisode.source_url} target="_blank" rel="noreferrer">
                  Ver episodio completo
                </a>
              ) : null}
              <Link className="button secondary" href="/feed?view=shorts">
                Ver clips
              </Link>
            </div>
          </article>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <article className="card home-debate-card">
            <span className="badge">Debate del día</span>
            <h2>{debateQuestion}</h2>
            <p className="muted">No vengas solo a mirar. Entra, comenta y contrasta ideas sin miedo.</p>
            <Link className="button" href="/foro">
              Participar en el foro
            </Link>
          </article>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="home-section-head">
            <h2 className="section-title">Confesiones Anónimas</h2>
            <Link className="muted" href="/confesionario">
              Abrir confesionario
            </Link>
          </div>
          <p className="muted" style={{ marginTop: 0 }}>
            ¿Tienes algo que decir pero no quieres dar la cara? Aquí nadie sabe quién eres.
          </p>
          <ConfessionSpotlight items={((confessionsSpot ?? []) as any[])} rotateSeconds={9} />
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

      <section className="section">
        <div className="container">
          <article className="card home-about-card">
            <h2 className="section-title">¿Qué es Sin Pelos en el Micrófono?</h2>
            <p>
              Somos una plataforma independiente de noticias, debate y comunidad. Aquí se habla claro, se cuestiona todo y se
              construye conversación sin miedo.
            </p>
            <Link className="button secondary" href="/community">
              Conoce la comunidad
            </Link>
          </article>
        </div>
      </section>

      <section className="section home-ads-section">
        <div className="container">
          <div className="home-section-head">
            <h2 className="section-title">¿Quieres anunciarte aquí?</h2>
            <Link className="muted" href="/publicidad">
              Ver media kit
            </Link>
          </div>

          <div className="home-ads-grid">
            <article className="card home-ads-copy">
              <p>
                Llegamos a una audiencia activa en PR, TX y USA. Espacios para patrocinio editorial, banners por sección y campañas de marca.
              </p>
              <Link className="button" href="/publicidad">
                Ver Media Kit
              </Link>
            </article>

            {promotions.length > 0 ? (
              promotions.map((promo) => (
                <a
                  key={promo.id}
                  className="card home-ads-promo"
                  href={promo.cta_url ?? "/publicidad"}
                  target={promo.cta_url ? "_blank" : undefined}
                  rel={promo.cta_url ? "noreferrer" : undefined}
                >
                  <div className="home-ads-promo-media">
                    {promo.image_url ? (
                      <img src={promo.image_url} alt={promo.title} loading="lazy" />
                    ) : (
                      <div className="news-thumb-fallback" aria-hidden="true" />
                    )}
                  </div>
                  <div className="home-ads-promo-body">
                    <strong>{promo.title}</strong>
                    <span className="muted clamp-2">{promo.description ?? "Promoción activa"}</span>
                  </div>
                </a>
              ))
            ) : (
              <article className="card home-ads-promo home-ads-empty">
                <strong>Espacio disponible</strong>
                <span className="muted">Activa promociones desde admin o solicita pauta comercial.</span>
              </article>
            )}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <NewsletterForm
            variant="cta"
            title="Recibe lo más polémico antes que nadie"
            subtitle="No spam. Solo lo que vale la pena."
          />
        </div>
      </section>

      <Link className="home-mobile-join" href="/community">
        Unirme
      </Link>

      <Footer />
    </main>
  );
}
