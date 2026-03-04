import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ShareButtons } from "@/components/ShareButtons";
import { MidContentAdSlot } from "@/components/promotions/MidContentAdSlot";
import { DesktopSideAdSlot } from "@/components/promotions/DesktopSideAdSlot";
import { supabaseServer } from "@/lib/supabaseServer";
import type { PromoSection } from "@/lib/promoSection";
import { extractNewsPathSegment, extractNewsPathSegmentFromUrl, newsHref } from "@/lib/newsRoute";

export const revalidate = 300;

type NewsItem = {
  id: string;
  slug?: string | null;
  title: string;
  summary: string | null;
  cover_url: string | null;
  categories: string[] | null;
  published_at: string | null;
};

type TopicHub = {
  slug: string;
  label: string;
  category: string;
  description: string;
  promoSection: PromoSection;
};

const HUBS: TopicHub[] = [
  { slug: "pr", label: "Puerto Rico", category: "PR", description: "Lo más caliente del país con contexto y análisis.", promoSection: "noticias" },
  { slug: "tx", label: "Texas", category: "TX", description: "Cobertura de comunidad, política y economía en Texas.", promoSection: "noticias" },
  { slug: "usa", label: "USA", category: "USA", description: "Historias de impacto nacional y debate público.", promoSection: "noticias" },
  { slug: "mundo", label: "Mundo", category: "Mundo", description: "Eventos globales que terminan afectando aquí.", promoSection: "noticias" },
  { slug: "geopolitica", label: "Geopolítica", category: "Geopolítica", description: "Choques de poder global y sus consecuencias locales.", promoSection: "noticias" },
  { slug: "guerra", label: "Guerra", category: "Guerra", description: "Conflictos armados y su impacto humano, económico y político.", promoSection: "noticias" },
  { slug: "oriente", label: "Oriente", category: "Oriente", description: "Cobertura de Oriente Medio y sus efectos internacionales.", promoSection: "noticias" },
  { slug: "elecciones", label: "Elecciones", category: "Elecciones", description: "Campañas, voto y procesos electorales clave.", promoSection: "noticias" },
  { slug: "migracion", label: "Migración", category: "Migración", description: "Frontera, asilo y política migratoria en contexto.", promoSection: "noticias" },
  { slug: "seguridad", label: "Seguridad", category: "Seguridad", description: "Seguridad pública, defensa y riesgos regionales.", promoSection: "noticias" },
  { slug: "justicia", label: "Justicia", category: "Justicia", description: "Tribunales, decisiones judiciales y estado de derecho.", promoSection: "noticias" },
  { slug: "crimen", label: "Crimen", category: "Crimen", description: "Cobertura criminal con contexto y verificación.", promoSection: "noticias" },
  { slug: "medios", label: "Medios", category: "Medios", description: "Narrativa, poder mediático y agenda.", promoSection: "noticias" },
  { slug: "economia", label: "Economía", category: "Economía", description: "Bolsillo real: inflación, empleo y oportunidades.", promoSection: "noticias" },
  { slug: "energia", label: "Energía", category: "Energía", description: "Combustibles, red eléctrica y transición energética.", promoSection: "noticias" },
  { slug: "salud", label: "Salud", category: "Salud", description: "Políticas, acceso y decisiones que pegan directo.", promoSection: "noticias" },
  { slug: "ciencia", label: "Ciencia", category: "Ciencia", description: "Investigación, descubrimientos y datos útiles.", promoSection: "noticias" },
  { slug: "clima", label: "Clima", category: "Clima", description: "Huracanes, eventos extremos y crisis climática.", promoSection: "noticias" },
  { slug: "tecnologia", label: "Tecnología", category: "Tecnología", description: "IA, plataformas y cambio cultural digital.", promoSection: "noticias" },
  { slug: "cultura", label: "Cultura", category: "Cultura", description: "Lo que mueve conversación y define identidad.", promoSection: "noticias" },
  { slug: "politica", label: "Política", category: "Política", description: "Decisiones de poder y sus consecuencias.", promoSection: "noticias" },
  { slug: "deporte", label: "Deporte", category: "Deporte", description: "Historias deportivas con lectura social.", promoSection: "noticias" },
  { slug: "entretenimiento", label: "Entretenimiento", category: "Entretenimiento", description: "Lo viral y lo relevante, sin relleno.", promoSection: "noticias" },
  { slug: "musica", label: "Música", category: "Música", description: "Escena, industria y cultura musical.", promoSection: "musica" },
  { slug: "emprendimiento", label: "Emprendimiento", category: "Emprendimiento", description: "Historias de negocio real y ejecución.", promoSection: "emprendimiento" }
];

