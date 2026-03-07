"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/lib/toast";
import {
  isPodcastSource,
  isShortPodcastPost,
  type ExternalPodcastPost,
  uniqueExternalPodcastPosts
} from "@/lib/feedEpisodes";
import { getYouTubeVideoId } from "@/lib/youtube";

type EpisodeApiResponse = {
  ok: boolean;
  items?: ExternalPodcastPost[];
  nextCursor?: string | null;
  hasMore?: boolean;
  error?: string;
};

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("es-PR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function buildEpisodeSlug(item: ExternalPodcastPost) {
  return getYouTubeVideoId(item.source_url) || item.id;
}

function buildExcerpt(item: ExternalPodcastPost, max = 260) {
  const text = String(item.caption ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function defaultPostText(item: ExternalPodcastPost) {
  const title = String(item.title ?? "Nuevo episodio").trim();
  const excerpt = buildExcerpt(item, 220);
  if (excerpt) return `${title}\n\n${excerpt}`;
  return title;
}

export default function AdminEpisodesPage() {
  const [items, setItems] = useState<ExternalPodcastPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [postingId, setPostingId] = useState<string | null>(null);
  const [pushingId, setPushingId] = useState<string | null>(null);
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [customText, setCustomText] = useState<Record<string, string>>({});
  const [scheduleAt, setScheduleAt] = useState<Record<string, string>>({});
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);

  const load = useCallback(async (nextCursor?: string | null) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (!nextCursor) setLoading(true);
    else setLoadingMore(true);

    const params = new URLSearchParams();
    params.set("limit", "24");
    if (nextCursor) params.set("cursor", nextCursor);

    const res = await fetch(`/api/feed/episodes?${params.toString()}`, { cache: "no-store" }).catch(() => null);
    const json = (res ? await res.json().catch(() => ({})) : {}) as EpisodeApiResponse;

    if (!res || !res.ok || !json?.ok) {
      const msg = json?.error ?? "No se pudieron cargar episodios.";
      setStatus(msg);
      toast.error(msg);
      setLoading(false);
      setLoadingMore(false);
      loadingRef.current = false;
      return;
    }

    const incoming = uniqueExternalPodcastPosts(
      ((json.items ?? []) as ExternalPodcastPost[]).filter((row) => isPodcastSource(row) && !isShortPodcastPost(row))
    );

    if (nextCursor) {
      setItems((prev) => uniqueExternalPodcastPosts([...prev, ...incoming]));
    } else {
      setItems(incoming);
    }
    setCursor(json.nextCursor ?? null);
    setHasMore(Boolean(json.hasMore));
    setLoading(false);
    setLoadingMore(false);
    loadingRef.current = false;
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) return;
        if (loading || loadingMore) return;
        load(cursor);
      },
      { rootMargin: "800px 0px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [cursor, hasMore, load, loading, loadingMore]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const haystack = `${item.title ?? ""} ${item.caption ?? ""} ${item.source_url ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [items, search]);

  const handlePostNow = async (item: ExternalPodcastPost) => {
    setPostingId(item.id);
    setStatus(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      const msg = "Sesión inválida. Inicia sesión de nuevo.";
      setStatus(msg);
      toast.error(msg);
      setPostingId(null);
      return;
    }

    const slug = buildEpisodeSlug(item);
    const custom = String(customText[item.id] ?? "").trim();
    const res = await fetch("/api/social/meta/facebook/post-episode", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        episodeId: item.id,
        episodeSlug: slug,
        title: item.title ?? "Nuevo episodio",
        description: item.caption ?? "",
        sourceUrl: item.source_url ?? null,
        customText: custom || null
      })
    }).catch(() => null);

    const json = (res ? await res.json().catch(() => ({})) : {}) as { ok?: boolean; error?: string; link?: string };
    setPostingId(null);

    if (!res || !res.ok || !json?.ok) {
      const msg = `Facebook falló: ${json?.error ?? "error"}`;
      setStatus(msg);
      toast.error(msg);
      return;
    }

    const okMsg = `Episodio publicado en Facebook${json.link ? ` (${json.link})` : "."}`;
    setStatus(okMsg);
    toast.success("Episodio publicado en Facebook.");
  };

  const handlePushNow = async (item: ExternalPodcastPost) => {
    setPushingId(item.id);
    setStatus(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      const msg = "Sesión inválida. Inicia sesión de nuevo.";
      setStatus(msg);
      toast.error(msg);
      setPushingId(null);
      return;
    }

    const slug = buildEpisodeSlug(item);
    const res = await fetch("/api/admin/notifications/onesignal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        title: item.title ?? "Nuevo episodio",
        message: buildExcerpt(item, 180) || "Episodio nuevo en Sin Pelos en el Micrófono.",
        url: `/podcast/${encodeURIComponent(slug)}`,
        imageUrl: item.media_url ?? null,
        category: "podcast"
      })
    }).catch(() => null);

    const json = (res ? await res.json().catch(() => ({})) : {}) as { ok?: boolean; error?: string };
    setPushingId(null);

    if (!res || !res.ok || !json?.ok) {
      const msg = `Push falló: ${json?.error ?? "error"}`;
      setStatus(msg);
      toast.error(msg);
      return;
    }

    setStatus("Push enviado para el episodio.");
    toast.success("Push enviado.");
  };

  const handleSchedulePost = async (item: ExternalPodcastPost) => {
    const localValue = String(scheduleAt[item.id] ?? "").trim();
    if (!localValue) {
      const msg = "Selecciona fecha y hora para programar.";
      setStatus(msg);
      toast.error(msg);
      return;
    }

    const parsed = new Date(localValue);
    if (!Number.isFinite(parsed.getTime())) {
      const msg = "Fecha/hora inválida para programar.";
      setStatus(msg);
      toast.error(msg);
      return;
    }

    const scheduleIso = parsed.toISOString();
    setSchedulingId(item.id);
    setStatus(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      const msg = "Sesión inválida. Inicia sesión de nuevo.";
      setStatus(msg);
      toast.error(msg);
      setSchedulingId(null);
      return;
    }

    const slug = buildEpisodeSlug(item);
    const custom = String(customText[item.id] ?? "").trim();
    const res = await fetch("/api/social/meta/facebook/post-episode", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        episodeId: item.id,
        episodeSlug: slug,
        title: item.title ?? "Nuevo episodio",
        description: item.caption ?? "",
        sourceUrl: item.source_url ?? null,
        customText: custom || null,
        scheduleFor: scheduleIso
      })
    }).catch(() => null);

    const json = (res ? await res.json().catch(() => ({})) : {}) as {
      ok?: boolean;
      error?: string;
      scheduledFor?: string;
    };
    setSchedulingId(null);

    if (!res || !res.ok || !json?.ok) {
      const msg = `Schedule falló: ${json?.error ?? "error"}`;
      setStatus(msg);
      toast.error(msg);
      return;
    }

    const scheduled = json.scheduledFor ? new Date(json.scheduledFor).toLocaleString("es-PR") : localValue;
    const okMsg = `Post programado para ${scheduled}.`;
    setStatus(okMsg);
    toast.success(okMsg);
  };

  return (
    <main>
      <h1 className="section-title">Episodios del Podcast</h1>
      <p className="muted">Publica cualquier episodio en Facebook con texto personalizado o extracto automático.</p>

      <div className="card form-stack" style={{ marginTop: 18 }}>
        <label>
          Buscar episodio
          <input
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ej: episodio viejo, invitado, tema..."
          />
        </label>
        {status ? <p className="muted" style={{ margin: 0 }}>{status}</p> : null}
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h3 style={{ marginTop: 0 }}>Lista de episodios</h3>
        {loading ? <p className="muted">Cargando episodios...</p> : null}
        {!loading && filtered.length === 0 ? <p className="muted">No se encontraron episodios.</p> : null}

        {filtered.length > 0 ? (
          <div className="list" style={{ marginTop: 12 }}>
            {filtered.map((item) => {
              const slug = buildEpisodeSlug(item);
              return (
                <article key={item.id} className="card" style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "grid", gap: 8, gridTemplateColumns: "minmax(160px,220px) 1fr" }}>
                    {item.media_url ? (
                      <img
                        src={item.media_url}
                        alt={item.title ?? "Episodio"}
                        loading="lazy"
                        style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", borderRadius: 10 }}
                      />
                    ) : (
                      <div style={{ width: "100%", aspectRatio: "16/9", borderRadius: 10, background: "#1f1f28" }} />
                    )}
                    <div style={{ display: "grid", gap: 6 }}>
                      <strong>{item.title ?? "Episodio"}</strong>
                      <span className="muted" style={{ fontSize: 12 }}>
                        {formatDate(item.posted_at)}
                      </span>
                      <span className="muted" style={{ fontSize: 12 }}>{buildExcerpt(item, 180) || "Sin descripción."}</span>
                      <div className="admin-item-actions">
                        <a className="button secondary" href={`/podcast/${encodeURIComponent(slug)}`} target="_blank" rel="noreferrer">
                          Ver en la web
                        </a>
                        {item.source_url ? (
                          <a className="button secondary" href={item.source_url} target="_blank" rel="noreferrer">
                            Ver en YouTube
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <label>
                    Texto para Facebook (opcional)
                    <textarea
                      className="textarea"
                      rows={3}
                      value={customText[item.id] ?? ""}
                      onChange={(e) => setCustomText((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      placeholder="Si lo dejas vacío, se usa extracto automático de la descripción."
                    />
                  </label>

                  <label>
                    Programar para (opcional)
                    <input
                      className="input"
                      type="datetime-local"
                      value={scheduleAt[item.id] ?? ""}
                      onChange={(e) => setScheduleAt((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    />
                  </label>

                  <div className="admin-item-actions">
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => setCustomText((prev) => ({ ...prev, [item.id]: defaultPostText(item) }))}
                    >
                      Usar extracto
                    </button>
                    <button
                      className="button secondary"
                      type="button"
                      disabled={postingId === item.id}
                      onClick={() => handlePostNow(item)}
                    >
                      {postingId === item.id ? "Posteando..." : "Post a Facebook"}
                    </button>
                    <button
                      className="button secondary"
                      type="button"
                      disabled={pushingId === item.id}
                      onClick={() => handlePushNow(item)}
                    >
                      {pushingId === item.id ? "Enviando..." : "Enviar push"}
                    </button>
                    <button
                      className="button secondary"
                      type="button"
                      disabled={schedulingId === item.id}
                      onClick={() => handleSchedulePost(item)}
                    >
                      {schedulingId === item.id ? "Programando..." : "Programar post"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}

        {hasMore ? (
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <div ref={sentinelRef} style={{ height: 1 }} />
            <button className="button secondary" type="button" disabled={loadingMore} onClick={() => load(cursor)}>
              {loadingMore ? "Cargando..." : "Cargar más episodios"}
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
