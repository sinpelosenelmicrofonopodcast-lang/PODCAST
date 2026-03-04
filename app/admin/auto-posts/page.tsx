"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { chicagoDateInputFromNow, chicagoDateTimeLabel } from "@/lib/autoPosts";
import { toast } from "@/lib/toast";

type ScheduledPost = {
  id: string;
  platform: string;
  message: string;
  media_url: string | null;
  scheduled_for: string;
  status: "queued" | "publishing" | "posted" | "failed" | "cancelled";
  posted_at: string | null;
  remote_id: string | null;
  error: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type ApiListPayload = {
  ok: boolean;
  items: ScheduledPost[];
  date: string;
  timezone: string;
  summary: { total: number; byStatus: Record<string, number> };
  error?: string;
};

const STATUS_OPTIONS = ["all", "queued", "publishing", "posted", "failed", "cancelled"] as const;

type StatusFilter = (typeof STATUS_OPTIONS)[number];

export default function AdminAutoPostsPage() {
  const [date, setDate] = useState(chicagoDateInputFromNow());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [items, setItems] = useState<ScheduledPost[]>([]);
  const [summary, setSummary] = useState<{ total: number; byStatus: Record<string, number> }>({ total: 0, byStatus: {} });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("22:00");
  const [intervalMinutes, setIntervalMinutes] = useState(30);
  const [countOverride, setCountOverride] = useState("");
  const [generating, setGenerating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState("");

  const byStatus = useMemo(() => summary.byStatus ?? {}, [summary]);

  async function getToken() {
    const sessionData = await supabase.auth.getSession();
    return sessionData.data.session?.access_token ?? "";
  }

  const load = async () => {
    setLoading(true);
    setStatus(null);

    const token = await getToken();
    if (!token) {
      setStatus("Sesión inválida. Inicia sesión otra vez.");
      setLoading(false);
      return;
    }

    const qs = new URLSearchParams({ date, status: statusFilter });
    const res = await fetch(`/api/admin/auto-posts?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const json = (await res.json().catch(() => ({}))) as ApiListPayload;

    if (!res.ok || !json?.ok) {
      setStatus(json?.error ?? `No se pudo cargar auto-posts (HTTP ${res.status}).`);
      setItems([]);
      setSummary({ total: 0, byStatus: {} });
      setLoading(false);
      return;
    }

    setItems(json.items ?? []);
    setSummary(json.summary ?? { total: 0, byStatus: {} });
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, statusFilter]);

  const handleGenerate = async () => {
    setGenerating(true);
    setStatus(null);
    const token = await getToken();
    if (!token) {
      setStatus("Sesión inválida. Inicia sesión otra vez.");
      setGenerating(false);
      return;
    }

    const countParsed = Number(countOverride);
    const payload = {
      date,
      startTime,
      endTime,
      intervalMinutes,
      countOverride: Number.isFinite(countParsed) && countParsed > 0 ? Math.floor(countParsed) : null
    };

    const res = await fetch("/api/admin/auto-posts/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok || !json?.ok) {
      setStatus(json?.error ?? "No se pudo generar posts.");
      setGenerating(false);
      return;
    }

    toast.success(`Generados ${json?.inserted ?? 0} posts (de ${json?.requested ?? 0} slots).`);
    setGenerating(false);
    await load();
  };

  const startEdit = (item: ScheduledPost) => {
    setEditingId(item.id);
    setEditingMessage(item.message);
  };

  const saveEdit = async (id: string) => {
    const token = await getToken();
    if (!token) {
      setStatus("Sesión inválida. Inicia sesión otra vez.");
      return;
    }

    const res = await fetch(`/api/admin/auto-posts/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ message: editingMessage })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) {
      setStatus(json?.error ?? "No se pudo guardar edición.");
      return;
    }

    toast.success("Mensaje actualizado.");
    setEditingId(null);
    setEditingMessage("");
    await load();
  };

  const cancelPost = async (id: string) => {
    const token = await getToken();
    if (!token) {
      setStatus("Sesión inválida. Inicia sesión otra vez.");
      return;
    }

    const res = await fetch(`/api/admin/auto-posts/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) {
      setStatus(json?.error ?? "No se pudo cancelar el post.");
      return;
    }

    toast.success("Post cancelado.");
    await load();
  };

  const postNow = async (id: string) => {
    const token = await getToken();
    if (!token) {
      setStatus("Sesión inválida. Inicia sesión otra vez.");
      return;
    }

    const res = await fetch(`/api/admin/auto-posts/${id}/post-now`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) {
      setStatus(json?.error ?? "No se pudo publicar ahora.");
      return;
    }

    toast.success("Publicado en Facebook.");
    await load();
  };

  return (
    <main>
      <h1 className="section-title">Auto Posts</h1>
      <p className="muted">Genera y programa publicaciones automáticas para Facebook Page (America/Chicago).</p>

      <div className="card" style={{ marginTop: 16, display: "grid", gap: 12 }}>
        <strong>Generador</strong>
        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))"
          }}
        >
          <label>
            Fecha
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            Inicio
            <input className="input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </label>
          <label>
            Fin
            <input className="input" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </label>
          <label>
            Intervalo (min)
            <input
              className="input"
              type="number"
              min={5}
              step={5}
              value={intervalMinutes}
              onChange={(e) => setIntervalMinutes(Math.max(5, Number(e.target.value || 30)))}
            />
          </label>
        </div>

        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
          }}
        >
          <label>
            Cantidad (opcional)
            <input
              className="input"
              type="number"
              min={1}
              placeholder="Ej: 12"
              value={countOverride}
              onChange={(e) => setCountOverride(e.target.value)}
            />
          </label>
          <label>
            Filtro status
            <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-submit-bar">
          <button className="button" type="button" onClick={handleGenerate} disabled={generating}>
            {generating ? "Generando..." : "Generar posts del día"}
          </button>
          <button className="button secondary" type="button" onClick={load} disabled={loading}>
            {loading ? "Cargando..." : "Actualizar lista"}
          </button>
        </div>
      </div>

      {status ? (
        <div className="card" style={{ marginTop: 14 }}>
          <p className="muted" style={{ margin: 0 }}>
            {status}
          </p>
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 18 }}>
        <div className="muted" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span>Total: {summary.total}</span>
          <span>Queued: {byStatus.queued ?? 0}</span>
          <span>Publishing: {byStatus.publishing ?? 0}</span>
          <span>Posted: {byStatus.posted ?? 0}</span>
          <span>Failed: {byStatus.failed ?? 0}</span>
          <span>Cancelled: {byStatus.cancelled ?? 0}</span>
        </div>

        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Hora (Chicago)</th>
                <th>Mensaje</th>
                <th>Status</th>
                <th>Logs</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{chicagoDateTimeLabel(item.scheduled_for)}</td>
                  <td style={{ minWidth: 360 }}>
                    {editingId === item.id ? (
                      <div style={{ display: "grid", gap: 8 }}>
                        <textarea
                          className="textarea"
                          rows={3}
                          value={editingMessage}
                          onChange={(e) => setEditingMessage(e.target.value)}
                        />
                        <div className="form-submit-bar">
                          <button className="button secondary" type="button" onClick={() => saveEdit(item.id)}>
                            Guardar
                          </button>
                          <button className="button secondary" type="button" onClick={() => setEditingId(null)}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span>{item.message}</span>
                    )}
                  </td>
                  <td>{item.status}</td>
                  <td className="muted" style={{ minWidth: 220 }}>
                    {item.error ? item.error : item.remote_id ? `remote_id: ${item.remote_id}` : "—"}
                  </td>
                  <td style={{ minWidth: 280 }}>
                    <div className="admin-item-actions">
                      {editingId !== item.id ? (
                        <button
                          className="button secondary"
                          type="button"
                          onClick={() => startEdit(item)}
                          disabled={item.status === "posted" || item.status === "publishing"}
                        >
                          Editar
                        </button>
                      ) : null}
                      <button className="button secondary" type="button" onClick={() => postNow(item.id)} disabled={item.status === "publishing"}>
                        Post now
                      </button>
                      <button
                        className="button secondary"
                        type="button"
                        onClick={() => cancelPost(item.id)}
                        disabled={item.status === "posted" || item.status === "cancelled" || item.status === "publishing"}
                      >
                        Cancelar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && items.length === 0 ? <p className="muted">No hay posts para esta fecha/filtro.</p> : null}
        </div>
      </div>
    </main>
  );
}
