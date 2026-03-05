"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HomeFeedItem } from "@/lib/homepageQueries";

type FeedResponse = {
  ok: boolean;
  items: HomeFeedItem[];
  nextCursor: string | null;
  hasMore: boolean;
  error?: string;
};

function compact(value: unknown) {
  return new Intl.NumberFormat("es-PR", { notation: "compact" }).format(Number(value ?? 0));
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-PR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export function FeedCentral({
  initialItems,
  initialCursor,
  initialHasMore,
  excludeIds = []
}: {
  initialItems: HomeFeedItem[];
  initialCursor: string | null;
  initialHasMore: boolean;
  excludeIds?: string[];
}) {
  const [items, setItems] = useState<HomeFeedItem[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [hasMore, setHasMore] = useState<boolean>(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const itemIds = useMemo(() => new Set(items.map((item) => item.id)), [items]);
  const staticExclude = useMemo(
    () =>
      (excludeIds ?? [])
        .map((id) => String(id ?? "").trim())
        .filter(Boolean),
    [excludeIds]
  );

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    setError(null);

    const qs = new URLSearchParams();
    qs.set("limit", "12");
    if (cursor) qs.set("cursor", cursor);
    const mergedExclude = Array.from(new Set([...staticExclude, ...Array.from(itemIds)])).slice(0, 400);
    if (mergedExclude.length > 0) {
      qs.set("exclude", mergedExclude.join(","));
    }

    const res = await fetch(`/api/home/feed?${qs.toString()}`, { cache: "no-store" }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as FeedResponse | null;

    if (!res?.ok || !json?.ok) {
      setError(json?.error ?? "No se pudo cargar mas contenido.");
      setLoading(false);
      return;
    }

    setItems((prev) => {
      const next = [...prev];
      const seen = new Set(prev.map((item) => item.id));
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
  }, [cursor, hasMore, itemIds, loading, staticExclude]);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "280px 0px" }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  return (
    <section className="home-media-section" aria-label="Feed central de contenido">
      <div className="home-media-section-head">
        <h2>FEED CENTRAL DE CONTENIDO</h2>
      </div>

      <div className="home-feed-grid">
        {items.length > 0 ? (
          items.map((item) => {
            const external = item.isExternal || /^https?:\/\//i.test(item.href);
            return (
              <article key={item.id} className="card home-feed-card">
                <a href={item.href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} className="home-feed-thumb">
                  {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt={item.title} loading="lazy" /> : <div className="home-media-image-fallback" aria-hidden="true" />}
                </a>
                <div className="home-feed-body">
                  <div className="home-feed-meta-row">
                    <span className="home-media-chip">{item.badge}</span>
                    <span className="home-muted">{formatDate(item.createdAt)}</span>
                  </div>
                  <h3 className="clamp-2">{item.title}</h3>
                  <p className="clamp-2">{item.excerpt}</p>
                  <div className="home-feed-counters">
                    <span>{compact(item.counters.views)} views</span>
                    <span>{compact(item.counters.comments)} comments</span>
                    <span>{compact(item.counters.shares)} shares</span>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <article className="card home-empty-state">
            <p>No hay contenido para el feed central todavia.</p>
          </article>
        )}
      </div>

      {error ? <p className="home-error">{error}</p> : null}

      <div className="home-feed-actions">
        {hasMore ? (
          <button type="button" className="button secondary" onClick={loadMore} disabled={loading || !hasMore}>
            {loading ? "Cargando..." : "Cargar mas"}
          </button>
        ) : (
          <span className="home-muted">No hay mas publicaciones por ahora.</span>
        )}
      </div>

      <div ref={sentinelRef} style={{ height: 1 }} aria-hidden="true" />
    </section>
  );
}
