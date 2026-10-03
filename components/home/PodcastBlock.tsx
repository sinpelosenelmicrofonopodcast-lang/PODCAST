"use client";

import { ListenLinks } from "@/components/podcast/ListenLinks";
import Link from "next/link";
import type { Route } from "next";
import { useEffect, useState } from "react";
import type { HomePodcastItem } from "@/lib/homepageQueries";
import { SafeImage } from "@/components/home/SafeImage";

function compact(value: unknown) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "0";
  return new Intl.NumberFormat("es-PR", { notation: "compact" }).format(n);
}

function videoIdFromSource(input?: string | null) {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  const direct = raw.match(/^[A-Za-z0-9_-]{11}$/)?.[0];
  if (direct) return direct;
  const match = raw.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|live\/|embed\/))([A-Za-z0-9_-]{11})/i);
  return match?.[1] ?? null;
}

function internalEpisodeLink(item: HomePodcastItem | null | undefined): Route {
  const videoId = videoIdFromSource(item?.source_url) || (/^[A-Za-z0-9_-]{11}$/.test(String(item?.id ?? "")) ? item?.id : null);
  return (videoId ? `/podcast/${encodeURIComponent(videoId)}` : "/podcast") as Route;
}

function cleanCaption(value?: string | null) {
  let text = String(value ?? "").replace(/\r/g, "").trim();
  if (!text) return "Conversación completa, sin libreto y sin filtro.";
  const markers = ["¿Te atreves a escuchar la verdad?", "🔗 Conecta con la Comunidad", "Conecta con la Comunidad", "🌐 Website:"];
  for (const marker of markers) {
    const idx = text.indexOf(marker);
    if (idx > 0) text = text.slice(0, idx);
  }
  text = text.replace(/https?:\/\/\S+/g, "").replace(/\n+/g, " ").replace(/\s{2,}/g, " ").trim();
  return text || "Conversación completa, sin libreto y sin filtro.";
}

type YouTubeApiItem = {
  id: string;
  title?: string;
  description?: string;
  publishedAt?: string;
  thumbnailUrl?: string;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  durationSeconds?: number;
  isShort?: boolean;
};

function mapYouTubeItemToPodcast(item: YouTubeApiItem): HomePodcastItem {
  return {
    id: String(item.id ?? "").trim(),
    title: String(item.title ?? "").trim() || "Podcast destacado",
    caption: String(item.description ?? "").trim() || null,
    source_url: item.id ? `https://www.youtube.com/watch?v=${item.id}` : null,
    media_url: String(item.thumbnailUrl ?? "").trim() || null,
    posted_at: String(item.publishedAt ?? "").trim() || null,
    platform: "YouTube",
    metrics: {
      views: Number(item.viewCount ?? 0),
      likes: Number(item.likeCount ?? 0),
      comments: Number(item.commentCount ?? 0),
      durationSeconds: Number(item.durationSeconds ?? 0),
      isShort: false
    }
  };
}

export function PodcastBlock({ featured }: { featured: HomePodcastItem | null }) {
  const [resolvedFeatured, setResolvedFeatured] = useState<HomePodcastItem | null>(featured);
  const [syncingYouTube, setSyncingYouTube] = useState(!featured);

  useEffect(() => {
    setResolvedFeatured(featured);
    setSyncingYouTube(!featured);
  }, [featured]);

  useEffect(() => {
    if (featured) return;
    let cancelled = false;

    async function loadLatestEpisode() {
      try {
        const res = await fetch("/api/social/youtube", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const items = Array.isArray(data?.items) ? (data.items as YouTubeApiItem[]) : [];
        const latestFullEpisode = [...items]
          .filter((item) => !item?.isShort && Number(item?.durationSeconds ?? 0) >= 8 * 60)
          .sort((a, b) => new Date(String(b?.publishedAt ?? 0)).getTime() - new Date(String(a?.publishedAt ?? 0)).getTime())[0];
        if (!cancelled && latestFullEpisode) setResolvedFeatured(mapYouTubeItemToPodcast(latestFullEpisode));
      } catch {
        // Neutral library fallback below.
      } finally {
        if (!cancelled) setSyncingYouTube(false);
      }
    }

    void loadLatestEpisode();
    return () => {
      cancelled = true;
    };
  }, [featured]);

  const emptyTitle = syncingYouTube ? "Cargando el último episodio…" : "Explora los episodios de Sin Pelos";
  const emptyCaption = syncingYouTube
    ? "Estamos sincronizando YouTube para mostrarte el episodio completo más reciente."
    : "Entra al archivo del podcast para ver episodios, invitados y conversaciones completas.";

  return (
    <section className="home-media-section" aria-label="Último episodio del podcast">
      <div className="home-media-section-head spm-section-heading-row">
        <div>
          <span className="spm-section-kicker">RECIÉN SALIDO DEL MICRÓFONO</span>
          <h2>ÚLTIMO EPISODIO</h2>
        </div>
        <Link className="spm-text-link" href="/podcast">VER TODOS <span>→</span></Link>
      </div>

      <article className="card home-podcast-featured">
        <Link className="home-podcast-media" href={internalEpisodeLink(resolvedFeatured)} aria-label="Abrir último episodio">
          <SafeImage src={resolvedFeatured?.media_url} alt={resolvedFeatured?.title ?? "Último episodio"} loading="eager" />
          {resolvedFeatured ? <span className="spm-play-button" aria-hidden="true">▶</span> : null}
        </Link>
        <div className="home-podcast-body">
          <span className="home-urgency-badge">{resolvedFeatured ? "NUEVO EPISODIO" : syncingYouTube ? "SINCRONIZANDO" : "PODCAST"}</span>
          <h3 className="clamp-2">{resolvedFeatured?.title ?? emptyTitle}</h3>
          <p className="clamp-3">{resolvedFeatured ? cleanCaption(resolvedFeatured.caption) : emptyCaption}</p>
          {resolvedFeatured ? (
            <div className="home-podcast-metrics">
              {Number(resolvedFeatured.metrics?.views ?? 0) > 0 ? <span>{compact(resolvedFeatured.metrics?.views)} views</span> : null}
              {Number(resolvedFeatured.metrics?.likes ?? 0) > 0 ? <span>{compact(resolvedFeatured.metrics?.likes)} likes</span> : null}
            </div>
          ) : null}
          <div className="home-cta-row">
            {resolvedFeatured ? (
              <Link className="button" href={internalEpisodeLink(resolvedFeatured)}>
                VER EPISODIO
              </Link>
            ) : null}
            {resolvedFeatured?.source_url ? (
              <a className="button secondary" href={resolvedFeatured.source_url} target="_blank" rel="noreferrer">
                YOUTUBE
              </a>
            ) : (
              <Link className="button" href="/podcast">IR AL PODCAST</Link>
            )}
          </div>
          <ListenLinks />
        </div>
      </article>
    </section>
  );
}
