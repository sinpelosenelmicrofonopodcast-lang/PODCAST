import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Logo } from "@/components/Logo";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const supabase = supabaseServer();

  const [{ data: youtubePosts }, { data: latestNews }, { data: latestBlog }, { data: latestThread }] =
    await Promise.all([
      supabase
        .from("external_posts")
        .select("id, title, platform, source_url, posted_at, media_url, metrics")
        .eq("platform", "YouTube")
        .order("posted_at", { ascending: false })
        .limit(10),
      supabase
        .from("news_items")
        .select("id, title, summary, published_at")
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
        .single()
    ]);

  const isShort = (post: any) => {
    const metrics = (post?.metrics as any) ?? {};
    if (metrics.isShort === true) return true;
    const duration = Number(metrics.durationSeconds);
    return !Number.isNaN(duration) && duration > 0 && duration <= 60;
  };

  const latestEpisode = (youtubePosts ?? []).find((post) => !isShort(post));
  const episodeMetrics = (latestEpisode as any)?.metrics ?? {};

  return (
    <main className="app-enter">
      <Navbar />
      <section className="hero container">
        <span className="kicker">Plataforma 21+ · Comunidad sin miedo</span>
        <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
          <Logo size={88} animated />
          <h1 className="hero-title">Sin Pelos en el Micrófono</h1>
        </div>
        <p className="hero-sub">
          No somos una app de podcast. Somos una plaza pública privada para opinión real,
          análisis incómodo y comunidad adulta. Aquí no dependemos de algoritmos externos.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link className="button" href="/register">
            Entrar al sistema
          </Link>
          <Link className="button secondary" href="/feed">
            Ver el feed unificado
          </Link>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title">Lo más reciente</h2>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", marginTop: 18 }}>
            <div className="card" style={{ display: "grid", gap: 12 }}>
              <span className="badge">Episodio más reciente</span>
              {latestEpisode?.media_url ? (
                <img
                  src={latestEpisode.media_url}
                  alt={latestEpisode.title}
                  style={{ width: "100%", borderRadius: 12, objectFit: "cover" }}
                />
              ) : null}
              <h3 style={{ marginTop: 0 }}>{latestEpisode?.title ?? "Aún no hay episodios"}</h3>
              <div className="muted" style={{ fontSize: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span>Views: {episodeMetrics.views ?? "—"}</span>
                <span>Likes: {episodeMetrics.likes ?? "—"}</span>
              </div>
              <Link className="button secondary" href={latestEpisode?.source_url ?? "/feed"}>
                Ver episodio
              </Link>
            </div>

            <div className="card" style={{ display: "grid", gap: 12 }}>
              <span className="badge">Noticia más reciente</span>
              <h3 style={{ marginTop: 0 }}>{latestNews?.title ?? "Aún no hay noticias"}</h3>
              <p className="muted">{latestNews?.summary ?? ""}</p>
              <Link className="button secondary" href="/noticias">
                Ver noticias
              </Link>
            </div>

            <div className="card" style={{ display: "grid", gap: 12 }}>
              <span className="badge">Blog más reciente</span>
              {latestBlog?.cover_url ? (
                <img
                  src={latestBlog.cover_url}
                  alt={latestBlog.title}
                  style={{ width: "100%", borderRadius: 12, objectFit: "cover" }}
                />
              ) : null}
              <h3 style={{ marginTop: 0 }}>{latestBlog?.title ?? "Aún no hay artículos"}</h3>
              <p className="muted">{latestBlog?.excerpt ?? ""}</p>
              <Link className="button secondary" href="/blog">
                Ir al blog
              </Link>
            </div>

            <div className="card" style={{ display: "grid", gap: 12 }}>
              <span className="badge">Comunidad activa</span>
              <h3 style={{ marginTop: 0 }}>{latestThread?.title ?? "Aún no hay threads"}</h3>
              <p className="muted">{latestThread?.body ?? ""}</p>
              <Link className="button secondary" href="/community">
                Entrar a comunidad
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          <div className="card">
            <span className="badge">Centro de operaciones</span>
            <h3>Post once, publish everywhere</h3>
            <p className="muted">Control total de contenido con programación, previews y métricas.</p>
          </div>
          <div className="card">
            <span className="badge">Comunidad 21+</span>
            <h3>Debate sin censura ideológica</h3>
            <p className="muted">Sin doxxing ni amenazas. Solo pensamiento crítico y conversación real.</p>
          </div>
          <div className="card">
            <span className="badge">Zona Cruda</span>
            <h3>Free for all con responsabilidad</h3>
            <p className="muted">Lenguaje explícito permitido bajo reglas legales claras.</p>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
