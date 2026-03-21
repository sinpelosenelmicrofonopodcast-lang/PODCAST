"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { authApiRequest } from "@/lib/clientApi";
import { toast } from "@/lib/toast";

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
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingScheduleFor, setEditingScheduleFor] = useState("");

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

  const isEpisodeFacebookJob = (row: JobRow) => row.job_type === "facebook_post_episode";

  const startReschedule = (row: JobRow) => {
    const parsed = new Date(row.scheduled_for);
    const local = Number.isNaN(parsed.getTime())
      ? ""
      : new Intl.DateTimeFormat("sv-SE", {
          timeZone: "America/Chicago",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false
        })
          .format(parsed)
          .replace(" ", "T");
    setEditingId(row.id);
    setEditingScheduleFor(local);
  };

  const saveReschedule = async (id: string) => {
    const localValue = editingScheduleFor.trim();
    if (!localValue) {
      setStatus("Selecciona fecha y hora para reprogramar.");
      return;
    }

    const parsed = new Date(localValue);
    if (!Number.isFinite(parsed.getTime())) {
      setStatus("Fecha/hora inválida para reprogramar.");
      return;
    }

    setActioningId(id);
    setStatus(null);
    const { ok, json } = await authApiRequest(`/api/admin/jobs/${id}`, {
      method: "PATCH",
      jsonBody: { scheduledFor: parsed.toISOString() }
    });
    setActioningId(null);

    if (!ok) {
      setStatus(json?.error ?? "No se pudo reprogramar el job.");
      return;
    }

    toast.success("Job reprogramado.");
    setEditingId(null);
    setEditingScheduleFor("");
    await load();
  };

  const cancelJob = async (id: string) => {
    const confirmed = window.confirm("¿Cancelar este job programado?");
    if (!confirmed) return;

    setActioningId(id);
    setStatus(null);
    const { ok, json } = await authApiRequest(`/api/admin/jobs/${id}`, { method: "DELETE" });
    setActioningId(null);

    if (!ok) {
      setStatus(json?.error ?? "No se pudo cancelar el job.");
      return;
    }

    toast.success("Job cancelado.");
    await load();
  };

  const postNow = async (id: string) => {
    setActioningId(id);
    setStatus(null);
    const { ok, json } = await authApiRequest(`/api/admin/jobs/${id}/post-now`, { method: "POST" });
    setActioningId(null);

    if (!ok) {
      setStatus(json?.error ?? "No se pudo publicar ahora.");
      return;
    }

    toast.success("Episodio publicado en Facebook.");
    await load();
  };

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
                <th>Acciones</th>
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
                    <td style={{ minWidth: 260 }}>
                      {isEpisodeFacebookJob(r) ? (
                        editingId === r.id ? (
                          <div style={{ display: "grid", gap: 8 }}>
                            <input
                              className="input"
                              type="datetime-local"
                              value={editingScheduleFor}
                              onChange={(e) => setEditingScheduleFor(e.target.value)}
                            />
                            <div className="admin-item-actions">
                              <button
                                className="button secondary"
                                type="button"
                                onClick={() => saveReschedule(r.id)}
                                disabled={actioningId === r.id}
                              >
                                Guardar
                              </button>
                              <button
                                className="button secondary"
                                type="button"
                                onClick={() => {
                                  setEditingId(null);
                                  setEditingScheduleFor("");
                                }}
                                disabled={actioningId === r.id}
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="admin-item-actions">
                            <button
                              className="button secondary"
                              type="button"
                              onClick={() => postNow(r.id)}
                              disabled={actioningId === r.id || r.status === "running" || r.status === "done"}
                            >
                              Post now
                            </button>
                            <button
                              className="button secondary"
                              type="button"
                              onClick={() => startReschedule(r)}
                              disabled={actioningId === r.id || r.status === "running" || r.status === "done"}
                            >
                              Reprogramar
                            </button>
                            <button
                              className="button secondary"
                              type="button"
                              onClick={() => cancelJob(r.id)}
                              disabled={actioningId === r.id || r.status === "running" || r.status === "done" || r.status === "cancelled"}
                            >
                              Cancelar
                            </button>
                          </div>
                        )
                      ) : (
                        <span className="muted">—</span>
                      )}
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
