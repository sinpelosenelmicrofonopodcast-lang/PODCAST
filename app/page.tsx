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

type BlogPost = {
  id: string;
  title: string;
  excerpt: string | null;
  cover_url: string | null;
  slug?: string | null;
  created_at: string | null;
};

type LiveEvent = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  visibility: string | null;
  join_url: string | null;
};

type HomeSettings = {
  hero_kicker: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  opinion_title?: string | null;
  opinion_body?: string | null;
  opinion_cta_label?: string | null;
  opinion_cta_href?: string | null;
  show_latest_news: boolean | null;
  show_latest_blog: boolean | null;
  show_latest_community_post: boolean | null;
  show_upcoming_events: boolean | null;
  show_promotions: boolean | null;
  editors_pick_news_ids?: string[] | null;
  trending_weight_comments?: number | null;
  trending_weight_shares?: number | null;
  trending_weight_views?: number | null;
};

const HOME_TOPIC_HUBS = [
  { slug: "politica", label: "Política", subtitle: "Agenda pública y decisiones que pegan directo." },
  { slug: "economia", label: "Economía", subtitle: "Dinero real, bolsillo real, impacto real." },
  { slug: "tecnologia", label: "Tecnología", subtitle: "IA, redes y cómo cambian la conversación." },
  { slug: "entretenimiento", label: "Entretenimiento", subtitle: "Lo cultural que mueve audiencia y debate." }
];

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const id = String(item.id ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
}

function dedupePromotions(items: Promotion[]): Promotion[] {
  const seen = new Set<string>();
  const out: Promotion[] = [];
  for (const promo of items) {
    const fingerprint = [
      String(promo.title ?? "").trim().toLowerCase(),
      String(promo.image_url ?? "").trim().toLowerCase(),
      String(promo.cta_url ?? "").trim().toLowerCase()
    ].join("|");
    if (!fingerprint || seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    out.push(promo);
  }
  return out;
}

const NEWS_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseNewsIdFromPath(path: string | null | undefined): string | null {
  const raw = String(path ?? "").trim();
  if (!raw) return null;
  const clean = raw.split("?")[0].split("#")[0];
  const m = clean.match(/^\/noticias\/([^/]+)$/i);
  if (!m?.[1]) return null;
  const id = decodeURIComponent(m[1]);
  return NEWS_ID_RE.test(id) ? id : null;
}

function parseNewsIdFromSourceUrl(urlValue: string | null | undefined): string | null {
  const raw = String(urlValue ?? "").trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return parseNewsIdFromPath(u.pathname);
  } catch {
    const idx = raw.indexOf("/noticias/");
    if (idx < 0) return null;
    return parseNewsIdFromPath(raw.slice(idx));
  }
}

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

