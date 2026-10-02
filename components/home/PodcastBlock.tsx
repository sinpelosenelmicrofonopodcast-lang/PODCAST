"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { HomePodcastItem } from "@/lib/homepageQueries";
import { SafeImage } from "@/components/home/SafeImage";

function compact(value: unknown) {
  return new Intl.NumberFormat("es-PR", { notation: "compact" }).format(Number(value ?? 0));
}

function sourceLink(item: HomePodcastItem | null | undefined) {
  const href = String(item?.source_url ?? "").trim();
  return href || "/podcast";
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
    source_url: item.id ? `https://www.youtube.com/watch?v=${item.id}` : "/podcast",
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

export function PodcastBlock({
  featured
}: {
  featured: HomePodcastItem | null;
}) {
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
          .filter((item) => !item?.isShort)
          .sort((a, b) => new Date(String(b?.publishedAt ?? 0)).getTime() - new Date(String(a?.publishedAt ?? 0)).getTime())[0];

        if (!cancelled && latestFullEpisode) {
          setResolvedFeatured(mapYouTubeItemToPodcast(latestFullEpisode));
        }
      } catch {
        // Keep a neutral library fallback if YouTube cannot be reached.
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
    <section className="home-media-section" aria-label="Podcast destacado">
      <div className="home-media-section-head">
        <h2>PODCAST DESTACADO</h2>
      </div>

      <article className="card home-podcast-featured">
        <div className="home-podcast-media">
          <SafeImage src={resolvedFeatured?.media_url} alt={resolvedFeatured?.title ?? "Podcast destacado"} loading="lazy" />
        </div>
        <div className="home-podcast-body">
          <span className="home-urgency-badge">{resolvedFeatured ? "DESTACADO HOY" : syncingYouTube ? "SINCRONIZANDO" : "PODCAST"}</span>
          <h3 className="clamp-2">{resolvedFeatured?.title ?? emptyTitle}</h3>
          <p className="clamp-2">{resolvedFeatured?.caption ?? emptyCaption}</p>
          {resolvedFeatured ? (
            <div className="home-podcast-metrics">
              <span>{compact(resolvedFeatured.metrics?.views)} views</span>
              <span>{compact(resolvedFeatured.metrics?.likes)} likes</span>
            </div>
          ) : null}
          <div className="home-cta-row">
            {resolvedFeatured ? (
              <a className="button" href={sourceLink(resolvedFeatured)} target="_blank" rel="noreferrer">
                VER EPISODIO
              </a>
            ) : null}
            <Link className={resolvedFeatured ? "button secondary" : "button"} href="/podcast">
              IR AL PODCAST
            </Link>
          </div>
        </div>
      </article>
    </section>
  );
}
