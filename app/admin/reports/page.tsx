"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type PipelineEventRow = {
  id: string;
  job_id: string | null;
  stage: string;
  status: string;
  content_type: string | null;
  content_id: string | null;
  platform: string | null;
  message: string | null;
  meta: Record<string, any> | null;
  created_at: string;
};

type FailedJobRow = {
  id: string;
  job_type: string;
  source: string | null;
  content_type: string | null;
  content_id: string | null;
  title: string | null;
  error: string | null;
  finished_at: string | null;
  updated_at: string;
};

type ReportsPayload = {
  ok: boolean;
  summary: {
    window: string;
    totalEvents: number;
    byStage: Record<string, number>;
    byStatus: Record<string, number>;
  };
  kpis?: {
    jobs24h: number;
    done24h: number;
    failed24h: number;
    completionRate: number;
    jobsByType: Record<string, number>;
    adminActions24h: number | null;
  };
  funnel?: {
    ingested: number;
    drafted: number;
    published: number;
    social: number;
    failed: number;
  };
  events: PipelineEventRow[];
  failedJobs: FailedJobRow[];
  error?: string;
};

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("es-PR");
}

export default function AdminReportsPage() {
  const [events, setEvents] = useState<PipelineEventRow[]>([]);
  const [failedJobs, setFailedJobs] = useState<FailedJobRow[]>([]);
  const [summary, setSummary] = useState<ReportsPayload["summary"]>({
    window: "24h",
    totalEvents: 0,
    byStage: {},
    byStatus: {}
  });
  const [kpis, setKpis] = useState<NonNullable<ReportsPayload["kpis"]>>({
    jobs24h: 0,
    done24h: 0,
    failed24h: 0,
    completionRate: 0,
    jobsByType: {},
    adminActions24h: null
  });
  const [funnel, setFunnel] = useState<NonNullable<ReportsPayload["funnel"]>>({
    ingested: 0,
    drafted: 0,
    published: 0,
    social: 0,
    failed: 0
  });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setStatus(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setLoading(false);
      setStatus("Sesión inválida. Vuelve a iniciar sesión.");
      return;
    }

    const res = await fetch("/api/admin/pipeline-events?limit=250", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const json = (await res.json().catch(() => ({}))) as ReportsPayload;
    if (!res.ok || !json?.ok) {
      setStatus(json?.error ?? `No se pudo cargar reportes (HTTP ${res.status}).`);
      setEvents([]);
      setFailedJobs([]);
      setSummary({ window: "24h", totalEvents: 0, byStage: {}, byStatus: {} });
      setKpis({ jobs24h: 0, done24h: 0, failed24h: 0, completionRate: 0, jobsByType: {}, adminActions24h: null });
      setFunnel({ ingested: 0, drafted: 0, published: 0, social: 0, failed: 0 });
      setLoading(false);
      return;
    }

    setEvents(json.events ?? []);
    setFailedJobs(json.failedJobs ?? []);
    setSummary(json.summary ?? { window: "24h", totalEvents: 0, byStage: {}, byStatus: {} });
    setKpis(json.kpis ?? { jobs24h: 0, done24h: 0, failed24h: 0, completionRate: 0, jobsByType: {}, adminActions24h: null });
    setFunnel(json.funnel ?? { ingested: 0, drafted: 0, published: 0, social: 0, failed: 0 });
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const stageEntries = useMemo(() => Object.entries(summary.byStage ?? {}), [summary.byStage]);
  const statusEntries = useMemo(() => Object.entries(summary.byStatus ?? {}), [summary.byStatus]);

  return (
    <main>
      <h1 className="section-title">Reportes Operacionales</h1>
      <p className="muted">Trazabilidad real del pipeline: ingestado → draft → publicado → social.</p>

      {status ? (
        <div className="card" style={{ marginTop: 12 }}>
          <p className="muted" style={{ margin: 0 }}>
            {status}
          </p>
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 16, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div className="muted" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span>Ventana: {summary.window}</span>
          <span>Total eventos: {summary.totalEvents}</span>
          <span>Errores: {summary.byStatus?.error ?? 0}</span>
        </div>
        <button className="button secondary" type="button" onClick={load} disabled={loading}>
          {loading ? "Cargando..." : "Refrescar"}
        </button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginTop: 16 }}>
        <article className="card">
          <h4 style={{ marginTop: 0, marginBottom: 6 }}>Jobs 24h</h4>
          <strong style={{ fontSize: 28 }}>{kpis.jobs24h}</strong>
        </article>
        <article className="card">
          <h4 style={{ marginTop: 0, marginBottom: 6 }}>Éxito 24h</h4>
          <strong style={{ fontSize: 28 }}>{kpis.completionRate}%</strong>
          <p className="muted" style={{ margin: "6px 0 0" }}>
            done: {kpis.done24h} · failed: {kpis.failed24h}
          </p>
        </article>
        <article className="card">
          <h4 style={{ marginTop: 0, marginBottom: 6 }}>Acciones admin</h4>
          <strong style={{ fontSize: 28 }}>{kpis.adminActions24h ?? "—"}</strong>
        </article>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Embudo 24h</h3>
        <div className="muted" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span>Ingestado: {funnel.ingested}</span>
          <span>Draft: {funnel.drafted}</span>
          <span>Publicado: {funnel.published}</span>
          <span>Social: {funnel.social}</span>
          <span>Errores: {funnel.failed}</span>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", marginTop: 16 }}>
        <article className="card">
          <h3 style={{ marginTop: 0 }}>Por etapa (24h)</h3>
          {stageEntries.length === 0 ? <p className="muted">Sin eventos.</p> : null}
          <div className="muted" style={{ display: "grid", gap: 6, fontSize: 13 }}>
            {stageEntries.map(([k, v]) => (
              <span key={k}>
                {k}: {v}
              </span>
            ))}
          </div>
        </article>
        <article className="card">
          <h3 style={{ marginTop: 0 }}>Por estado (24h)</h3>
          {statusEntries.length === 0 ? <p className="muted">Sin eventos.</p> : null}
          <div className="muted" style={{ display: "grid", gap: 6, fontSize: 13 }}>
            {statusEntries.map(([k, v]) => (
              <span key={k}>
                {k}: {v}
              </span>
            ))}
          </div>
        </article>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Jobs por tipo (24h)</h3>
        {Object.keys(kpis.jobsByType).length === 0 ? (
          <p className="muted">Sin jobs en la ventana.</p>
        ) : (
          <div className="muted" style={{ display: "grid", gap: 6, fontSize: 13 }}>
            {Object.entries(kpis.jobsByType).map(([name, count]) => (
              <span key={name}>
                {name}: {count}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h3 style={{ marginTop: 0 }}>Eventos recientes</h3>
        {loading ? <p className="muted">Cargando…</p> : null}
        {!loading && events.length === 0 ? <p className="muted">No hay eventos recientes.</p> : null}

        {!loading && events.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Etapa</th>
                <th>Estado</th>
                <th>Contenido</th>
                <th>Plataforma</th>
                <th>Mensaje</th>
                <th>Job</th>
              </tr>
            </thead>
            <tbody>
              {events.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.created_at)}</td>
                  <td>{r.stage}</td>
                  <td>{r.status}</td>
                  <td className="muted">
                    {r.content_type ?? "—"} · {r.content_id ?? "—"}
                  </td>
                  <td>{r.platform ?? "—"}</td>
                  <td className="muted" style={{ maxWidth: 380 }}>
                    {r.message ?? "—"}
                  </td>
                  <td className="muted">{r.job_id ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h3 style={{ marginTop: 0 }}>Jobs fallidos</h3>
        {!loading && failedJobs.length === 0 ? <p className="muted">No hay jobs fallidos.</p> : null}
        {!loading && failedJobs.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Job</th>
                <th>Contenido</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {failedJobs.map((job) => (
                <tr key={job.id}>
                  <td>{fmtDate(job.finished_at ?? job.updated_at)}</td>
                  <td>
                    <strong>{job.job_type}</strong>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {job.source ?? "—"}
                    </div>
                  </td>
                  <td className="muted">
                    {job.title ?? "—"} <br />
                    {job.content_type ?? "—"} · {job.content_id ?? "—"}
                  </td>
                  <td className="muted" style={{ maxWidth: 420 }}>
                    {job.error ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </main>
  );
}