const HUB_BY_SLUG = new Map(HUBS.map((hub) => [hub.slug, hub]));

const SLUG_ALIASES = new Map<string, string>([
  ["puerto-rico", "pr"],
  ["texas", "tx"],
  ["us", "usa"],
  ["eeuu", "usa"],
  ["geopolitica", "geopolitica"],
  ["guerra", "guerra"],
  ["oriente", "oriente"],
  ["oriente-medio", "oriente"],
  ["elecciones", "elecciones"],
  ["migracion", "migracion"],
  ["seguridad", "seguridad"],
  ["justicia", "justicia"],
  ["crimen", "crimen"],
  ["energia", "energia"],
  ["ciencia", "ciencia"],
  ["clima", "clima"],
  ["politica", "politica"],
  ["economia", "economia"],
  ["tecnologia", "tecnologia"],
  ["música", "musica"]
]);

function dayWindowIso(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function normalizeSlug(value: string) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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

function resolveHub(slugParam: string): TopicHub | null {
  const normalized = normalizeSlug(slugParam);
  const direct = HUB_BY_SLUG.get(normalized);
  if (direct) return direct;
  const alias = SLUG_ALIASES.get(normalized);
  if (!alias) return null;
  return HUB_BY_SLUG.get(alias) ?? null;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const hub = resolveHub(params.slug);
  if (!hub) {
    return {
      title: "Tema no encontrado | Sin Pelos",
      alternates: { canonical: "/noticias" }
    };
  }
  return {
    title: `${hub.label} | Noticias Sin Pelos`,
    description: hub.description,
    alternates: { canonical: `/tema/${hub.slug}` }
  };
}

export default async function TemaHubPage({ params }: { params: { slug: string } }) {
  const hub = resolveHub(params.slug);
  if (!hub) notFound();

  const supabase = supabaseServer();
  const since30d = dayWindowIso(24 * 30);

  const [{ data: itemsData }, { data: homeSettingsData }] = await Promise.all([
    (async () => {
      const primary = await supabase
        .from("news_items")
        .select("id, slug, title, summary, cover_url, categories, published_at")
        .eq("publication_state", "published")
        .contains("categories", [hub.category])
        .order("published_at", { ascending: false })
        .limit(48);
      if (primary.error && /publication_state/i.test(primary.error.message)) {
        return supabase
          .from("news_items")
          .select("id, slug, title, summary, cover_url, categories, published_at")
          .contains("categories", [hub.category])
          .order("published_at", { ascending: false })
          .limit(48);
      }
      return primary;
    })(),
    (async () => {
      const primary = await supabase
        .from("home_settings")
        .select("trending_weight_comments, trending_weight_shares, trending_weight_views")
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();
      if (
        primary.error &&
        /(trending_weight_comments|trending_weight_shares|trending_weight_views)/i.test(primary.error.message)
      ) {
        return { data: null };
      }
      return primary;
    })()
  ]);

  const items = (itemsData ?? []) as NewsItem[];
  const newsIds = items.map((item) => item.id);
  const keyToId = new Map<string, string>();
  items.forEach((item) => {
    keyToId.set(item.id, item.id);
    const slug = String(item.slug ?? "").trim();
    if (slug) keyToId.set(slug, item.id);
  });
  const weights = normalizeWeights({
    comments: (homeSettingsData as any)?.trending_weight_comments,
    shares: (homeSettingsData as any)?.trending_weight_shares,
    views: (homeSettingsData as any)?.trending_weight_views
  });

  const commentsCountByNews = new Map<string, number>();
  if (newsIds.length > 0) {
    const { data: commentRows } = await supabase
      .from("comments")
      .select("content_id")
      .eq("content_type", "news")
      .in("content_id", newsIds);
    (commentRows ?? []).forEach((row: any) => {
      commentsCountByNews.set(row.content_id, (commentsCountByNews.get(row.content_id) ?? 0) + 1);
    });
  }

  const sharesCountByNews = new Map<string, number>();
  {
    const { data: shareRows } = await supabase
      .from("external_posts")
      .select("source_url, metrics, posted_at")
      .gte("posted_at", since30d)
      .like("source_url", "%/noticias/%")
      .order("posted_at", { ascending: false })
      .limit(5000);
    (shareRows ?? []).forEach((row: any) => {
      const key = extractNewsPathSegmentFromUrl(row.source_url);
      const newsId = key ? keyToId.get(key) ?? null : null;
      if (!newsId) return;
      const shares = Number(row?.metrics?.shares ?? 0);
      if (!Number.isFinite(shares) || shares <= 0) return;
      sharesCountByNews.set(newsId, (sharesCountByNews.get(newsId) ?? 0) + shares);
    });
  }

  const viewsCountByNews = new Map<string, number>();
  try {
    const svc = supabaseService();
    if (svc && newsIds.length > 0) {
      const { data: viewRows } = await svc
        .from("page_visits")
        .select("path, visited_at")
        .gte("visited_at", since30d)
        .like("path", "/noticias/%")
        .order("visited_at", { ascending: false })
        .limit(50000);
      (viewRows ?? []).forEach((row: any) => {
        const key = extractNewsPathSegment(row.path);
        const newsId = key ? keyToId.get(key) ?? null : null;
        if (!newsId) return;
        viewsCountByNews.set(newsId, (viewsCountByNews.get(newsId) ?? 0) + 1);
      });
    }
  } catch {
    // fallback: keep zero views
  }

  const maxComments = Math.max(1, ...newsIds.map((id) => commentsCountByNews.get(id) ?? 0));
  const maxShares = Math.max(1, ...newsIds.map((id) => sharesCountByNews.get(id) ?? 0));
  const maxViews = Math.max(1, ...newsIds.map((id) => viewsCountByNews.get(id) ?? 0));

  const scored = [...items]
    .map((item) => {
      const comments = commentsCountByNews.get(item.id) ?? 0;
      const shares = sharesCountByNews.get(item.id) ?? 0;
      const views = viewsCountByNews.get(item.id) ?? 0;
      const score = comments / maxComments * weights.comments + shares / maxShares * weights.shares + views / maxViews * weights.views;
      return {
        ...item,
        comments_count: comments,
        shares_count: shares,
        views_count: views,
        trend_score: score
      };
    })
    .sort((a, b) => {
      const byScore = b.trend_score - a.trend_score;
      if (Math.abs(byScore) > 0.0001) return byScore;
      return new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime();
    });

  const lead = items[0] ?? null;
  const trending = scored.slice(0, 6);
  const rest = items.filter((item) => item.id !== lead?.id);

  return (
    <main>
      <Navbar />
      <DesktopSideAdSlot section={hub.promoSection} />

      <section className="section">
        <div className="container">
          <div className="home-section-head">
            <div>
              <p className="home-final-kicker" style={{ marginBottom: 8 }}>
                Hub temático
              </p>
              <h1 className="section-title" style={{ marginBottom: 8 }}>
                {hub.label}
              </h1>
              <p className="muted" style={{ margin: 0 }}>
                {hub.description}
              </p>
            </div>
            <Link className="button secondary" href="/noticias">
              Ver todas las noticias
            </Link>
          </div>

          {lead ? (
            <div className="news-mag-top" style={{ marginTop: 14 }}>
              <article className="card news-mag-lead">
                {lead.cover_url ? (
                  <Link href={newsHref(lead)} className="news-mag-lead-cover">
                    <img src={lead.cover_url} alt={lead.title} loading="eager" decoding="async" />
                  </Link>
                ) : null}
                <div className="news-mag-lead-body">
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span className="news-badge">{hub.label}</span>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {lead.published_at ? new Date(lead.published_at).toLocaleDateString("es-PR") : ""}
                    </span>
                  </div>
                  <Link href={newsHref(lead)}>
                    <h2 className="news-mag-lead-title">{lead.title}</h2>
                  </Link>
                  {lead.summary ? (
                    <p className="muted news-summary-clamp" style={{ margin: 0 }}>
                      {lead.summary}
                    </p>
                  ) : null}
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Link className="button secondary" href={newsHref(lead)}>
                      Leer noticia
                    </Link>
                    <ShareButtons path={newsHref(lead)} text={lead.title} />
                  </div>
                </div>
              </article>

              <aside className="news-mag-rail news-mag-rail-sticky">
                <div className="card news-mag-rail-head">
                  <h3 style={{ margin: 0 }}>Tendencias en {hub.label}</h3>
                </div>
                {trending.map((item) => (
                  <article key={item.id} className="card news-mag-rail-item">
                    {item.cover_url ? (
                      <Link href={newsHref(item)} className="news-mag-rail-thumb">
                        <img src={item.cover_url} alt={item.title} loading="lazy" decoding="async" />
                      </Link>
                    ) : null}
                    <div>
                      <Link href={newsHref(item)}>
                        <h4 className="news-title-clamp" style={{ margin: 0 }}>
                          {item.title}
                        </h4>
                      </Link>
                      <p className="muted" style={{ margin: "6px 0 0", fontSize: 12 }}>
                        {item.published_at ? new Date(item.published_at).toLocaleDateString("es-PR") : ""}
                      </p>
                      <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>
                        {item.comments_count} comentarios · {item.views_count} views · {item.shares_count} shares
                      </p>
                    </div>
                  </article>
                ))}
              </aside>
            </div>
          ) : (
            <article className="card" style={{ marginTop: 14 }}>
              <h2 style={{ marginTop: 0 }}>No hay contenido en {hub.label}</h2>
              <p className="muted" style={{ marginBottom: 0 }}>
                Publica noticias bajo esta categoría para activar el hub.
              </p>
            </article>
          )}

          {rest.length > 0 ? (
            <div className="news-mag-grid" style={{ marginTop: 14 }}>
              {rest.map((item, index) => (
                <div key={item.id} style={{ display: "contents" }}>
                  {index === 2 ? <MidContentAdSlot section={hub.promoSection} /> : null}
                  <article className={item.cover_url ? "card news-item-card" : "card"}>
                    {item.cover_url ? (
                      <Link href={newsHref(item)}>
                        <div className="news-cover-thumb">
                          <img src={item.cover_url} alt={item.title} loading="lazy" decoding="async" />
                        </div>
                      </Link>
                    ) : null}
                    <div style={{ display: "grid", gap: 8 }}>
                      <div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <span className="news-badge">{hub.label}</span>
                          <span className="muted" style={{ fontSize: 12 }}>
                            {item.published_at ? new Date(item.published_at).toLocaleDateString("es-PR") : ""}
                          </span>
                        </div>
                        <Link href={newsHref(item)}>
                          <h3 className="news-title-clamp" style={{ margin: "6px 0 0" }}>
                            {item.title}
                          </h3>
                        </Link>
                      </div>
                      {item.summary ? (
                        <p className="muted news-summary-clamp" style={{ margin: 0 }}>
                          {item.summary}
                        </p>
                      ) : null}
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <Link className="button secondary" href={newsHref(item)}>
                          Leer noticia
                        </Link>
                        <ShareButtons path={newsHref(item)} text={item.title} />
                      </div>
                    </div>
                  </article>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <Footer />
    </main>
  );
}
