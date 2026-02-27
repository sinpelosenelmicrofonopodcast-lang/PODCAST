"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { newsHref } from "@/lib/newsRoute";

type NewsCard = {
  id: string;
  slug?: string | null;
  title: string;
  summary: string | null;
  cover_url: string | null;
  categories: string[] | null;
  published_at: string | null;
};

type TabKey = "PR" | "TX" | "USA" | "Mundo";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "PR", label: "Puerto Rico" },
  { key: "TX", label: "Texas" },
  { key: "USA", label: "USA" },
  { key: "Mundo", label: "Mundo" }
];

const isNewToday = (iso?: string | null) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Date.now() - t <= 24 * 60 * 60 * 1000;
};

export function RegionalTabs({ items }: { items: Record<TabKey, NewsCard[]> }) {
  const [active, setActive] = useState<TabKey>("PR");
  const list = items[active] ?? [];

  const hasAny = useMemo(() => Object.values(items).some((arr) => (arr ?? []).length > 0), [items]);

  return (
    <section className="section">
      <div className="container">
        <div className="home-section-head">
          <h2 className="section-title">Regiones</h2>
          <Link className="muted" href="/noticias">
            Ver todas
          </Link>
        </div>

        <div className="tabs-row" role="tablist" aria-label="Regiones">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              className={active === t.key ? "tab active" : "tab"}
              onClick={() => setActive(t.key)}
              role="tab"
              aria-selected={active === t.key}
            >
              {t.label}
            </button>
          ))}
        </div>

        {!hasAny ? (
          <div className="card" style={{ marginTop: 12 }}>
            <p className="muted" style={{ margin: 0 }}>
              Aún no hay noticias por región.
            </p>
          </div>
        ) : (
          <div className="home-grid-3" style={{ marginTop: 12 }}>
            {(list ?? []).slice(0, 6).map((n) => (
              <Link key={n.id} href={newsHref(n)} className="card news-card">
                <div className="news-thumb">
                  {n.cover_url ? <img src={n.cover_url} alt={n.title} loading="lazy" /> : <div className="news-thumb-fallback" aria-hidden="true" />}
                  <div className="news-thumb-overlay" aria-hidden="true" />
                  <div className="news-badges">
                    {isNewToday(n.published_at) ? <span className="pill new">Nuevo hoy</span> : null}
                    <span className="pill">{active}</span>
                  </div>
                </div>
                <div className="news-card-body">
                  <h3 className="clamp-2" style={{ margin: 0 }}>
                    {n.title}
                  </h3>
                  <p className="muted clamp-2" style={{ margin: "8px 0 0" }}>
                    {n.summary ?? ""}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
