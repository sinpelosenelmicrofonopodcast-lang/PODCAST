"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type QueueRow = {
  id: string;
  platform: string;
  status: string;
  scheduled_for: string | null;
  error: string | null;
  created_at: string;
  content_items?: { type: string; title: string | null } | { type: string; title: string | null }[] | null;
};

const pickOne = <T,>(value: T | T[] | null | undefined) => (Array.isArray(value) ? value[0] : value);

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("es-PR");
}

export default function AdminSchedulePage() {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setStatus(null);

    const { data, error } = await supabase
      .from("publish_queue")
      .select("id, platform, status, scheduled_for, error, created_at, content_items(type, title)")
      .order("scheduled_for", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      setRows([]);
      setLoading(false);
      setStatus(error.message);
      return;
    }

    setRows((data as QueueRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, QueueRow[]>();
    for (const r of rows) {
      const key = r.content_items ? (pickOne(r.content_items) as any)?.title ?? r.id : r.id;
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [rows]);

  return (
    <main>
      <h1 className="section-title">Programación de Posts</h1>
      <p className="muted">Datos reales: cola de publicación (`publish_queue`).</p>

      {status ? (
        <div className="card" style={{ marginTop: 12 }}>
          <p className="muted" style={{ margin: 0 }}>
            {status}
          </p>
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 16, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <span className="muted">Total: {rows.length}</span>
        <button className="button secondary" type="button" onClick={load} disabled={loading}>
          {loading ? "Cargando..." : "Refrescar"}
        </button>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        {loading ? <p className="muted">Cargando…</p> : null}
        {!loading && rows.length === 0 ? (
          <p className="muted">
            No hay publicaciones programadas todavía. Cuando implementemos el “Post Once, Publish Everywhere”, aparecerán aquí.
          </p>
        ) : null}

        {!loading && rows.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Contenido</th>
                <th>Plataforma</th>
                <th>Status</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {grouped.flatMap(([contentTitle, items]) =>
                items.map((r) => {
                  const content = pickOne(r.content_items) as any;
                  return (
                    <tr key={r.id}>
                      <td>{fmtDate(r.scheduled_for ?? r.created_at)}</td>
                      <td>{content?.title ?? contentTitle}</td>
                      <td>{r.platform}</td>
                      <td>{r.status}</td>
                      <td className="muted" style={{ maxWidth: 360 }}>
                        {r.error ?? "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        ) : null}
      </div>
    </main>
  );
}

