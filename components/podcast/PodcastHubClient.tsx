"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

export type PodcastEpisodeCardData = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  publishedAt: string | null;
  thumbnailUrl: string | null;
  youtubeUrl: string | null;
  audioUrl: string | null;
  durationSeconds: number | null;
  viewCount: number | null;
};

type EnrichedEpisode = PodcastEpisodeCardData & {
  publishedTs: number;
  preview: string;
  topics: string[];
  isNew: boolean;
  isPopular: boolean;
  isGuest: boolean;
  year: string;
  month: string;
  featuredScore: number;
  searchHaystack: string;
};

const TOPIC_RULES: Array<{ label: string; regex: RegExp }> = [
  { label: "Deportes", regex: /\b(mlb|beisbol|béisbol|nba|nfl|ufc|boxeo|deporte|deportes|futbol|fútbol)\b/i },
  { label: "Noticias", regex: /\b(noticia|noticias|politica|política|gobierno|eleccion|elección|guerra|crisis)\b/i },
  { label: "Negocios", regex: /\b(negocio|negocios|economia|economía|finanza|finanzas|mercado|dinero|crypto)\b/i },
  { label: "Música", regex: /\b(musica|música|cantante|album|álbum|concierto|artista)\b/i }
];

function toSafeText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeForSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function clampPreview(text: string, max = 200) {
  if (text.length <= max) return text;
  const sliced = text.slice(0, max);
  const cut = sliced.lastIndexOf(" ");
  const base = cut > 40 ? sliced.slice(0, cut) : sliced;
  return `${base.trimEnd()}…`;
}

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Sin fecha";
  return date.toLocaleDateString("es-PR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatViews(value?: number | null) {
  if (!value || value <= 0) return "—";
  return Intl.NumberFormat("es-PR", { notation: "compact" }).format(value);
}