function normalizeWeights(input?: {
  comments?: number | null;
  shares?: number | null;
  views?: number | null;
}) {
  const rawComments = Math.max(0, Number(input?.comments ?? 0.45));
  const rawShares = Math.max(0, Number(input?.shares ?? 0.35));
  const rawViews = Math.max(0, Number(input?.views ?? 0.2));
  const sum = rawComments + rawShares + rawViews;
  if (sum <= 0) return { comments: 0.45, shares: 0.35, views: 0.2 };
  return {
    comments: rawComments / sum,
    shares: rawShares / sum,
    views: rawViews / sum
  };
}

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
    { data: homeSettingsData },
    { data: youtubePosts },
    { data: latestNews },
    { data: latestBlogData },
    { data: hotNewsList },
    { data: confessionsSpot },
    { data: latestCommunityData },
    { data: upcomingEventsData },
    { data: debateThread },
    { data: promosHome }
  ] = await Promise.all([
    (async () => {
      const primary = await supabase
        .from("home_settings")
        .select(
          "hero_kicker, hero_title, hero_subtitle, opinion_title, opinion_body, opinion_cta_label, opinion_cta_href, show_latest_news, show_latest_blog, show_latest_community_post, show_upcoming_events, show_promotions, editors_pick_news_ids, trending_weight_comments, trending_weight_shares, trending_weight_views"
        )
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();
      if (
        primary.error &&
        /(editors_pick_news_ids|trending_weight_comments|trending_weight_shares|trending_weight_views|opinion_title|opinion_body|opinion_cta_label|opinion_cta_href)/i.test(primary.error.message)
      ) {
        return supabase
          .from("home_settings")
          .select(
            "hero_kicker, hero_title, hero_subtitle, show_latest_news, show_latest_blog, show_latest_community_post, show_upcoming_events, show_promotions"
          )
          .order("updated_at", { ascending: false })
          .limit(1)
          .single();
      }
      return primary;
    })(),
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
      const withSlug = await supabase
        .from("blog_posts")
        .select("id, title, excerpt, cover_url, slug, created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (withSlug.error && /slug/i.test(withSlug.error.message)) {
        return supabase
          .from("blog_posts")
          .select("id, title, excerpt, cover_url, created_at")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
      }
      return withSlug;
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
      .eq("space", "community")
      .order("created_at", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("live_events")
      .select("id, title, description, starts_at, ends_at, visibility, join_url")
      .gte("starts_at", nowIso)
      .order("starts_at", { ascending: true })
      .limit(3),
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

  const homeSettings = (homeSettingsData ?? null) as HomeSettings | null;
  const heroKicker = homeSettings?.hero_kicker?.trim() || "Noticias · Debate · Comunidad";
  const heroTitle = homeSettings?.hero_title?.trim() || "SIN PELOS EN EL MICRÓFONO";
  const heroSubtitle =
    homeSettings?.hero_subtitle?.trim() || "Contenido diario y conversación directa sin filtros. Puerto Rico, Texas, USA y Mundo.";
  const opinionTitle = homeSettings?.opinion_title?.trim() || "Opinión del día";
  const opinionBody =
    homeSettings?.opinion_body?.trim() ||
    "La conversación pública necesita menos pose y más criterio. Aquí se discute de frente.";
  const opinionCtaLabel = homeSettings?.opinion_cta_label?.trim() || "Ir al foro";
  const opinionCtaHref = homeSettings?.opinion_cta_href?.trim() || "/foro";
  const showLatestNews = homeSettings?.show_latest_news ?? true;
  const showLatestBlog = homeSettings?.show_latest_blog ?? true;
  const showCommunity = homeSettings?.show_latest_community_post ?? true;
  const showUpcomingEvents = homeSettings?.show_upcoming_events ?? true;
  const showPromotions = homeSettings?.show_promotions ?? true;
  const trendWeights = normalizeWeights({
    comments: homeSettings?.trending_weight_comments ?? 0.45,
    shares: homeSettings?.trending_weight_shares ?? 0.35,
    views: homeSettings?.trending_weight_views ?? 0.2
  });

  const latestBlog = (latestBlogData ?? null) as BlogPost | null;
  const latestCommunity = (latestCommunityData ?? null) as Thread | null;
  const upcomingEvents = ((upcomingEventsData ?? []) as LiveEvent[]).filter((event) => event.starts_at);
  const latestBlogHref = latestBlog
    ? `/blog/${encodeURIComponent(String((latestBlog as any).slug ?? latestBlog.id))}`
    : "/blog";

  const hotNews = uniqueById((hotNewsList ?? []) as NewsItem[]);
  const editorialIds = Array.isArray(homeSettings?.editors_pick_news_ids) ? homeSettings!.editors_pick_news_ids! : [];
  const editorialPicks = editorialIds
    .map((id) => hotNews.find((item) => item.id === id))
    .filter(Boolean) as NewsItem[];
  const topHotNews = [...editorialPicks, ...hotNews.filter((item) => !editorialIds.includes(item.id))].slice(0, 3);
  const primaryHot = topHotNews[0] ?? null;
  const sideHot = topHotNews.slice(1, 3);

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

  const newsIds = hotNews.map((item) => item.id);
  const newsIdSet = new Set(newsIds);
  const commentsCountByNews = new Map<string, number>();
  if (newsIds.length > 0) {
    const { data: commentsRows } = await supabase
      .from("comments")
      .select("content_id")
      .eq("content_type", "news")
      .in("content_id", newsIds);
    (commentsRows ?? []).forEach((row: any) => {
      commentsCountByNews.set(row.content_id, (commentsCountByNews.get(row.content_id) ?? 0) + 1);
    });
  }

  const sharesCountByNews = new Map<string, number>();
  {
    const since30d = dayWindowIso(24 * 30);
    const { data: shareRows } = await supabase
      .from("external_posts")
      .select("source_url, metrics, posted_at")
      .gte("posted_at", since30d)
      .like("source_url", "%/noticias/%")
      .order("posted_at", { ascending: false })
      .limit(5000);
    (shareRows ?? []).forEach((row: any) => {
      const newsId = parseNewsIdFromSourceUrl(row.source_url);
      if (!newsId) return;
      if (!newsIdSet.has(newsId)) return;
      const shares = Number(row?.metrics?.shares ?? 0);
      if (!Number.isFinite(shares) || shares <= 0) return;
      sharesCountByNews.set(newsId, (sharesCountByNews.get(newsId) ?? 0) + shares);
    });
  }

  const viewsCountByNews = new Map<string, number>();
  try {
    const svc = supabaseService();
    if (svc && newsIds.length > 0) {
      const { data: visits } = await svc
        .from("page_visits")
        .select("path, visited_at")
        .gte("visited_at", dayWindowIso(24 * 30))
        .like("path", "/noticias/%")
        .limit(50000);
      (visits ?? []).forEach((v: any) => {
        const newsId = parseNewsIdFromPath(v.path);
        if (!newsId) return;
        if (!newsIdSet.has(newsId)) return;
        viewsCountByNews.set(newsId, (viewsCountByNews.get(newsId) ?? 0) + 1);
      });
    }
  } catch {
    // no-op fallback
  }

  const topIds = new Set(topHotNews.map((n) => n.id));
  const maxComments = Math.max(1, ...newsIds.map((id) => commentsCountByNews.get(id) ?? 0));
  const maxShares = Math.max(1, ...newsIds.map((id) => sharesCountByNews.get(id) ?? 0));
  const maxViews = Math.max(1, ...newsIds.map((id) => viewsCountByNews.get(id) ?? 0));

  const trendScore = (newsId: string) => {
    const cNorm = (commentsCountByNews.get(newsId) ?? 0) / maxComments;
    const sNorm = (sharesCountByNews.get(newsId) ?? 0) / maxShares;
    const vNorm = (viewsCountByNews.get(newsId) ?? 0) / maxViews;
    return cNorm * trendWeights.comments + sNorm * trendWeights.shares + vNorm * trendWeights.views;
  };

  const mostReadHot = [...hotNews]
    .filter((news) => !topIds.has(news.id))
    .sort((a, b) => {
      const byScore = trendScore(b.id) - trendScore(a.id);
      if (Math.abs(byScore) > 0.0001) return byScore;
      return new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime();
    })
    .slice(0, 3);

  const topRead = [...hotNews].sort((a, b) => (viewsCountByNews.get(b.id) ?? 0) - (viewsCountByNews.get(a.id) ?? 0))[0] ?? null;
  const topCommented =
    [...hotNews].sort((a, b) => (commentsCountByNews.get(b.id) ?? 0) - (commentsCountByNews.get(a.id) ?? 0))[0] ?? null;
  const topShared = [...hotNews].sort((a, b) => (sharesCountByNews.get(b.id) ?? 0) - (sharesCountByNews.get(a.id) ?? 0))[0] ?? null;

  const heatCards: Array<{ key: string; label: string; title: string; href: string; meta: string }> = [];
  if (topRead) {
    heatCards.push({
      key: `read-${topRead.id}`,
      label: "Más leído",
      title: topRead.title,
      href: `/noticias/${topRead.id}`,
      meta: `${formatMetric(viewsCountByNews.get(topRead.id) ?? 0)} views`
    });
  }
  if (topCommented) {
    heatCards.push({
      key: `commented-${topCommented.id}`,
      label: "Más comentado",
      title: topCommented.title,
      href: `/noticias/${topCommented.id}`,
      meta: `${formatMetric(commentsCountByNews.get(topCommented.id) ?? 0)} comentarios`
    });
  }
  if (topShared) {
    heatCards.push({
      key: `shared-${topShared.id}`,
      label: "Más compartido",
      title: topShared.title,
      href: `/noticias/${topShared.id}`,
      meta: `${formatMetric(sharesCountByNews.get(topShared.id) ?? 0)} shares`
    });
  }
  if (latestEpisode?.source_url) {
    heatCards.push({
      key: `episode-${latestEpisode.id}`,
      label: "Último episodio",
      title: latestEpisode.title,
      href: latestEpisode.source_url,
      meta: `${formatMetric(latestEpisode.metrics?.views)} views`
    });
  }

  const debateQuestion = debateThread?.title?.trim()
    ? `“${debateThread.title}”`
    : "¿La gente está demasiado sensible o simplemente estamos evolucionando?";

  const homePromotionsRaw = ((promosHome ?? []) as Promotion[]).filter((p) => {
    const ts = (p as any).target_sections;
    if (!ts || (Array.isArray(ts) && ts.length === 0)) return true;
    if (!Array.isArray(ts)) return true;
    const normalized = (ts as any[]).map((x) => String(x).toLowerCase());
    return normalized.includes("home") || normalized.includes("all") || normalized.includes("global");
  });
  const promotions = dedupePromotions(homePromotionsRaw).slice(0, 3);

  const usedNewsIds = new Set<string>([...topHotNews.map((n) => n.id), ...mostReadHot.map((n) => n.id)]);
  const byRegion = (key: "PR" | "TX" | "USA" | "Mundo") => {
    const regionAll = hotNews.filter((n) => (n.categories ?? []).map((c) => c.toUpperCase()).includes(key.toUpperCase()));
    const regionUnique = regionAll.filter((n) => !usedNewsIds.has(n.id));
    return (regionUnique.length > 0 ? regionUnique : regionAll).slice(0, 9);
  };

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
            <p className="home-final-kicker">{heroKicker}</p>
            <h1 className="home-final-title">{heroTitle}</h1>
            <p className="home-final-headline">La conversación que otros no se atreven a tener.</p>
            <p className="home-final-subheadline">{heroSubtitle}</p>

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

      {showLatestNews ? (
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

        </div>
      </section>
      ) : null}

      {heatCards.length > 0 ? (
      <section className="section">
        <div className="container">
          <div className="home-section-head">
            <h2 className="section-title">Lo que está caliente hoy</h2>
            <span className="muted">Se actualiza con señal real de audiencia</span>
          </div>
          <div className="home-ranking-row home-heat-row">
            {heatCards.slice(0, 4).map((item) => (
              <a
                key={item.key}
                href={item.href}
                className="home-ranking-item home-heat-item"
                target={item.href.startsWith("http") ? "_blank" : undefined}
                rel={item.href.startsWith("http") ? "noreferrer" : undefined}
              >
                <span className="home-ranking-kicker">{item.label}</span>
                <strong className="clamp-2">{item.title}</strong>
                <span className="muted">{item.meta}</span>
              </a>
            ))}
          </div>
        </div>
      </section>
      ) : null}

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

      {showLatestBlog || showCommunity || showUpcomingEvents ? (
      <section className="section">
        <div className="container">
          <div className="home-section-head">
            <h2 className="section-title">Radar editorial</h2>
            <span className="muted">Lo último en blog, comunidad y agenda</span>
          </div>
          <div className="home-editorial-grid">
            {showLatestBlog ? (
              <article className="card home-editorial-card">
                <span className="badge">Último blog</span>
                {latestBlog?.cover_url ? <img className="cover-wide" src={latestBlog.cover_url} alt={latestBlog.title} loading="lazy" /> : null}
                <h3 className="clamp-2">{latestBlog?.title ?? "Aún no hay blog publicado"}</h3>
                <p className="muted clamp-3">{latestBlog?.excerpt ?? "Publica desde admin/blog para activar esta sección."}</p>
                <a className="button secondary" href={latestBlogHref}>
                  Ir al blog
                </a>
              </article>
            ) : null}

            {showCommunity ? (
              <article className="card home-editorial-card">
                <span className="badge">Comunidad</span>
                <h3 className="clamp-2">{latestCommunity?.title ?? "No hay nuevos hilos en comunidad"}</h3>
                <p className="muted clamp-3">
                  {latestCommunity?.body?.trim() || "Abre comunidad y crea el primer hilo para iniciar conversación."}
                </p>
                <Link className="button secondary" href="/community">
                  Entrar a comunidad
                </Link>
              </article>
            ) : null}

            {showUpcomingEvents ? (
              <article className="card home-editorial-card">
                <span className="badge">Próximos eventos</span>
                {upcomingEvents.length > 0 ? (
                  <div className="home-events-list">
                    {upcomingEvents.slice(0, 3).map((event) => (
                      <div key={event.id} className="home-event-item">
                        <strong className="clamp-2">{event.title}</strong>
                        <span className="muted">
                          {event.starts_at ? new Date(event.starts_at).toLocaleString("es-PR", { dateStyle: "medium", timeStyle: "short" }) : ""}
                        </span>
                        {event.join_url ? (
                          <a href={event.join_url} target="_blank" rel="noreferrer" className="home-event-link">
                            Entrar
                          </a>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">No hay eventos próximos. Puedes crearlos desde admin/eventos.</p>
                )}
                <Link className="button secondary" href="/eventos">
                  Ver agenda
                </Link>
              </article>
            ) : null}
          </div>
        </div>
      </section>
      ) : null}

      <section className="section">
        <div className="container">
          <article className="card home-opinion-card">
            <span className="badge">{opinionTitle}</span>
            <p>{opinionBody}</p>
            <a
              className="button secondary"
              href={opinionCtaHref}
              target={opinionCtaHref.startsWith("http") ? "_blank" : undefined}
              rel={opinionCtaHref.startsWith("http") ? "noreferrer" : undefined}
            >
              {opinionCtaLabel}
            </a>
          </article>
        </div>
      </section>

      {showCommunity ? (
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
      ) : null}

      {showCommunity ? (
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
      ) : null}

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
          <div className="home-section-head">
            <h2 className="section-title">Hubs por tema</h2>
            <span className="muted">Cobertura continua por vertical editorial</span>
          </div>
          <div className="home-ranking-row home-topic-row">
            {HOME_TOPIC_HUBS.map((hub) => (
              <Link key={hub.slug} href={`/tema/${hub.slug}`} className="home-ranking-item home-topic-item">
                <span className="home-ranking-kicker">Hub</span>
                <strong>{hub.label}</strong>
                <span className="muted">{hub.subtitle}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

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

      {showPromotions ? (
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
      ) : null}

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
