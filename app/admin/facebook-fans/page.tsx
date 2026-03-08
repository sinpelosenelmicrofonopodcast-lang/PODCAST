"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/lib/toast";

type RangeKey = "7d" | "30d" | "90d" | "custom";

type FanRow = {
  user_name: string | null;
  fb_user_id: string;
  total_comments: number;
  total_reactions: number;
  posts_interacted_count: number;
  engagement_score: number;
  last_interacted_at: string | null;
};

type OverviewPayload = {
  ok: boolean;
  connection: {
    connected: boolean;
    page_id: string | null;
    page_name: string | null;
    page_updated_at: string | null;
    token_expires_at: string | null;
    permissions: string[];
  };
  last_sync: {
    id: string;
    status: string;
    started_at: string | null;
    finished_at: string | null;
    posts_synced: number;
    comments_synced: number;
    reactions_synced: number;
    fans_updated: number;
    error_log: string | null;
  } | null;
  range: { key: RangeKey; start: string; end: string; post_id: string | null };
  kpis: {
    total_posts_synced: number;
    total_comments_recolected: number;
    total_reactions_recolected: number;
    total_fans_unique: number;
  };
  top_superfans: FanRow[];
  top_fans: FanRow[];
  recent_comments: Array<{
    fb_comment_id: string;
    fb_post_id: string | null;
    fb_user_id: string | null;
    user_name: string | null;
    message: string | null;
    created_time: string | null;
  }>;
  active_posts: Array<{
    fb_post_id: string;
    message: string | null;
    permalink_url: string | null;
    created_time: string | null;
    comments: number;
    reactions: number;
    engagement_score: number;
  }>;
  weekly_trend: Array<{
    week_start: string;
    comments: number;
    reactions: number;
    score: number;
  }>;
  post_options: Array<{
    fb_post_id: string;
    created_time: string | null;
    message: string | null;
    label: string;
  }>;
  error?: string;
};

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "—";
  return parsed.toLocaleString("es-PR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function fmtNum(value?: number | null) {
  return new Intl.NumberFormat("es-PR").format(Number(value ?? 0));
}

function clampDays(days: number) {
  return Math.max(1, Math.min(180, Math.floor(days || 30)));
}

