"use client";

import { useMemo, useState } from "react";
import type { TocItem } from "@/lib/blogContent";

export function TableOfContents({ items }: { items: TocItem[] }) {
  const [open, setOpen] = useState(false);
  const has = items && items.length > 0;

  const list = useMemo(() => (items ?? []).filter(Boolean), [items]);

  if (!has) return null;

  return (
    <aside className="toc">
      <div className="toc-desktop">
        <div className="toc-title">Indice</div>
        <nav aria-label="Tabla de contenido">
          <ul className="toc-list">
            {list.map((it) => (
              <li key={it.id} className={it.level === 3 ? "lvl3" : undefined}>
                <a href={`#${it.id}`}>{it.text}</a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="toc-mobile">
        <button type="button" className="button secondary toc-toggle" onClick={() => setOpen((v) => !v)}>
          {open ? "Ocultar indice" : "Ver indice"}
        </button>
        {open ? (
          <div className="card toc-mobile-card">
            <div className="toc-title">Indice</div>
            <nav aria-label="Tabla de contenido">
              <ul className="toc-list">
                {list.map((it) => (
                  <li key={it.id} className={it.level === 3 ? "lvl3" : undefined}>
                    <a
                      href={`#${it.id}`}
                      onClick={() => {
                        setOpen(false);
                      }}
                    >
                      {it.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

