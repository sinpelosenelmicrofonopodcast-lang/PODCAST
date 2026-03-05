"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getYouTubeVideoId } from "@/lib/youtube";
import type { ExternalPodcastPost } from "@/lib/feedEpisodes";

type EpisodesResponse = {
  ok: boolean;
  items: ExternalPodcastPost[];
  nextCursor: string | null;
  hasMore: boolean;
  error?: string;
};

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

function mediaFor(post: ExternalPodcastPost) {
  if (post.media_url) return post.media_url;
  const id = getYouTubeVideoId(post.source_url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

export function EpisodesInfinite({
  initialItems,
  initialCursor,
  initialHasMore,
  pageSize = 12
}: {
  initialItems: ExternalPodcastPost[];
  initialCursor: string | null;
  initialHasMore: boolean;
  pageSize?: number;
}) {
  const [items, setItems] = useState<ExternalPodcastPost[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [hasMore, setHasMore] = useState<boolean>(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const itemIds = useMemo(() => new Set(items.map((item) => item.id)), [items]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    setError(null);

    const qs = new URLSearchParams();
    qs.set("limit", String(pageSize));
    if (cursor) qs.set("cursor", cursor);

    const res = await fetch(`/api/feed/episodes?${qs.toString()}`, { cache: "no-store" }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as EpisodesResponse | null;

    if (!res?.ok || !json?.ok) {
      setError(json?.error ?? "No se pudieron cargar más episodios.");
      setLoading(false);
      return;
    }

    setItems((prev) => {
      const next = [...prev];
      const seen = new Set(itemIds);
      (json.items ?? []).forEach((item) => {
        if (seen.has(item.id)) return;
        seen.add(item.id);
        next.push(item);
      });
      return next;
    });

    setCursor(json.nextCursor ?? null);
    setHasMore(Boolean(json.hasMore));
    setLoading(false);
  }, [cursor, hasMore, itemIds, loading, pageSize]);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "300px 0px" }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  if (items.length === 0) {
    return (
      <section className="feed-v4-blocks" style={{ marginTop: 14 }}>
        <div className="card" style={{ marginTop: 6 }}>
          <p className="muted" style={{ margin: 0 }}>
            Aún no hay episodios sincronizados.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="feed-v4-blocks" style={{ marginTop: 14 }}>
      <div className="feed-v4-grid episodes">
        {items.map((post) => {
          const thumb = mediaFor(post);
          const metrics = post.metrics ?? {};
          return (
            <article key={post.id} className="card feed-v4-card">
              <a href={post.source_url ?? "#"} target="_blank" rel="noreferrer" className="feed-v4-thumb-wrap">
                {thumb ? (
                  <img className="feed-v4-thumb" src={thumb} alt={post.title ?? "Post"} loading="lazy" />
                ) : (
                  <div className="feed-v4-thumb-fallback" />
                )}
                <div className="feed-v4-thumb-overlay" />
                <div className="feed-v4-badges">
                  <span className="pill">Capítulo</span>
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
        })}
      </div>

      {error ? (
        <p className="muted" style={{ marginTop: 12 }}>
          {error}
        </p>
      ) : null}

      <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
        {hasMore ? (
          <button type="button" className="button secondary" onClick={loadMore} disabled={loading}>
            {loading ? "Cargando..." : "Cargar más episodios"}
          </button>
        ) : (
          <span className="muted">No hay más episodios.</span>
        )}
      </div>

      <div ref={sentinelRef} style={{ height: 1 }} aria-hidden="true" />
    </section>
  );
}
