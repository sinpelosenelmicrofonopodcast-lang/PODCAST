"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ReportRow = {
  id: string;
  content_id: string;
  reason: string;
  status: string;
  created_at: string;
  users?: { nickname: string | null } | { nickname: string | null }[] | null;
};

const pickOne = <T,>(value: T | T[] | null | undefined) => (Array.isArray(value) ? value[0] : value);

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("es-PR");
}

export default function AdminReportsPage() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setStatus(null);

    const { data, error } = await supabase
      .from("reports")
      .select("id, content_id, reason, status, created_at, users(nickname)")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      setRows([]);
      setLoading(false);
      setStatus(error.message);
      return;
    }

    setRows((data as ReportRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (report: ReportRow, next: string) => {
    setBusyId(report.id);
    setStatus(null);
    const { error } = await supabase.from("reports").update({ status: next }).eq("id", report.id);
    setBusyId(null);
    if (error) {
      setStatus(error.message);
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === report.id ? { ...r, status: next } : r)));
  };

  return (
    <main>
      <h1 className="section-title">Reportes Internos</h1>
      <p className="muted">Datos reales (`reports`). Moderación legal: doxxing, amenazas, acoso repetitivo.</p>

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
        {!loading && rows.length === 0 ? <p className="muted">No hay reportes todavía.</p> : null}

        {!loading && rows.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Reportado por</th>
                <th>Contenido ID</th>
                <th>Razón</th>
                <th>Status</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const reporter = pickOne(r.users) as any;
                return (
                  <tr key={r.id}>
                    <td>{fmtDate(r.created_at)}</td>
                    <td>@{reporter?.nickname ?? "—"}</td>
                    <td className="muted">{r.content_id}</td>
                    <td>{r.reason}</td>
                    <td>{r.status}</td>
                    <td>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          className="button secondary"
                          type="button"
                          onClick={() => updateStatus(r, "open")}
                          disabled={busyId === r.id}
                        >
                          Open
                        </button>
                        <button
                          className="button secondary"
                          type="button"
                          onClick={() => updateStatus(r, "reviewing")}
                          disabled={busyId === r.id}
                        >
                          Reviewing
                        </button>
                        <button
                          className="button"
                          type="button"
                          onClick={() => updateStatus(r, "closed")}
                          disabled={busyId === r.id}
                        >
                          Close
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}
      </div>
    </main>
  );
}

