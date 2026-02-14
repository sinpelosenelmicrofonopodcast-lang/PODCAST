import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabaseServer } from "@/lib/supabaseServer";
import { ShareButtons } from "@/components/ShareButtons";

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
      <Navbar />
      <section className="section">
        <div className="container">
          <h1 className="section-title">Feed Unificado</h1>
          <p className="muted">Todo el contenido centralizado. Filtro por plataforma en versión completa.</p>
          {data && data.length > 0 ? (
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", marginTop: 20 }}>
              {(() => {
                const isShortPost = (post: any) => {
                  const metrics = (post.metrics as any) ?? {};
                  if (metrics.isShort === true) return true;
                  const duration = Number(metrics.durationSeconds);
                  if (!Number.isNaN(duration) && duration > 0 && duration <= 60) return true;
                  return false;
                };

                const shorts = data.filter((post) => isShortPost(post));
                const full = data.filter((post) => !isShortPost(post));

                const renderCard = (post: any) => {
                  const metrics = (post.metrics as any) ?? {};
                  const isShort = metrics.isShort === true;
                  return (
                    <div key={post.id} className="card" style={{ display: "grid", gap: 12 }}>
                      {post.media_url ? (
                        <a href={post.source_url ?? "#"} target="_blank" rel="noreferrer">
                          <img
                            src={post.media_url}
                            alt={post.title ?? "Post"}
                            style={{ width: "100%", borderRadius: 12, objectFit: "cover" }}
                          />
                        </a>
                      ) : null}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <h3 style={{ margin: 0 }}>{post.title ?? "Post sin título"}</h3>
                        <span className="badge">{post.platform}{isShort ? " · SHORT" : ""}</span>
                      </div>
                      <div className="muted" style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12 }}>
                        <span>Views: {formatNumber(metrics.views)}</span>
                        <span>Likes: {formatNumber(metrics.likes)}</span>
                        <span>Comments: {formatNumber(metrics.comments)}</span>
                        <span>Duración: {formatDuration(metrics.durationSeconds)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span className="muted" style={{ fontSize: 12 }}>
                          {post.posted_at ? new Date(post.posted_at).toLocaleDateString("es-PR") : ""}
                        </span>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          {post.source_url ? (
                            <a className="button secondary" href={post.source_url} target="_blank" rel="noreferrer">
                              Ver original
                            </a>
                          ) : null}
                          <ShareButtons path="/feed" text={post.title ?? "Sin Pelos"} />
                        </div>
                      </div>
                    </div>
                  );
                };

                return (
                  <>
                    <div style={{ marginTop: 24 }}>
                      <h2 className="section-title" style={{ fontSize: 28 }}>Capítulos completos</h2>
                      <div
                        className="grid"
                        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", marginTop: 12 }}
                      >
                        {full.length > 0 ? full.map(renderCard) : (
                          <div className="card">
                            <p className="muted">No hay capítulos completos todavía.</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ marginTop: 32 }}>
                      <h2 className="section-title" style={{ fontSize: 28 }}>Shorts</h2>
                      {shorts.length > 0 ? (
                        <div
                          style={{
                            display: "grid",
                            gridAutoFlow: "column",
                            gridAutoColumns: "minmax(220px, 1fr)",
                            gap: 16,
                            overflowX: "auto",
                            paddingBottom: 8,
                            marginTop: 12
                          }}
                        >
                          {shorts.map(renderCard)}
                        </div>
                      ) : (
                        <div className="card">
                          <p className="muted">No hay shorts todavía.</p>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (
            <div className="card" style={{ marginTop: 20 }}>
              <p className="muted">Aún no hay contenido sincronizado. Entra a /admin y presiona “Sincronizar ahora”.</p>
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}
