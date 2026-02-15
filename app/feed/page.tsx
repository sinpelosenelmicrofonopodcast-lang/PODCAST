import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { AuthWall } from "@/components/AuthWall";
import { supabaseServer } from "@/lib/supabaseServer";
import { ShareButtons } from "@/components/ShareButtons";
import { YouTubeInlinePlayer } from "@/components/YouTubeInlinePlayer";
import { getYouTubeVideoId } from "@/lib/youtube";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatNumber(value?: number) {
  if (value === undefined || value === null) return "—";
  return Intl.NumberFormat("es-PR").format(value);
}

function formatDuration(seconds?: number) {
  if (!seconds && seconds !== 0) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default async function FeedPage() {
  const supabase = supabaseServer();
  const { data } = await supabase
    .from("external_posts")
    .select("id, platform, title, caption, metrics, source_url, posted_at, media_url")
    .order("posted_at", { ascending: false })
    .limit(50);

  return (
    <main>
      <AuthWall />
      <Navbar />
      <section className="section feed-page">
        <div className="container">
          <h1 className="section-title">Feed Unificado</h1>
          <p className="muted">Todo el contenido centralizado. Filtro por plataforma en versión completa.</p>
          {data && data.length > 0 ? (
            <div style={{ marginTop: 20, display: "grid", gap: 24 }}>
              {(() => {
                const isShortPost = (post: any) => {
                  const metrics = (post.metrics as any) ?? {};
                  if (metrics.isShort === true) return true;
                  const duration = Number(metrics.durationSeconds);
                  if (!Number.isNaN(duration) && duration > 0 && duration <= 60) return true;
                  const sourceUrl = String(post.source_url ?? "");
                  if (sourceUrl.includes("youtube.com/shorts/")) return true;
                  const t = `${post.title ?? ""} ${post.caption ?? ""}`.toLowerCase();
                  if (t.includes("#shorts") || t.includes(" #short ")) return true;
                  return false;
                };

                const full = data.filter((post) => !isShortPost(post));

                const renderCard = (post: any) => {
                  const metrics = (post.metrics as any) ?? {};
                  const isShort = metrics.isShort === true;
                  const ytId = post.platform === "YouTube" ? getYouTubeVideoId(post.source_url) : null;
                  return (
                    <article key={post.id} className="card feed-card" style={{ display: "grid", gap: 12 }}>
                      {ytId ? (
                        <YouTubeInlinePlayer
                          videoId={ytId}
                          title={post.title}
                          thumbnailUrl={post.media_url}
                          className="yt-inline"
                        />
                      ) : post.media_url ? (
                        <a href={post.source_url ?? "#"} target="_blank" rel="noreferrer">
                          <img
                            src={post.media_url}
                            alt={post.title ?? "Post"}
                            style={{ width: "100%", borderRadius: 12, objectFit: "cover", aspectRatio: "16 / 9" }}
                          />
                        </a>
                      ) : null}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <h3 className="clamp-2" style={{ margin: 0, fontSize: 18 }}>
                          {post.title ?? "Post sin título"}
                        </h3>
                        <span className="badge">{post.platform}{isShort ? " · SHORT" : ""}</span>
                      </div>
                      {post.caption ? (
                        <p className="muted clamp-3" style={{ margin: 0 }}>
                          {post.caption}
                        </p>
                      ) : null}
                      <div className="muted" style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12 }}>
                        <span>Views: {formatNumber(metrics.views)}</span>
                        <span>Likes: {formatNumber(metrics.likes)}</span>
                        <span>Comments: {formatNumber(metrics.comments)}</span>
                        <span>Duración: {formatDuration(metrics.durationSeconds)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                        <span className="muted" style={{ fontSize: 12 }}>
                          {post.posted_at ? new Date(post.posted_at).toLocaleDateString("es-PR") : ""}
                        </span>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          {post.source_url ? (
                            <a className="button secondary" href={post.source_url} target="_blank" rel="noreferrer">
                              Ver original
                            </a>
                          ) : null}
                          <ShareButtons path="/feed" text={post.title ?? "Sin Pelos"} />
                        </div>
                      </div>
                    </article>
                  );
                };

                return (
                  <>
                    <div>
                      <h2 className="section-title" style={{ fontSize: 30 }}>Capítulos completos</h2>
                      <div
                        className="grid feed-full-grid"
                        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", marginTop: 14 }}
                      >
                        {full.length > 0 ? full.map(renderCard) : (
                          <div className="card">
                            <p className="muted">No hay capítulos completos todavía.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (
            <div className="card" style={{ marginTop: 20 }}>
              <p className="muted">Aún no hay contenido para mostrar.</p>
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}
