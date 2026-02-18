"use client";

import { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabase } from "@/lib/supabaseClient";
import { ShareButtons } from "@/components/ShareButtons";
import { YouTubeInlinePlayer } from "@/components/YouTubeInlinePlayer";
import { getYouTubeVideoId } from "@/lib/youtube";
import { useProtectedUser } from "@/lib/useProtectedUser";

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

function isShortPost(post: ExternalPost) {
  const metrics = post.metrics ?? {};
  if (metrics.isShort === true) return true;
  const duration = Number(metrics.durationSeconds);
  if (!Number.isNaN(duration) && duration > 0 && duration <= 60) return true;
  const sourceUrl = String(post.source_url ?? "");
  if (sourceUrl.includes("youtube.com/shorts/")) return true;
  const t = `${post.title ?? ""} ${post.caption ?? ""}`.toLowerCase();
  if (t.includes("#shorts") || t.includes(" #short ")) return true;
  return false;
}

export default function FeedPage() {
  const { checking, userId } = useProtectedUser();
  const [view, setView] = useState<"episodes" | "shorts" | "all">("all");

  const [isMobile, setIsMobile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ExternalPost[]>([]);

  useEffect(() => {
    const update = () => setIsMobile(window.matchMedia("(max-width: 900px)").matches);
    update();
    window.addEventListener("resize", update, { passive: true });
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const current = new URLSearchParams(window.location.search).get("view");
    if (current === "episodes" || current === "shorts" || current === "all") setView(current);
    else setView("all");
  }, []);

  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    const load = async () => {
      setLoading(true);
      const limit = isMobile ? 24 : 50;
      const { data } = await supabase
        .from("external_posts")
        .select("id, platform, title, caption, metrics, source_url, posted_at, media_url")
        .order("posted_at", { ascending: false })
        .limit(limit);
      if (!mounted) return;
      setData((data as ExternalPost[]) ?? []);
      setLoading(false);
    };
    load();
    return () => {
      mounted = false;
    };
  }, [isMobile, userId]);

  const full = useMemo(() => data.filter((post) => !isShortPost(post)), [data]);
  const shorts = useMemo(() => data.filter((post) => isShortPost(post)), [data]);

  const buildHref = (next: "episodes" | "shorts" | "all") => `/feed?view=${next}`;

  const renderCard = (post: ExternalPost) => {
    const metrics = post.metrics ?? {};
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

  const renderMobileItem = (post: ExternalPost) => {
    const metrics = post.metrics ?? {};
    const ytId = post.platform === "YouTube" ? getYouTubeVideoId(post.source_url) : null;
    const thumb = post.media_url || (ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : "");
    const href = String(post.source_url ?? "").trim() || "#";
    return (
      <a key={post.id} className="feed-mini" href={href} target="_blank" rel="noreferrer">
        <div className="feed-mini-thumb">
          {thumb ? <img src={thumb} alt={post.title ?? "Post"} loading="lazy" /> : <div className="feed-mini-fallback" />}
        </div>
        <div className="feed-mini-body">
          <div className="feed-mini-top">
            <div className="feed-mini-title clamp-2">{post.title ?? "Post sin título"}</div>
            <span className="badge">{post.platform}</span>
          </div>
          {post.caption ? <div className="muted clamp-2">{post.caption}</div> : null}
          <div className="feed-mini-meta muted">
            <span>{post.posted_at ? new Date(post.posted_at).toLocaleDateString("es-PR") : ""}</span>
            <span className="dot">·</span>
            <span>👁 {formatNumber(metrics.views)}</span>
            <span className="dot">·</span>
            <span>♥ {formatNumber(metrics.likes)}</span>
          </div>
        </div>
      </a>
    );
  };

  const mobileItems = view === "episodes" ? full.slice(0, 12) : view === "shorts" ? shorts.slice(0, 12) : data.slice(0, 12);

  return (
    <main>
      <Navbar />
      <section className="section feed-page">
        <div className="container">
          <div className="home-section-head">
            <div style={{ display: "grid", gap: 6 }}>
              <h1 className="section-title" style={{ margin: 0 }}>Feed</h1>
              <p className="muted" style={{ margin: 0 }}>
                {view === "episodes"
                  ? "Capítulos completos (sin Shorts)."
                  : view === "shorts"
                    ? "Shorts / clips (rápido)."
                    : "Lo último: capítulos + shorts."}
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div className="feed-subtabs" aria-label="Vistas del feed">
                <a className={view === "all" ? "feed-subtab active" : "feed-subtab"} href={buildHref("all")}>Todo</a>
                <a className={view === "episodes" ? "feed-subtab active" : "feed-subtab"} href={buildHref("episodes")}>Capítulos</a>
                <a className={view === "shorts" ? "feed-subtab active" : "feed-subtab"} href={buildHref("shorts")}>Shorts</a>
              </div>
              <a className="button secondary" href="/rss">
                Podcast (Audio)
              </a>
            </div>
          </div>

          {checking || loading ? (
            <div className="card" style={{ marginTop: 20 }}>
              <p className="muted">Cargando feed...</p>
            </div>
          ) : null}

          {!checking && !loading && data.length > 0 ? (
            <div style={{ marginTop: 20, display: "grid", gap: 24 }}>
              {isMobile ? (
                <div className="feed-mobile">
                  <div className="feed-mobile-head">
                    <h2 className="section-title" style={{ fontSize: 22, margin: 0 }}>Últimos</h2>
                    <a className="button secondary" href={buildHref("all")}>
                      Ver todo
                    </a>
                  </div>
                  <div className="feed-mini-list">
                    {mobileItems.map(renderMobileItem)}
                  </div>
                </div>
              ) : (
                <>
                  {view !== "episodes" && shorts.length > 0 ? (
                    <div>
                      <h2 className="section-title" style={{ fontSize: 26, marginBottom: 8 }}>Shorts</h2>
                      <div className="feed-shorts-row" aria-label="Shorts en carrusel">
                        {shorts.slice(0, 12).map((p) => (
                          <div key={p.id} className="feed-short-card">
                            {renderCard(p)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {view !== "shorts" ? (
                    <div>
                      <h2 className="section-title" style={{ fontSize: 26, marginBottom: 8 }}>Capítulos completos</h2>
                      <div className="grid feed-full-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", marginTop: 14 }}>
                        {full.length > 0 ? full.map(renderCard) : (
                          <div className="card">
                            <p className="muted">No hay capítulos completos todavía.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="grid feed-full-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
                      {shorts.length > 0 ? shorts.map(renderCard) : (
                        <div className="card">
                          <p className="muted">No hay shorts todavía.</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : null}

          {!checking && !loading && data.length === 0 ? (
            <div className="card" style={{ marginTop: 20 }}>
              <p className="muted">Aún no hay contenido para mostrar.</p>
            </div>
          ) : null}
        </div>
      </section>
      <Footer />
    </main>
  );
}
