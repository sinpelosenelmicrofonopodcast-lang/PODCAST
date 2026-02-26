import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabaseServer } from "@/lib/supabaseServer";
import { PODCAST_RSS_URL } from "@/lib/podcastRss";
import { getYouTubeVideoId } from "@/lib/youtube";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "Feed – Últimos episodios y shorts | Sin Pelos en el Micrófono",
  description: "Últimos capítulos, shorts y audio podcast de Sin Pelos en el Micrófono."
};

type View = "all" | "episodes" | "shorts" | "audio";

type ExternalPost = {
  id: string;
  platform: string;
  title: string | null;
  caption: string | null;
  source_url: string | null;
  media_url: string | null;
  posted_at: string | null;
  metrics: {
    views?: number;
    likes?: number;
    comments?: number;
    durationSeconds?: number;
    isShort?: boolean;
  } | null;
};

const FEED_LIMIT = 30;
const PREVIEW_EPISODES = 3;
const PREVIEW_SHORTS = 4;
const PREVIEW_VIRAL = 3;

function uniqueExternalPosts(items: ExternalPost[]): ExternalPost[] {
  const seen = new Set<string>();
  const out: ExternalPost[] = [];
  for (const item of items) {
    const key = [
      String(item.platform ?? "").trim().toLowerCase(),
      String((item as any).external_id ?? "").trim().toLowerCase(),
      String(item.source_url ?? "").trim().toLowerCase(),
      String(item.id ?? "").trim().toLowerCase()
    ].join("|");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function normalizeView(input?: string): View {
  if (input === "episodes" || input === "shorts" || input === "audio" || input === "all") return input;
  return "all";
}

function formatNumber(value?: number) {
  if (value === undefined || value === null) return "—";
  return Intl.NumberFormat("es-PR", { notation: "compact" }).format(value);
}

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("es-PR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function isShortPost(post: ExternalPost) {
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
}

function mediaFor(post: ExternalPost) {
  if (post.media_url) return post.media_url;
  if (post.platform !== "YouTube") return null;
  const id = getYouTubeVideoId(post.source_url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

function FeedCard({ post, label }: { post: ExternalPost; label?: string }) {
  const thumb = mediaFor(post);
  const metrics = post.metrics ?? {};

  return (
    <article className="card feed-v4-card">
      <a href={post.source_url ?? "#"} target="_blank" rel="noreferrer" className="feed-v4-thumb-wrap">
        {thumb ? <img className="feed-v4-thumb" src={thumb} alt={post.title ?? "Post"} loading="lazy" /> : <div className="feed-v4-thumb-fallback" />}
        <div className="feed-v4-thumb-overlay" />
        <div className="feed-v4-badges">
          {label ? <span className="pill">{label}</span> : null}
          <span className="pill">{post.platform}</span>
        </div>
      </a>

      <div className="feed-v4-body">
        <h3 className="clamp-2">{post.title ?? "Post sin título"}</h3>

        <div className="feed-v4-meta muted">
          <span>{formatDate(post.posted_at)}</span>
          <span>·</span>
          <span>👁 {formatNumber(metrics.views)}</span>
          <span>♥ {formatNumber(metrics.likes)}</span>
          <span>💬 {formatNumber(metrics.comments)}</span>
        </div>

        <div className="feed-v4-actions">
          {post.source_url ? (
            <a className="button secondary" href={post.source_url} target="_blank" rel="noreferrer">
              Ver original
            </a>
          ) : (
            <span className="button secondary" aria-disabled="true">
              Sin enlace
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

export default async function FeedPage({
  searchParams
}: {
  searchParams?: { view?: string };
}) {
  const view = normalizeView(searchParams?.view);
  const supabase = supabaseServer();

  const { data: rows } = await supabase
    .from("external_posts")
    .select("id, platform, title, caption, metrics, source_url, posted_at, media_url")
    .order("posted_at", { ascending: false })
    .limit(FEED_LIMIT);

  const allPosts = uniqueExternalPosts(((rows ?? []) as ExternalPost[]).filter((p) => p.source_url));
  const episodes = allPosts.filter((p) => !isShortPost(p)).slice(0, 12);
  const shorts = allPosts.filter((p) => isShortPost(p)).slice(0, 16);
  const shortsPreview = shorts.slice(0, PREVIEW_SHORTS);
  const shortsPreviewIds = new Set(shortsPreview.map((p) => p.id));
  const viral = shorts
    .filter((p) => !shortsPreviewIds.has(p.id))
    .sort((a, b) => Number(b.metrics?.views ?? 0) - Number(a.metrics?.views ?? 0))
    .slice(0, 6);

  return (
    <main>
      <Navbar />
      <section className="section feed-v4">
        <div className="container">
          <header className="feed-v4-header">
            <div>
              <h1 className="section-title" style={{ margin: 0 }}>
                Feed
              </h1>
            </div>
            <div className="feed-v4-quick-stats muted">
              <span>{episodes.length} capítulos</span>
              <span>{shorts.length} shorts</span>
              <span>{allPosts.length} posts</span>
            </div>
          </header>

          <nav className="feed-v4-tabs" aria-label="Filtros del feed">
            <Link className={view === "all" ? "feed-v4-tab active" : "feed-v4-tab"} href="/feed?view=all">
              Todo
            </Link>
            <Link className={view === "episodes" ? "feed-v4-tab active" : "feed-v4-tab"} href="/feed?view=episodes">
              Capítulos
            </Link>
            <Link className={view === "shorts" ? "feed-v4-tab active" : "feed-v4-tab"} href="/feed?view=shorts">
              Shorts
            </Link>
            <Link className={view === "audio" ? "feed-v4-tab active" : "feed-v4-tab"} href="/feed?view=audio">
              Podcast (Audio)
            </Link>
          </nav>

          {allPosts.length === 0 ? (
            <div className="card" style={{ marginTop: 16 }}>
              <p className="muted" style={{ margin: 0 }}>
                Aún no hay contenido sincronizado. Verifica YouTube Sync en admin.
              </p>
            </div>
          ) : null}

          {view === "all" ? (
            <div className="feed-v4-blocks">
              <section className="feed-v4-block">
                <div className="feed-v4-block-head">
                  <h2 className="section-title">Episodios recientes</h2>
                  <Link className="muted" href="/feed?view=episodes">
                    Ver todos
                  </Link>
                </div>
                <div className="feed-v4-grid episodes">
                  {episodes.slice(0, PREVIEW_EPISODES).map((post) => (
                    <FeedCard key={post.id} post={post} label="Capítulo" />
                  ))}
                </div>
              </section>

              <section className="feed-v4-block">
                <div className="feed-v4-block-head">
                  <h2 className="section-title">Shorts</h2>
                  <Link className="muted" href="/feed?view=shorts">
                    Ver todos
                  </Link>
                </div>
                <div className="feed-v4-grid shorts">
                  {shortsPreview.map((post) => (
                    <FeedCard key={post.id} post={post} label="Short" />
                  ))}
                </div>
              </section>

              {viral.length > 0 ? (
                <section className="feed-v4-block">
                  <div className="feed-v4-block-head">
                    <h2 className="section-title">Clips virales</h2>
                  </div>
                  <div className="feed-v4-grid viral">
                    {viral.slice(0, PREVIEW_VIRAL).map((post) => (
                      <FeedCard key={post.id} post={post} label="Viral" />
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="feed-v4-block card feed-v4-audio">
                <div className="feed-v4-block-head" style={{ marginBottom: 8 }}>
                  <h2 className="section-title">Podcast completo (audio)</h2>
                  <a className="button secondary" href={PODCAST_RSS_URL} target="_blank" rel="noreferrer">
                    RSS XML
                  </a>
                </div>
                <iframe
                  src="https://player.rss.com/sin-pelos-en-el-microfono/?theme=dark&v=2"
                  title="Sin Pelos En El Micrófono"
                  width="100%"
                  height="300"
                  frameBorder={0}
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  scrolling="no"
                >
                  <a href="https://rss.com/podcasts/sin-pelos-en-el-microfono/">Sin Pelos En El Micrófono</a>
                </iframe>
              </section>
            </div>
          ) : null}

          {view === "episodes" ? (
            <section className="feed-v4-blocks" style={{ marginTop: 14 }}>
              <div className="feed-v4-grid episodes">
                {episodes.map((post) => (
                  <FeedCard key={post.id} post={post} label="Capítulo" />
                ))}
              </div>
            </section>
          ) : null}

          {view === "shorts" ? (
            <section className="feed-v4-blocks" style={{ marginTop: 14 }}>
              <div className="feed-v4-grid shorts">
                {shorts.map((post) => (
                  <FeedCard key={post.id} post={post} label="Short" />
                ))}
              </div>
            </section>
          ) : null}

          {view === "audio" ? (
            <section className="feed-v4-blocks" style={{ marginTop: 14 }}>
              <article className="card feed-v4-audio">
                <div className="feed-v4-block-head" style={{ marginBottom: 8 }}>
                  <h2 className="section-title">Podcast (audio)</h2>
                  <a className="button secondary" href={PODCAST_RSS_URL} target="_blank" rel="noreferrer">
                    RSS XML
                  </a>
                </div>
                <iframe
                  src="https://player.rss.com/sin-pelos-en-el-microfono/?theme=dark&v=2"
                  title="Sin Pelos En El Micrófono"
                  width="100%"
                  height="393"
                  frameBorder={0}
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  scrolling="no"
                >
                  <a href="https://rss.com/podcasts/sin-pelos-en-el-microfono/">Sin Pelos En El Micrófono</a>
                </iframe>
              </article>

              <div className="feed-v4-block-head" style={{ marginTop: 18 }}>
                <h2 className="section-title">Últimos capítulos</h2>
                <Link className="muted" href="/feed?view=episodes">
                  Ver más
                </Link>
              </div>
              <div className="feed-v4-grid episodes">
                {episodes.slice(0, 6).map((post) => (
                  <FeedCard key={post.id} post={post} label="Capítulo" />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </section>
      <Footer />
    </main>
  );
}
