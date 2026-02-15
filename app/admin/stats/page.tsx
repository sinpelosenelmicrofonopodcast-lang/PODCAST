"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { StatCard } from "@/components/StatCard";
import { toast } from "@/lib/toast";

type StatsPayload = {
  website: {
    day: { visits: number; unique: number };
    week: { visits: number; unique: number };
    month: { visits: number; unique: number };
    chart14d: Array<{ date: string; visits: number; unique: number }>;
  };
  platforms: Record<
    string,
    {
      posts: number;
      views: number;
      likes: number;
      comments: number;
      shares: number;
      lastPostAt: string | null;
      shorts: number;
      long: number;
    }
  >;
};

const formatNumber = (value: number) => new Intl.NumberFormat("es-PR").format(value);

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-PR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

export default function AdminStatsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StatsPayload | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setError("Sesión inválida. Vuelve a iniciar sesión.");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/admin/stats", { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json?.error ?? `No se pudo cargar stats (HTTP ${res.status}).`);
      setLoading(false);
      return;
    }

    setData(json as StatsPayload);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const platformRows = useMemo(() => {
    const rows = Object.entries(data?.platforms ?? {}).map(([platform, agg]) => ({ platform, ...agg }));
    const order = ["YouTube", "Instagram", "Facebook", "TikTok", "Other"];
    rows.sort((a, b) => order.indexOf(a.platform) - order.indexOf(b.platform));
    return rows;
  }, [data]);

  const chartMax = useMemo(() => {
    const values = (data?.website?.chart14d ?? []).map((x) => x.visits);
    return Math.max(1, ...values);
  }, [data]);

  const handleSyncYT = async () => {
    try {
      const res = await fetch("/api/social/youtube/sync", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        toast.error(json?.error ?? "Error al sincronizar YouTube.");
        return;
      }
      toast.success(`YouTube sincronizado. Nuevos posts: ${json?.inserted ?? 0}`);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al sincronizar YouTube.");
    }
  };

  return (
    <main>
      <h1 className="section-title">Estadísticas</h1>
      <p className="muted">Visitas del sitio + métricas del feed sincronizado.</p>

      <div className="form-submit-bar" style={{ marginTop: 14 }}>
        <button className="button secondary" type="button" onClick={load} disabled={loading}>
          {loading ? "Cargando..." : "Actualizar"}
        </button>
        <button className="button" type="button" onClick={handleSyncYT}>
          Sincronizar YouTube ahora
        </button>
      </div>

      {error ? (
        <div className="card" style={{ marginTop: 16 }}>
          <strong>Error</strong>
          <p className="muted" style={{ marginBottom: 0 }}>
            {error}
          </p>
        </div>
      ) : null}

      <h2 className="section-title" style={{ marginTop: 26, fontSize: "clamp(24px,3vw,34px)" }}>
        Visitantes del sitio
      </h2>
      <div className="admin-grid" style={{ marginTop: 14 }}>
        <StatCard label="Únicos (hoy)" value={formatNumber(data?.website?.day?.unique ?? 0)} />
        <StatCard label="Únicos (7d)" value={formatNumber(data?.website?.week?.unique ?? 0)} />
        <StatCard label="Únicos (30d)" value={formatNumber(data?.website?.month?.unique ?? 0)} />
        <StatCard label="Visitas (hoy)" value={formatNumber(data?.website?.day?.visits ?? 0)} />
        <StatCard label="Visitas (7d)" value={formatNumber(data?.website?.week?.visits ?? 0)} />
        <StatCard label="Visitas (30d)" value={formatNumber(data?.website?.month?.visits ?? 0)} />
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h3 style={{ marginTop: 0 }}>Últimos 14 días</h3>
        <div style={{ display: "grid", gap: 10 }}>
          {(data?.website?.chart14d ?? []).map((row) => (
            <div key={row.date} style={{ display: "grid", gridTemplateColumns: "92px 1fr 92px", gap: 10, alignItems: "center" }}>
              <span className="muted" style={{ fontSize: 12 }}>
                {row.date}
              </span>
              <div style={{ height: 10, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${Math.round((row.visits / chartMax) * 100)}%`,
                    background: "linear-gradient(90deg, #ff2a2a, #ff7a18, #ffd23b)"
                  }}
                />
              </div>
              <span className="muted" style={{ fontSize: 12, textAlign: "right" }}>
                {formatNumber(row.visits)} / {formatNumber(row.unique)}
              </span>
            </div>
          ))}
          {(data?.website?.chart14d?.length ?? 0) === 0 ? <p className="muted">Aún no hay datos de visitas.</p> : null}
        </div>
      </div>

      <h2 className="section-title" style={{ marginTop: 26, fontSize: "clamp(24px,3vw,34px)" }}>
        Redes (feed sincronizado)
      </h2>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", marginTop: 14 }}>
        {platformRows.map((p) => (
          <article key={p.platform} className="card" style={{ display: "grid", gap: 8 }}>
            <span className="badge">{p.platform}</span>
            <div className="muted" style={{ display: "grid", gap: 4, fontSize: 13 }}>
              <span>Posts: {formatNumber(p.posts)}</span>
              <span>Views: {formatNumber(p.views)}</span>
              <span>Likes: {formatNumber(p.likes)}</span>
              <span>Comments: {formatNumber(p.comments)}</span>
              <span>Shares: {formatNumber(p.shares)}</span>
              {p.platform === "YouTube" ? (
                <span>
                  Shorts: {formatNumber(p.shorts)} · Episodios: {formatNumber(p.long)}
                </span>
              ) : null}
              <span>Último post: {formatDateTime(p.lastPostAt)}</span>
            </div>
          </article>
        ))}
        {platformRows.length === 0 ? (
          <article className="card">
            <span className="badge">Sin datos</span>
            <h3 style={{ marginTop: 0 }}>No hay métricas aún</h3>
            <p className="muted" style={{ marginBottom: 0 }}>
              YouTube se llena con “Sincronizar YouTube”. Instagram/Facebook/TikTok requiere integración API (fase siguiente).
            </p>
          </article>
        ) : null}
      </div>
    </main>
  );
}

