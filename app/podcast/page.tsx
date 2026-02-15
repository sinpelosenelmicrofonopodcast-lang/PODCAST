import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { AuthWall } from "@/components/AuthWall";
import { supabaseServer } from "@/lib/supabaseServer";
import { YouTubeInlinePlayer } from "@/components/YouTubeInlinePlayer";
import { getYouTubeVideoId, isShorts } from "@/lib/youtube";
import { PODCAST_RSS_URL } from "@/lib/podcastRss";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ExternalPost = {
  id: string;
  title: string;
  caption: string | null;
  metrics: any;
  source_url: string | null;
  posted_at: string | null;
  media_url: string | null;
};

function formatMetric(value?: number) {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("es-PR", { notation: "compact" }).format(value);
}

function isShortPost(post: ExternalPost) {
  const m = (post.metrics ?? {}) as any;
  if (m.isShort === true) return true;
  const duration = Number(m.durationSeconds);
  if (!Number.isNaN(duration) && isShorts(duration)) return true;
  const sourceUrl = String(post.source_url ?? "");
  if (sourceUrl.includes("youtube.com/shorts/")) return true;
  const t = `${post.title ?? ""} ${post.caption ?? ""}`.toLowerCase();
  if (t.includes("#shorts") || t.includes(" #short ")) return true;
  return false;
}

export default async function PodcastPage() {
  const supabase = supabaseServer();
  const { data } = await supabase
    .from("external_posts")
    .select("id, platform, title, caption, metrics, source_url, posted_at, media_url")
    .eq("platform", "YouTube")
    .order("posted_at", { ascending: false })
    .limit(60);

  const all = ((data ?? []) as ExternalPost[]).filter((p) => !isShortPost(p));
  const lead = all[0] ?? null;
  const rest = all.slice(1, 13);

  const leadId = lead?.source_url ? getYouTubeVideoId(lead.source_url) : null;

  return (
    <main>
      <AuthWall />
      <Navbar />
      <section className="section">
        <div className="container">
          <div className="home-section-head">
            <h1 className="section-title" style={{ marginTop: 0 }}>Podcast</h1>
            <a className="button secondary" href={PODCAST_RSS_URL} target="_blank" rel="noreferrer">
              RSS (Audio)
            </a>
          </div>

          <article className="card home-lead-card" style={{ marginTop: 12 }}>
            <span className="badge">Último episodio completo</span>
            {leadId ? (
              <YouTubeInlinePlayer videoId={leadId} title={lead?.title ?? null} thumbnailUrl={lead?.media_url ?? null} className="yt-inline" />
            ) : lead?.media_url ? (
              <img className="cover-wide" src={lead.media_url} alt={lead.title ?? "Episodio"} />
            ) : null}
            <h2 className="clamp-2" style={{ marginTop: 10, fontSize: 22 }}>
              {lead?.title ?? "Aún no hay episodios"}
            </h2>
            <div className="muted metrics-row">
              <span>Views: {formatMetric((lead?.metrics ?? {})?.views)}</span>
              <span>Likes: {formatMetric((lead?.metrics ?? {})?.likes)}</span>
              <span>{lead?.posted_at ? new Date(lead.posted_at).toLocaleDateString("es-PR") : ""}</span>
            </div>
            {lead?.source_url ? (
              <a className="button secondary" href={lead.source_url} target="_blank" rel="noreferrer">
                Ver completo en YouTube
              </a>
            ) : null}
          </article>

          <div className="home-section-head" style={{ marginTop: 18 }}>
            <h2 className="section-title" style={{ fontSize: 22 }}>Más episodios</h2>
          </div>

          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginTop: 10 }}>
            {rest.length > 0 ? (
              rest.map((p) => {
                const ytId = p.source_url ? getYouTubeVideoId(p.source_url) : null;
                return (
                  <article key={p.id} className="card">
                    {ytId ? (
                      <YouTubeInlinePlayer videoId={ytId} title={p.title ?? null} thumbnailUrl={p.media_url ?? null} className="yt-inline" />
                    ) : p.media_url ? (
                      <a href={p.source_url ?? "#"} target="_blank" rel="noreferrer">
                        <img
                          src={p.media_url}
                          alt={p.title ?? "Episodio"}
                          style={{ width: "100%", borderRadius: 12, objectFit: "cover", aspectRatio: "16 / 9" }}
                          loading="lazy"
                          decoding="async"
                        />
                      </a>
                    ) : null}
                    <h3 className="clamp-2" style={{ marginTop: 10 }}>{p.title ?? "Episodio"}</h3>
                    <div className="muted metrics-row">
                      <span>Views: {formatMetric((p.metrics ?? {})?.views)}</span>
                      <span>Likes: {formatMetric((p.metrics ?? {})?.likes)}</span>
                      <span>{p.posted_at ? new Date(p.posted_at).toLocaleDateString("es-PR") : ""}</span>
                    </div>
                    {p.source_url ? (
                      <a className="button secondary" href={p.source_url} target="_blank" rel="noreferrer">
                        Ver en YouTube
                      </a>
                    ) : null}
                  </article>
                );
              })
            ) : (
              <div className="card">
                <p className="muted">Aún no hay episodios completos para mostrar.</p>
              </div>
            )}
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
