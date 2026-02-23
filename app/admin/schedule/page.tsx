"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type JobRow = {
  id: string;
  job_type: string;
  source: string | null;
  title: string | null;
  content_type: string | null;
  content_id: string | null;
  content_title: string | null;
  status: string;
  priority: number;
  scheduled_for: string;
  started_at: string | null;
  finished_at: string | null;
  attempts: number;
  max_attempts: number;
  error: string | null;
  created_at: string;
  updated_at: string;
};

type JobsPayload = {
  ok: boolean;
  jobs: JobRow[];
  summary: { total: number; byStatus: Record<string, number> };
  error?: string;
};

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("es-PR");
}

export default function AdminSchedulePage() {
  const [rows, setRows] = useState<JobRow[]>([]);
  const [summary, setSummary] = useState<{ total: number; byStatus: Record<string, number> }>({ total: 0, byStatus: {} });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setStatus(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setRows([]);
      setSummary({ total: 0, byStatus: {} });
      setLoading(false);
      setStatus("Sesión inválida. Vuelve a iniciar sesión.");
      return;
    }

    const res = await fetch("/api/admin/jobs?limit=200", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const json = (await res.json().catch(() => ({}))) as JobsPayload;

    if (!res.ok || !json?.ok) {
      setRows([]);
      setSummary({ total: 0, byStatus: {} });
      setLoading(false);
      setStatus(json?.error ?? `No se pudo cargar jobs (HTTP ${res.status}).`);
      return;
    }

    setRows(json.jobs ?? []);
    setSummary(json.summary ?? { total: 0, byStatus: {} });
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, JobRow[]>();
    for (const r of rows) {
      const key = r.content_title ?? r.title ?? `${r.content_type ?? "content"}:${r.content_id ?? r.id}`;
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [rows]);

  return (
    <main>
      <h1 className="section-title">Programación / Cola Real</h1>
      <p className="muted">Jobs reales (`automation_jobs`) con estados: queued, running, done, failed.</p>

      {status ? (
        <div className="card" style={{ marginTop: 12 }}>
          <p className="muted" style={{ margin: 0 }}>
            {status}
          </p>
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 16, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div className="muted" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span>Total: {summary.total}</span>
          <span>Queued: {summary.byStatus?.queued ?? 0}</span>
          <span>Running: {summary.byStatus?.running ?? 0}</span>
          <span>Done: {summary.byStatus?.done ?? 0}</span>
          <span>Failed: {summary.byStatus?.failed ?? 0}</span>
        </div>
        <button className="button secondary" type="button" onClick={load} disabled={loading}>
          {loading ? "Cargando..." : "Refrescar"}
        </button>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        {loading ? <p className="muted">Cargando…</p> : null}
        {!loading && rows.length === 0 ? <p className="muted">No hay jobs todavía.</p> : null}

        {!loading && rows.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Contenido</th>
                <th>Estado</th>
                <th>Programado</th>
                <th>Inicio / Fin</th>
                <th>Intentos</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {grouped.flatMap(([contentTitle, jobs]) =>
                jobs.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.job_type}</strong>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {r.source ?? "—"} · {r.priority}
                      </div>
                    </td>
                    <td>
                      <div>{contentTitle}</div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {r.content_type ?? "—"} · {r.content_id ?? "—"}
                      </div>
                    </td>
                    <td>{r.status}</td>
                    <td>{fmtDate(r.scheduled_for)}</td>
                    <td className="muted" style={{ fontSize: 12 }}>
                      {fmtDate(r.started_at)} <br /> {fmtDate(r.finished_at)}
                    </td>
                    <td>
                      {r.attempts}/{r.max_attempts}
                    </td>
                    <td className="muted" style={{ maxWidth: 360 }}>
                      {r.error ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : null}
      </div>
    </main>
  );
}