function formatDuration(seconds?: number | null) {
  const total = Number(seconds ?? 0);
  if (!Number.isFinite(total) || total <= 0) return null;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function inferTopics(title: string, description: string) {
  const text = `${title} ${description}`;
  const found = TOPIC_RULES.filter((rule) => rule.regex.test(text)).map((rule) => rule.label);
  if (found.length > 0) return found;
  return ["Podcast"];
}

function computePopularThreshold(episodes: PodcastEpisodeCardData[]) {
  const values = episodes.map((episode) => Number(episode.viewCount ?? 0)).filter((value) => value > 0).sort((a, b) => a - b);
  if (values.length === 0) return Number.POSITIVE_INFINITY;
  const idx = Math.floor(values.length * 0.7);
  return values[Math.min(values.length - 1, Math.max(0, idx))];
}

function buildEnrichedEpisode(episode: PodcastEpisodeCardData, popularThreshold: number, nowTs: number): EnrichedEpisode {
  const title = toSafeText(episode.title) || "Episodio";
  const description = toSafeText(episode.description);
  const preview = clampPreview(description || "Episodio completo de Sin Pelos en el Micrófono.");
  const publishedTs = episode.publishedAt ? new Date(episode.publishedAt).getTime() : NaN;
  const validTs = Number.isFinite(publishedTs) ? publishedTs : 0;
  const ageDays = validTs > 0 ? Math.max(0, (nowTs - validTs) / (1000 * 60 * 60 * 24)) : 365;
  const recentness = Math.max(0, 1 - ageDays / 40);

  const topics = inferTopics(title, description);
  const isGuest = /\b(invitad|entrevist|ft\.|featuring)\b/i.test(`${title} ${description}`);
  const viewCount = Number(episode.viewCount ?? 0);
  const isPopular = Number.isFinite(viewCount) && viewCount > 0 && viewCount >= popularThreshold;
  const isNew = ageDays <= 10;

  const dateObj = validTs > 0 ? new Date(validTs) : null;
  const year = dateObj ? String(dateObj.getFullYear()) : "Sin fecha";
  const month = dateObj ? `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}` : "Sin fecha";

  const featuredScore = viewCount * 0.65 + recentness * 40 + (isGuest ? 10 : 0) + (isPopular ? 12 : 0);
  const searchHaystack = normalizeForSearch(`${title} ${description} ${topics.join(" ")}`);

  return {
    ...episode,
    title,
    description: description || null,
    preview,
    publishedTs: validTs,
    topics,
    isNew,
    isPopular,
    isGuest,
    year,
    month,
    featuredScore,
    searchHaystack
  };
}

export function PodcastHubClient({
  episodes,
  featuredEpisodeId
}: {
  episodes: PodcastEpisodeCardData[];
  featuredEpisodeId: string | null;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("recent");
  const [year, setYear] = useState("all");
  const [month, setMonth] = useState("all");
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);
  const [shareLabel, setShareLabel] = useState("Compartir");
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastActiveRef = useRef<HTMLElement | null>(null);

  const nowTs = useMemo(() => Date.now(), []);
  const popularThreshold = useMemo(() => computePopularThreshold(episodes), [episodes]);

  const enriched = useMemo(
    () => episodes.map((episode) => buildEnrichedEpisode(episode, popularThreshold, nowTs)),
    [episodes, nowTs, popularThreshold]
  );

  const latestEpisode = useMemo(() => {
    if (enriched.length === 0) return null;
    const sorted = [...enriched].sort((a, b) => b.publishedTs - a.publishedTs);
    if (featuredEpisodeId) {
      return sorted.find((episode) => episode.id === featuredEpisodeId) ?? sorted[0];
    }
    return sorted[0];
  }, [enriched, featuredEpisodeId]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>(["Noticias", "Deportes", "Negocios", "Música"]);
    if (enriched.some((episode) => episode.isGuest)) set.add("Invitado");
    if (enriched.some((episode) => episode.isPopular)) set.add("Popular");
    if (enriched.some((episode) => episode.isNew)) set.add("Nuevo");
    return ["all", ...Array.from(set)];
  }, [enriched]);

  const yearOptions = useMemo(() => {
    const values = Array.from(new Set(enriched.map((episode) => episode.year))).filter((value) => value !== "Sin fecha");
    return values.sort((a, b) => Number(b) - Number(a));
  }, [enriched]);

  const monthOptions = useMemo(() => {
    const rows = enriched.filter((episode) => (year === "all" ? true : episode.year === year));
    const values = Array.from(new Set(rows.map((episode) => episode.month))).filter((value) => value !== "Sin fecha");
    return values.sort((a, b) => (a < b ? 1 : -1));
  }, [enriched, year]);

  useEffect(() => {
    if (year === "all") {
      setMonth("all");
      return;
    }
    if (month === "all") return;
    if (!monthOptions.includes(month)) setMonth("all");
  }, [month, monthOptions, year]);

  const gridItems = useMemo(() => {
    const q = normalizeForSearch(query);
    let rows = latestEpisode ? enriched.filter((episode) => episode.id !== latestEpisode.id) : [...enriched];

    if (q) {
      rows = rows.filter((episode) => episode.searchHaystack.includes(q));
    }

    if (category !== "all") {
      rows = rows.filter((episode) => {
        if (category === "Invitado") return episode.isGuest;
        if (category === "Popular") return episode.isPopular;
        if (category === "Nuevo") return episode.isNew;
        return episode.topics.includes(category);
      });
    }

    if (year !== "all") rows = rows.filter((episode) => episode.year === year);
    if (month !== "all") rows = rows.filter((episode) => episode.month === month);

    const sorted = [...rows];
    if (sort === "oldest") {
      sorted.sort((a, b) => a.publishedTs - b.publishedTs);
    } else if (sort === "views") {
      const hasViews = sorted.some((episode) => Number(episode.viewCount ?? 0) > 0);
      if (hasViews) {
        sorted.sort((a, b) => Number(b.viewCount ?? 0) - Number(a.viewCount ?? 0));
      } else {
        sorted.sort((a, b) => b.publishedTs - a.publishedTs);
      }
    } else if (sort === "featured") {
      sorted.sort((a, b) => b.featuredScore - a.featuredScore);
    } else {
      sorted.sort((a, b) => b.publishedTs - a.publishedTs);
    }
    return sorted;
  }, [category, enriched, latestEpisode, month, query, sort, year]);

  const selectedEpisode = useMemo(
    () => (selectedEpisodeId ? enriched.find((episode) => episode.id === selectedEpisodeId) ?? null : null),
    [enriched, selectedEpisodeId]
  );

  const closeModal = useCallback(() => {
    setSelectedEpisodeId(null);
    setShareLabel("Compartir");
  }, []);

  useEffect(() => {
    if (!selectedEpisode) return;
    lastActiveRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeModal();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onEsc);
    window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onEsc);
      if (lastActiveRef.current && typeof lastActiveRef.current.focus === "function") {
        lastActiveRef.current.focus();
      }
    };
  }, [closeModal, selectedEpisode]);

  const shareEpisode = useCallback(async (episode: EnrichedEpisode) => {
    const url = `${window.location.origin}/podcast/${encodeURIComponent(episode.slug)}`;
    const title = episode.title;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text: episode.preview, url });
        setShareLabel("Compartido");
        return;
      } catch {
        // fallback to clipboard
      }
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      setShareLabel("Link copiado");
      window.setTimeout(() => setShareLabel("Compartir"), 2200);
    }
  }, []);

  return (
    <div className="podcast-hub">
      <header className="card podcast-hero">
        <div className="podcast-hero-copy">
          <span className="badge">Podcast oficial</span>
          <h1 className="section-title podcast-page-title">Podcast</h1>
          <p className="muted podcast-hero-subtitle">
            Todos los episodios completos de Sin Pelos en el Micrófono, organizados para que encuentres rápido lo último, lo
            más duro y lo más controversial.
          </p>
        </div>
        <div className="podcast-hero-actions">
          <Link className="button secondary podcast-action-btn" href="/feed?view=episodes">
            Ver feed completo
          </Link>
          {latestEpisode ? (
            <Link className="button secondary podcast-action-btn" href={`/podcast/${encodeURIComponent(latestEpisode.slug)}`}>
              Último episodio
            </Link>
          ) : null}
          {latestEpisode?.youtubeUrl ? (
            <a className="button podcast-btn-youtube podcast-action-btn" href={latestEpisode.youtubeUrl} target="_blank" rel="noreferrer">
              Ver en YouTube
            </a>
          ) : null}
        </div>
      </header>

      {latestEpisode ? (
        <section id="ultimo-episodio" className="card podcast-featured">
          <div className="podcast-cover-frame podcast-featured-media">
            {latestEpisode.thumbnailUrl ? (
              <img
                src={latestEpisode.thumbnailUrl}
                alt={`Portada del último episodio: ${latestEpisode.title}`}
                loading="eager"
                decoding="async"
                fetchPriority="high"
                className="podcast-cover-image"
              />
            ) : (
              <div className="podcast-cover-fallback" aria-hidden="true" />
            )}
          </div>

          <div className="podcast-featured-body">
            <div className="podcast-featured-meta">
              <span className="podcast-date">{formatDate(latestEpisode.publishedAt)}</span>
              {latestEpisode.viewCount ? <span className="podcast-views">{formatViews(latestEpisode.viewCount)} vistas</span> : null}
            </div>
            <h2 className="podcast-featured-title">{latestEpisode.title}</h2>
            <p className="podcast-featured-desc clamp-3">{latestEpisode.preview}</p>
            <div className="podcast-badges">
              {latestEpisode.isNew ? <span className="pill new">Nuevo</span> : null}
              {latestEpisode.isPopular ? <span className="pill">Popular</span> : null}
              {latestEpisode.isGuest ? <span className="pill">Invitado</span> : null}
              {latestEpisode.topics.slice(0, 2).map((topic) => (
                <span key={topic} className="pill">
                  {topic}
                </span>
              ))}
            </div>
            <div className="podcast-featured-actions">
              <Link className="button podcast-btn-youtube" href={`/podcast/${encodeURIComponent(latestEpisode.slug)}`}>
                Ver episodio
              </Link>
              {latestEpisode.youtubeUrl ? (
                <a className="button secondary" href={latestEpisode.youtubeUrl} target="_blank" rel="noreferrer">
                  Ver en YouTube
                </a>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section className="card podcast-toolbar">
        <div className="podcast-search-wrap">
          <label htmlFor="podcast-search" className="muted">
            Buscar episodio
          </label>
          <input
            id="podcast-search"
            className="input podcast-search"
            type="search"
            placeholder="Título, keyword o invitado"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="podcast-filters">
          <label className="podcast-filter">
            <span className="muted">Tema</span>
            <select className="select" value={category} onChange={(event) => setCategory(event.target.value)}>
              {categoryOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "all" ? "Todos" : option}
                </option>
              ))}
            </select>
          </label>

          <label className="podcast-filter">
            <span className="muted">Orden</span>
            <select className="select" value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="recent">Más recientes</option>
              <option value="oldest">Más viejos</option>
              <option value="views">Más vistos</option>
              <option value="featured">Destacados</option>
            </select>
          </label>

          <label className="podcast-filter">
            <span className="muted">Año</span>
            <select className="select" value={year} onChange={(event) => setYear(event.target.value)}>
              <option value="all">Todos</option>
              {yearOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="podcast-filter">
            <span className="muted">Mes</span>
            <select className="select" value={month} onChange={(event) => setMonth(event.target.value)}>
              <option value="all">Todos</option>
              {monthOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <div className="podcast-results-meta muted" aria-live="polite">
        {gridItems.length} episodios encontrados
      </div>

      {gridItems.length === 0 ? (
        <article className="card podcast-empty-state">
          <h2 className="section-title">Sin resultados</h2>
          <p className="muted">Ajusta los filtros o limpia la búsqueda para ver más episodios.</p>
        </article>
      ) : (
        <section className="podcast-grid" aria-label="Listado de episodios">
          {gridItems.map((episode) => {
            const duration = formatDuration(episode.durationSeconds);
            return (
              <article key={episode.id} className="card podcast-card">
                <button
                  type="button"
                  className="podcast-thumb-btn"
                  onClick={() => setSelectedEpisodeId(episode.id)}
                  aria-label={`Ver detalles de ${episode.title}`}
                >
                  <div className="podcast-cover-frame">
                    {episode.thumbnailUrl ? (
                      <img
                        src={episode.thumbnailUrl}
                        alt={`Portada del episodio ${episode.title}`}
                        loading="lazy"
                        decoding="async"
                        className="podcast-cover-image"
                      />
                    ) : (
                      <div className="podcast-cover-fallback" aria-hidden="true" />
                    )}
                  </div>
                </button>

                <div className="podcast-card-body">
                  <div className="podcast-card-topline">
                    <time className="podcast-date">{formatDate(episode.publishedAt)}</time>
                    <span className="podcast-views">
                      {formatViews(episode.viewCount)} vistas
                      {duration ? ` · ${duration}` : ""}
                    </span>
                  </div>

                  <h3 className="podcast-card-title clamp-3">{episode.title}</h3>
                  <p className="podcast-card-excerpt clamp-3">{episode.preview}</p>

                  <div className="podcast-badges">
                    {episode.isNew ? <span className="pill new">Nuevo</span> : null}
                    {episode.isPopular ? <span className="pill">Popular</span> : null}
                    {episode.isGuest ? <span className="pill">Invitado</span> : null}
                    {episode.topics.slice(0, 2).map((topic) => (
                      <span key={topic} className="pill">
                        {topic}
                      </span>
                    ))}
                  </div>

                  <div className="podcast-card-actions">
                    <Link className="button secondary podcast-btn-minor" href={`/podcast/${encodeURIComponent(episode.slug)}`}>
                      Ver episodio
                    </Link>
                    {episode.youtubeUrl ? (
                      <a className="button podcast-btn-youtube podcast-btn-minor" href={episode.youtubeUrl} target="_blank" rel="noreferrer">
                        YouTube
                      </a>
                    ) : null}
                    <button type="button" className="button secondary podcast-btn-minor" onClick={() => setSelectedEpisodeId(episode.id)}>
                      Ver detalles
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {selectedEpisode ? (
        <div className="podcast-modal-backdrop" role="presentation" onClick={closeModal}>
          <div
            className="podcast-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="podcast-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              ref={closeButtonRef}
              type="button"
              className="podcast-modal-close"
              onClick={closeModal}
              aria-label="Cerrar detalles del episodio"
            >
              ×
            </button>

            <div className="podcast-modal-grid">
              <div className="podcast-cover-frame podcast-modal-media">
                {selectedEpisode.thumbnailUrl ? (
                  <img
                    src={selectedEpisode.thumbnailUrl}
                    alt={`Portada del episodio ${selectedEpisode.title}`}
                    loading="lazy"
                    decoding="async"
                    className="podcast-cover-image"
                  />
                ) : (
                  <div className="podcast-cover-fallback" aria-hidden="true" />
                )}
              </div>

              <div className="podcast-modal-body">
                <div className="podcast-modal-topline">
                  <span className="podcast-date">{formatDate(selectedEpisode.publishedAt)}</span>
                  {selectedEpisode.viewCount ? <span className="podcast-views">{formatViews(selectedEpisode.viewCount)} vistas</span> : null}
                </div>
                <h3 id="podcast-modal-title" className="podcast-modal-title">
                  {selectedEpisode.title}
                </h3>
                <p className="podcast-modal-description">
                  {selectedEpisode.description || "Episodio completo de Sin Pelos en el Micrófono."}
                </p>

                <div className="podcast-badges">
                  <span className="pill">Podcast</span>
                  {selectedEpisode.youtubeUrl ? <span className="pill">YouTube</span> : null}
                  {selectedEpisode.audioUrl ? <span className="pill">Audio</span> : null}
                  {selectedEpisode.topics.slice(0, 3).map((topic) => (
                    <span key={`modal-${topic}`} className="pill">
                      {topic}
                    </span>
                  ))}
                </div>

                <div className="podcast-modal-actions">
                  {selectedEpisode.youtubeUrl ? (
                    <a className="button podcast-btn-youtube" href={selectedEpisode.youtubeUrl} target="_blank" rel="noreferrer">
                      Abrir en YouTube
                    </a>
                  ) : null}
                  <Link className="button secondary" href={`/podcast/${encodeURIComponent(selectedEpisode.slug)}`}>
                    Ir al episodio
                  </Link>
                  <button type="button" className="button secondary" onClick={() => shareEpisode(selectedEpisode)}>
                    {shareLabel}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
