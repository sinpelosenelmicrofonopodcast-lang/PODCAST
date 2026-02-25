"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type ForumCategory = {
  id: string;
  name: string;
  count?: number;
};

type ForumThread = {
  id: string;
  href?: `/foro/${string}`;
  title: string;
  body: string | null;
  created_at: string | null;
  category_id?: string | null;
  category_name?: string | null;
  author?: {
    nickname?: string | null;
    bio?: string | null;
    avatar_url?: string | null;
  } | null;
  repliesCount?: number;
};

type ForumLayoutProps = {
  categories: ForumCategory[];
  threads: ForumThread[];
  isLoading: boolean;
  error?: string | null;
  onCreateTopicHref?: string;
  renderThreadExtras?: (thread: ForumThread) => React.ReactNode;
};

const RULES = ["Sin censura ideológica", "No doxxing", "No amenazas reales", "No acoso repetitivo"];

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("es-PR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export function ForumLayout({ categories, threads, isLoading, error, onCreateTopicHref = "#new-topic", renderThreadExtras }: ForumLayoutProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const normalized = search.trim().toLowerCase();

  const visibleThreads = useMemo(() => {
    return threads.filter((thread) => {
      const categoryOk = activeCategory === "all" || thread.category_id === activeCategory;
      if (!categoryOk) return false;

      if (!normalized) return true;
      const hay = `${thread.title} ${thread.body ?? ""} ${thread.author?.nickname ?? ""}`.toLowerCase();
      return hay.includes(normalized);
    });
  }, [threads, activeCategory, normalized]);

  return (
    <section className="foro-premium">
      <div className="foro-premium-shell">
        <header className="foro-premium-header card">
          <div>
            <h1 className="section-title" style={{ marginTop: 0 }}>Foro Sin Pelos</h1>
            <p className="muted" style={{ marginBottom: 0 }}>
              Debate directo, sin filtros ideológicos. Entra, argumenta y responde.
            </p>
          </div>

          <div className="foro-premium-rules" aria-label="Reglas del foro">
            {RULES.map((rule) => (
              <span key={rule} className="badge">
                {rule}
              </span>
            ))}
          </div>

          <div className="foro-premium-controls">
            <input
              className="input foro-premium-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar temas, palabras o usuario..."
              aria-label="Buscar en foro"
            />
            <a className="button" href={onCreateTopicHref}>
              Nuevo tema
            </a>
          </div>
        </header>

        <div className="foro-premium-grid">
          <aside className="card foro-premium-sidebar">
            <h3 style={{ marginTop: 0 }}>Categorías</h3>
            <div className="foro-premium-cats">
              <button
                type="button"
                className={activeCategory === "all" ? "foro-cat active" : "foro-cat"}
                onClick={() => setActiveCategory("all")}
              >
                Todas ({threads.length})
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={activeCategory === category.id ? "foro-cat active" : "foro-cat"}
                  onClick={() => setActiveCategory(category.id)}
                >
                  {category.name} ({category.count ?? 0})
                </button>
              ))}
            </div>
          </aside>

          <section className="foro-premium-list" aria-live="polite">
            {error ? (
              <article className="card foro-state foro-state-error">
                <h3 style={{ marginTop: 0 }}>No pudimos cargar el foro</h3>
                <p className="muted" style={{ marginBottom: 0 }}>{error}</p>
              </article>
            ) : null}

            {isLoading ? (
              <div className="foro-skeleton-grid">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <article key={idx} className="card foro-skeleton" aria-hidden="true">
                    <div className="foro-skeleton-line w-40" />
                    <div className="foro-skeleton-line w-100" />
                    <div className="foro-skeleton-line w-90" />
                    <div className="foro-skeleton-line w-60" />
                  </article>
                ))}
              </div>
            ) : null}

            {!isLoading && !error && visibleThreads.length === 0 ? (
              <article className="card foro-state">
                <h3 style={{ marginTop: 0 }}>No hay temas que coincidan</h3>
                <p className="muted">Prueba otro término de búsqueda o crea el primer tema de esta categoría.</p>
                <a className="button" href={onCreateTopicHref}>
                  Crear tema
                </a>
              </article>
            ) : null}

            {!isLoading && !error && visibleThreads.length > 0 ? (
              <div className="foro-thread-grid">
                {visibleThreads.map((thread) => (
                  <article key={thread.id} className="card foro-thread">
                    <header className="foro-thread-head">
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <img
                          src={thread.author?.avatar_url ?? "/logo.png"}
                          alt={thread.author?.nickname ?? "avatar"}
                          width={34}
                          height={34}
                          style={{ borderRadius: "50%", objectFit: "cover" }}
                        />
                        <div>
                          <div className="foro-thread-author">{thread.author?.nickname ?? "Anónimo"}</div>
                          <div className="muted" style={{ fontSize: 12 }}>{formatDate(thread.created_at)}</div>
                        </div>
                      </div>
                      {thread.category_name ? <span className="badge">{thread.category_name}</span> : null}
                    </header>

                    <h3 className="clamp-2" style={{ margin: 0 }}>
                      {thread.href ? (
                        <Link href={thread.href} className="mag-link">
                          {thread.title}
                        </Link>
                      ) : (
                        thread.title
                      )}
                    </h3>
                    <p className="muted clamp-3" style={{ margin: 0 }}>{thread.body ?? ""}</p>

                    <div className="foro-thread-meta muted">
                      <span>💬 {thread.repliesCount ?? 0} respuestas</span>
                      {thread.href ? (
                        <>
                          <span>·</span>
                          <Link href={thread.href} className="mag-link">
                            Ver completo
                          </Link>
                        </>
                      ) : null}
                    </div>

                    {renderThreadExtras ? <div className="foro-thread-extras">{renderThreadExtras(thread)}</div> : null}
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </section>
  );
}

export type { ForumCategory, ForumThread };