function isoDateInput(value?: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

export default function AdminFacebookFansPage() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [payload, setPayload] = useState<OverviewPayload | null>(null);

  const [range, setRange] = useState<RangeKey>("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [postId, setPostId] = useState("");

  const chartMax = useMemo(() => {
    const values = (payload?.weekly_trend ?? []).map((row) => row.score);
    return Math.max(1, ...values);
  }, [payload?.weekly_trend]);

  const getToken = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token ?? "";
    if (!token) throw new Error("Sesión inválida. Vuelve a iniciar sesión.");
    return token;
  };

  const load = async (nextRange?: RangeKey) => {
    const selectedRange = nextRange ?? range;
    setLoading(true);
    setStatus(null);
    try {
      const token = await getToken();
      const qs = new URLSearchParams();
      qs.set("range", selectedRange);
      if (selectedRange === "custom" && customStart) qs.set("start", new Date(`${customStart}T00:00:00Z`).toISOString());
      if (selectedRange === "custom" && customEnd) qs.set("end", new Date(`${customEnd}T23:59:59Z`).toISOString());
      if (postId) qs.set("postId", postId);

      const res = await fetch(`/api/admin/facebook-fans/overview?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = (await res.json().catch(() => ({}))) as OverviewPayload;
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);

      setPayload(json);
      setRange(json.range?.key ?? selectedRange);
      if (!customStart && json.range?.start) setCustomStart(isoDateInput(json.range.start));
      if (!customEnd && json.range?.end) setCustomEnd(isoDateInput(json.range.end));
    } catch (e: any) {
      setStatus(e?.message ?? "No se pudo cargar Facebook Fans Activos.");
      setPayload(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/admin/facebook-fans/connect", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      toast.success("Facebook conectado correctamente.");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo conectar Facebook.");
    } finally {
      setConnecting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const token = await getToken();

      let days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
      if (range === "custom" && customStart && customEnd) {
        const start = new Date(`${customStart}T00:00:00Z`).getTime();
        const end = new Date(`${customEnd}T23:59:59Z`).getTime();
        if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
          days = Math.ceil((end - start) / (24 * 60 * 60 * 1000)) || 1;
        }
      }

      const res = await fetch("/api/admin/facebook-fans/sync", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ days: clampDays(days), maxPosts: 60 })
      });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      toast.success(
        `Sync completado: posts ${json.summary?.postsSynced ?? 0}, comentarios ${json.summary?.commentsSynced ?? 0}, reacciones ${json.summary?.reactionsSynced ?? 0}.`
      );
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo sincronizar Facebook.");
    } finally {
      setSyncing(false);
    }
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const token = await getToken();
      const qs = new URLSearchParams();
      qs.set("range", range);
      if (range === "custom" && customStart) qs.set("start", new Date(`${customStart}T00:00:00Z`).toISOString());
      if (range === "custom" && customEnd) qs.set("end", new Date(`${customEnd}T23:59:59Z`).toISOString());
      if (postId) qs.set("postId", postId);

      const res = await fetch(`/api/admin/facebook-fans/export?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({} as any));
        throw new Error(json?.error ?? `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `facebook_fans_activos_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("CSV exportado.");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo exportar CSV.");
    } finally {
      setExporting(false);
    }
  };

  const copyFbUserId = async (fbUserId: string) => {
    try {
      await navigator.clipboard.writeText(fbUserId);
      toast.success(`Copiado: ${fbUserId}`);
    } catch {
      toast.error("No se pudo copiar el fb_user_id.");
    }
  };

  return (
    <main>
      <h1 className="section-title">Facebook Fans Activos</h1>
      <p className="muted">Mini CRM interno basado en interacciones reales: comentarios, reacciones y fans más activos.</p>

      {status ? (
        <div className="card" style={{ marginTop: 14 }}>
          <p className="muted" style={{ margin: 0 }}>
            {status}
          </p>
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Conexión y sincronización</h3>
        <div className="muted" style={{ display: "grid", gap: 4 }}>
          <span>Estado conexión: {payload?.connection?.connected ? "Conectado" : "No conectado"}</span>
          <span>Página: {payload?.connection?.page_name ?? "—"} ({payload?.connection?.page_id ?? "—"})</span>
          <span>Última conexión: {fmtDate(payload?.connection?.page_updated_at)}</span>
          <span>Última sincronización: {fmtDate(payload?.last_sync?.finished_at ?? payload?.last_sync?.started_at)}</span>
        </div>
        <div className="form-submit-bar" style={{ marginTop: 12 }}>
          <button className="button" type="button" onClick={handleConnect} disabled={connecting}>
            {connecting ? "Conectando..." : "Conectar Facebook"}
          </button>
          <button className="button secondary" type="button" onClick={handleSync} disabled={syncing || connecting}>
            {syncing ? "Sincronizando..." : "Sincronizar ahora"}
          </button>
          <button className="button secondary" type="button" onClick={() => load()} disabled={loading || syncing}>
            {loading ? "Cargando..." : "Actualizar vista"}
          </button>
          <button className="button secondary" type="button" onClick={handleExportCsv} disabled={exporting || loading}>
            {exporting ? "Exportando..." : "Export CSV"}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Filtros</h3>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <label>
            Rango
            <select
              className="select"
              value={range}
              onChange={(e) => {
                const next = e.target.value as RangeKey;
                setRange(next);
              }}
            >
              <option value="7d">7 días</option>
              <option value="30d">30 días</option>
              <option value="90d">90 días</option>
              <option value="custom">Personalizado</option>
            </select>
          </label>
          <label>
            Desde
            <input
              className="input"
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              disabled={range !== "custom"}
            />
          </label>
          <label>
            Hasta
            <input
              className="input"
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              disabled={range !== "custom"}
            />
          </label>
          <label>
            Post específico
            <select className="select" value={postId} onChange={(e) => setPostId(e.target.value)}>
              <option value="">Todos</option>
              {(payload?.post_options ?? []).map((post) => (
                <option key={post.fb_post_id} value={post.fb_post_id}>
                  {post.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-submit-bar" style={{ marginTop: 12 }}>
          <button className="button" type="button" onClick={() => load(range)} disabled={loading}>
            Aplicar filtros
          </button>
        </div>
      </div>

      <div className="admin-grid" style={{ marginTop: 16 }}>
        <div className="card">
          <strong>Posts sincronizados</strong>
          <p className="muted" style={{ margin: "8px 0 0" }}>
            {fmtNum(payload?.kpis?.total_posts_synced)}
          </p>
        </div>
        <div className="card">
          <strong>Comentarios recolectados</strong>
          <p className="muted" style={{ margin: "8px 0 0" }}>
            {fmtNum(payload?.kpis?.total_comments_recolected)}
          </p>
        </div>
        <div className="card">
          <strong>Reacciones recolectadas</strong>
          <p className="muted" style={{ margin: "8px 0 0" }}>
            {fmtNum(payload?.kpis?.total_reactions_recolected)}
          </p>
        </div>
        <div className="card">
          <strong>Fans únicos detectados</strong>
          <p className="muted" style={{ margin: "8px 0 0" }}>
            {fmtNum(payload?.kpis?.total_fans_unique)}
          </p>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "minmax(320px, 1fr) minmax(320px, 2fr)", marginTop: 16 }}>
        <article className="card">
          <h3 style={{ marginTop: 0 }}>Top 10 Superfans</h3>
          {(payload?.top_superfans?.length ?? 0) === 0 ? (
            <p className="muted">Sin datos todavía.</p>
          ) : (
            <div className="list">
              {(payload?.top_superfans ?? []).map((fan, index) => (
                <div key={fan.fb_user_id} className="card" style={{ padding: 10 }}>
                  <strong>
                    #{index + 1} {fan.user_name ?? "Fan sin nombre"}
                  </strong>
                  <div className="muted" style={{ fontSize: 12 }}>
                    Score: {fmtNum(fan.engagement_score)} · Comentarios: {fmtNum(fan.total_comments)} · Reacciones:{" "}
                    {fmtNum(fan.total_reactions)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="card">
          <h3 style={{ marginTop: 0 }}>Tendencia semanal de engagement</h3>
          {(payload?.weekly_trend?.length ?? 0) === 0 ? (
            <p className="muted">Sin actividad en el rango seleccionado.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {(payload?.weekly_trend ?? []).map((row) => (
                <div key={row.week_start} style={{ display: "grid", gridTemplateColumns: "95px 1fr 130px", gap: 8, alignItems: "center" }}>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {row.week_start}
                  </span>
                  <div style={{ height: 10, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.round((row.score / chartMax) * 100)}%`,
                        background: "linear-gradient(90deg, #ff2a2a, #ff7a18, #ffd23b)"
                      }}
                    />
                  </div>
                  <span className="muted" style={{ fontSize: 12, textAlign: "right" }}>
                    Score {fmtNum(row.score)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Top Fans</h3>
        {(payload?.top_fans?.length ?? 0) === 0 ? (
          <p className="muted">No hay fans en el rango seleccionado.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>fb_user_id</th>
                <th>Comentarios</th>
                <th>Reacciones</th>
                <th>Score</th>
                <th>Última interacción</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {(payload?.top_fans ?? []).slice(0, 150).map((fan) => (
                <tr key={fan.fb_user_id}>
                  <td>{fan.user_name ?? "—"}</td>
                  <td className="muted">{fan.fb_user_id}</td>
                  <td>{fmtNum(fan.total_comments)}</td>
                  <td>{fmtNum(fan.total_reactions)}</td>
                  <td>{fmtNum(fan.engagement_score)}</td>
                  <td>{fmtDate(fan.last_interacted_at)}</td>
                  <td>
                    <button className="button secondary" type="button" onClick={() => copyFbUserId(fan.fb_user_id)}>
                      Copiar ID
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", marginTop: 16 }}>
        <article className="card">
          <h3 style={{ marginTop: 0 }}>Comentarios recientes</h3>
          {(payload?.recent_comments?.length ?? 0) === 0 ? (
            <p className="muted">Sin comentarios recientes.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Comentario</th>
                  <th>Post</th>
                </tr>
              </thead>
              <tbody>
                {(payload?.recent_comments ?? []).slice(0, 80).map((comment) => (
                  <tr key={comment.fb_comment_id}>
                    <td>{fmtDate(comment.created_time)}</td>
                    <td>{comment.user_name ?? "—"}</td>
                    <td className="muted">{comment.message ?? "—"}</td>
                    <td className="muted">{comment.fb_post_id ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>

        <article className="card">
          <h3 style={{ marginTop: 0 }}>Posts más activos</h3>
          {(payload?.active_posts?.length ?? 0) === 0 ? (
            <p className="muted">Sin actividad para mostrar.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Post</th>
                  <th>Comentarios</th>
                  <th>Reacciones</th>
                  <th>Score</th>
                  <th>Link</th>
                </tr>
              </thead>
              <tbody>
                {(payload?.active_posts ?? []).slice(0, 50).map((post) => (
                  <tr key={post.fb_post_id}>
                    <td className="muted">
                      {String(post.message ?? "").replace(/\s+/g, " ").trim().slice(0, 100) || post.fb_post_id}
                    </td>
                    <td>{fmtNum(post.comments)}</td>
                    <td>{fmtNum(post.reactions)}</td>
                    <td>{fmtNum(post.engagement_score)}</td>
                    <td>
                      {post.permalink_url ? (
                        <a className="button secondary" href={post.permalink_url} target="_blank" rel="noreferrer">
                          Abrir
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>
      </div>
    </main>
  );
}

