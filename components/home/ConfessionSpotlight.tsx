"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Confession = {
  id: string;
  body: string;
  created_at: string | null;
  users?: { nickname?: string | null } | { nickname?: string | null }[] | null;
};

const pickUser = (users: any) => (Array.isArray(users) ? users[0] : users);

export function ConfessionSpotlight({
  items,
  rotateSeconds = 10
}: {
  items: Confession[];
  rotateSeconds?: number;
}) {
  const normalized = useMemo(() => items.filter(Boolean), [items]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (normalized.length <= 1) return;
    const t = window.setInterval(() => setIdx((v) => (v + 1) % normalized.length), Math.max(4, rotateSeconds) * 1000);
    return () => window.clearInterval(t);
  }, [normalized.length, rotateSeconds]);

  const current = normalized[idx] ?? null;
  const author = current ? pickUser((current as any).users) : null;

  if (!current) {
    return (
      <article className="card home-confession">
        <div className="home-section-head">
          <h2 className="section-title">Confesionario</h2>
          <Link className="muted" href="/confesiones">
            Ver todo
          </Link>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Aún no hay confesiones públicas.
        </p>
        <div style={{ marginTop: 12 }}>
          <Link className="button" href="/confesiones">
            Enviar confesión
          </Link>
        </div>
      </article>
    );
  }

  return (
    <article className="card home-confession">
      <div className="home-section-head">
        <h2 className="section-title">Confesionario</h2>
        <Link className="muted" href="/confesiones">
          Ver todo
        </Link>
      </div>
      <div className="muted" style={{ fontSize: 12, display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase" }}>Destacada</span>
        <span>{author?.nickname ?? "Anónimo"}</span>
        <span>·</span>
        <span>{current.created_at ? new Date(current.created_at).toLocaleDateString("es-PR") : ""}</span>
      </div>
      <p className="confession-quote clamp-5" style={{ marginTop: 12 }}>
        {current.body}
      </p>
      <div className="home-cta-row" style={{ marginTop: 14 }}>
        <Link className="button" href="/confesiones">
          Enviar confesión
        </Link>
        <Link className="button secondary" href="/confesiones">
          Leer más
        </Link>
      </div>
    </article>
  );
}

