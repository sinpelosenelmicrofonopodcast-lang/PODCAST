import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Logo } from "@/components/Logo";
import { GuestInvitePopup } from "@/components/GuestInvitePopup";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  return !Number.isNaN(duration) && duration > 0 && duration <= 60;
};

export default async function HomePage() {
  const supabase = supabaseServer();

  const [
    { data: youtubePosts },
    { data: latestNews },
    { data: latestBlog },
    { data: latestCommunity },
    { data: latestForo },
    { data: latestConfesion },
    { data: latestTeoria }
  ] = await Promise.all([
    supabase
      .from("external_posts")
      .select("id, title, source_url, media_url, posted_at, metrics")
      .eq("platform", "YouTube")
      .order("posted_at", { ascending: false })
      .limit(24),
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
      .from("threads")
      .select("id, title, body, created_at")
      .eq("space", "foro")
      .order("created_at", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("threads")
      .select("id, title, body, created_at")
      .eq("space", "confesiones")
      .order("created_at", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("threads")
      .select("id, title, body, created_at")
      .eq("space", "teorias")
      .order("created_at", { ascending: false })
      .limit(1)
      .single()
  ]);

  const posts = (youtubePosts ?? []) as ExternalPost[];
  const shorts = posts.filter(isShort).slice(0, 8);
  const episodes = posts.filter((post) => !isShort(post));
  const latestEpisode = episodes[0];

  return (
    <main className="app-enter home-v2">
      <GuestInvitePopup />
      <Navbar />

      <section className="hero container home-hero">
        <span className="kicker">Plataforma 21+ · Sin censura ideologica</span>
        <div className="home-hero-top">
          <Logo size={90} animated />
          <div>
            <h1 className="hero-title">Sin Pelos en el Microfono</h1>
            <p className="hero-sub">
              Centro de contenido, noticias y comunidad real. Hablar claro no es opcion: es la norma.
            </p>
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
          <div className="home-grid-2x2">
            <article className="card home-lead-card">
              <span className="badge">Episodio mas reciente</span>
              {latestEpisode?.media_url ? (
                <img className="cover-wide" src={latestEpisode.media_url} alt={latestEpisode.title} />
              ) : null}
              <h3>{latestEpisode?.title ?? "Aun no hay episodios"}</h3>
              <div className="muted metrics-row">
                <span>Views: {formatMetric(latestEpisode?.metrics?.views)}</span>
                <span>Likes: {formatMetric(latestEpisode?.metrics?.likes)}</span>
                <span>{formatDate(latestEpisode?.posted_at)}</span>
              </div>
              {latestEpisode?.source_url ? (
                <a className="button secondary" href={latestEpisode.source_url} target="_blank" rel="noreferrer">
                  Ver episodio completo
                </a>
              ) : (
                <Link className="button secondary" href="/feed">
                  Ver episodio completo
                </Link>
              )}
            </article>

            <article className="card home-news-card">
              <span className="badge">Noticia mas reciente</span>
              {latestNews?.cover_url ? (
                <img className="cover-news" src={latestNews.cover_url} alt={latestNews.title} />
              ) : null}
              <h3>{latestNews?.title ?? "Aun no hay noticias"}</h3>
              <p className="muted">{latestNews?.summary ?? "Publica noticias desde el panel admin."}</p>
              <Link className="button secondary" href={latestNews?.id ? `/noticias/${latestNews.id}` : "/noticias"}>
                Leer noticia
              </Link>
            </article>

            <article className="card">
              <span className="badge">Blog mas reciente</span>
              {latestBlog?.cover_url ? <img className="cover-news" src={latestBlog.cover_url} alt={latestBlog.title} /> : null}
              <h3>{latestBlog?.title ?? "Aun no hay blogs"}</h3>
              <p className="muted">{latestBlog?.excerpt ?? "Publica articulos largos desde admin."}</p>
              <Link className="button secondary" href="/blog">
                Ir al blog
              </Link>
            </article>

            <article className="card">
              <span className="badge">Comunidad activa</span>
              <h3>{latestCommunity?.title ?? "Aun no hay actividad"}</h3>
              <p className="muted">{latestCommunity?.body ?? "Crea el primer thread en Comunidad."}</p>
              <Link className="button secondary" href="/community">
                Entrar a comunidad
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="home-section-head">
            <h2 className="section-title">Shorts del momento</h2>
            <Link className="muted" href="/feed">
              Ver todos
            </Link>
          </div>
          <div className="shorts-strip">
            {shorts.length === 0 ? <div className="card">No hay shorts sincronizados aun.</div> : null}
            {shorts.map((short) => (
              <a key={short.id} href={short.source_url} className="short-card" target="_blank" rel="noreferrer">
                {short.media_url ? <img src={short.media_url} alt={short.title} className="short-thumb" /> : null}
                <div className="short-meta">
                  <strong>{short.title}</strong>
                  <span className="muted">{formatMetric(short.metrics?.views)} views</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="home-section-head">
            <h2 className="section-title">Debate caliente</h2>
            <Link className="muted" href="/foro">
              Ver foro
            </Link>
          </div>
          <div className="home-grid-3">
            <article className="card">
              <span className="badge">Foro Sin Pelos</span>
              <h3>{latestForo?.title ?? "Sin posts aun"}</h3>
              <p className="muted">{latestForo?.body ?? "Publica debates sociales y culturales."}</p>
              <Link className="button secondary" href="/foro">
                Entrar al foro
              </Link>
            </article>
            <article className="card">
              <span className="badge">Confesiones</span>
              <h3>{latestConfesion?.title ?? "Sin confesiones aun"}</h3>
              <p className="muted">{latestConfesion?.body ?? "Area publica y area paga sin filtro."}</p>
              <Link className="button secondary" href="/confesiones">
                Ver confesiones
              </Link>
            </article>
            <article className="card">
              <span className="badge">Teorias</span>
              <h3>{latestTeoria?.title ?? "Sin teorias aun"}</h3>
              <p className="muted">{latestTeoria?.body ?? "Pensar con fuentes y preguntas abiertas."}</p>
              <Link className="button secondary" href="/teorias">
                Ver teorias
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section className="section ad-zone-wrap">
        <div className="container">
          <div className="home-section-head">
            <h2 className="section-title">Espacios para marcas</h2>
            <a className="button" href="mailto:sinpelosenelmicrofonopodcast@gmail.com?subject=Media%20Kit%20Sin%20Pelos">
              Solicitar media kit
            </a>
          </div>
          <div className="home-grid-ads">
            <article className="card ad-slot hero-ad">
              <span className="badge">Patrocinio premium</span>
              <h3>Banner principal home</h3>
              <p className="muted">1200x280 · visible en primer scroll · ideal para lanzamientos.</p>
            </article>
            <article className="card ad-slot">
              <span className="badge">Patrocinio seccion</span>
              <h3>Bloque medio de contenido</h3>
              <p className="muted">1200x180 · entre noticias y comunidad · alto CTR editorial.</p>
            </article>
            <article className="card ad-slot">
              <span className="badge">Patrocinio lateral</span>
              <h3>Formato vertical marca</h3>
              <p className="muted">300x600 · formato branding para campañas always-on.</p>
            </article>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
