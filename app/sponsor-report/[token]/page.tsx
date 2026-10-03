import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { supabaseService } from "@/lib/supabaseService";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Reporte de campaña | Sin Pelos",
  description: "Reporte privado de rendimiento de campaña.",
  robots: { index: false, follow: false, nocache: true }
};

type Promotion = {
  id: string;
  title: string;
  advertiser: string | null;
  campaign_id: string | null;
  creative_id: string | null;
  placement: string;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  revenue_cents: number | null;
  target_sections: string[] | null;
};

type EventRow = {
  event: string;
  session_id: string | null;
  placement: string | null;
  path: string | null;
  created_at: string;
};

function pct(value: number, total: number) {
  if (!total) return "0.00%";
  return `${((value / total) * 100).toFixed(2)}%`;
}

function dateLabel(value?: string | null) {
  if (!value) return "Sin límite";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString("es-US", { day: "2-digit", month: "short", year: "numeric" })
    : "—";
}

export default async function SponsorReportPage({ params }: { params: { token: string } }) {
  const token = String(params.token ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();

  const service = supabaseService();
  const promoResp = await service
    .from("promotions")
    .select("id,title,advertiser,campaign_id,creative_id,placement,starts_at,ends_at,is_active,revenue_cents,target_sections")
    .eq("report_token", token)
    .maybeSingle();

  if (promoResp.error || !promoResp.data) notFound();
  const promotion = promoResp.data as Promotion;

  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [recentResp, lifetimeResp] = await Promise.all([
    service
      .from("promotion_events")
      .select("event,session_id,placement,path,created_at")
      .eq("promotion_id", promotion.id)
      .gte("created_at", since30)
      .order("created_at", { ascending: false })
      .limit(50000),
    service
      .from("promotion_events")
      .select("event,session_id,placement,path,created_at")
      .eq("promotion_id", promotion.id)
      .order("created_at", { ascending: false })
      .limit(50000)
  ]);

  const recent = (recentResp.data ?? []) as EventRow[];
  const lifetime = (lifetimeResp.data ?? []) as EventRow[];
  const summarize = (rows: EventRow[]) => {
    const impressions = rows.filter((row) => row.event === "impression").length;
    const clicks = rows.filter((row) => row.event === "click").length;
    const sessions = new Set(rows.filter((row) => row.event === "impression").map((row) => row.session_id).filter(Boolean)).size;
    return { impressions, clicks, sessions, ctr: pct(clicks, impressions) };
  };

  const last30 = summarize(recent);
  const allTime = summarize(lifetime);
  const pathCounts = new Map<string, { impressions: number; clicks: number }>();
  for (const row of recent) {
    const path = row.path || "/";
    const current = pathCounts.get(path) ?? { impressions: 0, clicks: 0 };
    if (row.event === "impression") current.impressions += 1;
    if (row.event === "click") current.clicks += 1;
    pathCounts.set(path, current);
  }
  const topPaths = Array.from(pathCounts.entries())
    .map(([path, stats]) => ({ path, ...stats }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 10);

  return (
    <main className="app-enter">
      <Navbar />
      <section className="section">
        <div className="container" style={{ maxWidth: 1120 }}>
          <header className="page-header-card" style={{ marginBottom: 24 }}>
            <p className="page-kicker">REPORTE PRIVADO · SPONSOR</p>
            <h1 className="section-title">{promotion.advertiser || promotion.title}</h1>
            <p className="muted">{promotion.title}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
              <span className="badge">{promotion.is_active ? "CAMPAÑA ACTIVA" : "CAMPAÑA FINALIZADA"}</span>
              <span className="badge">{promotion.placement}</span>
              {promotion.campaign_id ? <span className="badge">{promotion.campaign_id}</span> : null}
            </div>
          </header>

          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 24 }}>
            <article className="card"><p className="muted">Impresiones · 30 días</p><h2>{last30.impressions.toLocaleString()}</h2></article>
            <article className="card"><p className="muted">Clics · 30 días</p><h2>{last30.clicks.toLocaleString()}</h2></article>
            <article className="card"><p className="muted">CTR · 30 días</p><h2>{last30.ctr}</h2></article>
            <article className="card"><p className="muted">Sesiones alcanzadas · 30 días</p><h2>{last30.sessions.toLocaleString()}</h2></article>
          </section>

          <section className="card" style={{ marginBottom: 24 }}>
            <h2>Resumen de campaña</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 14 }}>
              <div><p className="muted">Periodo</p><strong>{dateLabel(promotion.starts_at)} → {dateLabel(promotion.ends_at)}</strong></div>
              <div><p className="muted">Placement contratado</p><strong>{promotion.placement}</strong></div>
              <div><p className="muted">Secciones</p><strong>{promotion.target_sections?.length ? promotion.target_sections.join(", ") : "Global"}</strong></div>
              <div><p className="muted">Impresiones acumuladas</p><strong>{allTime.impressions.toLocaleString()}</strong></div>
              <div><p className="muted">Clics acumulados</p><strong>{allTime.clicks.toLocaleString()}</strong></div>
              <div><p className="muted">CTR acumulado</p><strong>{allTime.ctr}</strong></div>
            </div>
          </section>

          <section className="card" style={{ overflowX: "auto" }}>
            <h2>Rendimiento por página · últimos 30 días</h2>
            {topPaths.length ? (
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
                <thead><tr style={{ textAlign: "left" }}><th style={{ padding: 10 }}>Página</th><th style={{ padding: 10 }}>Impresiones</th><th style={{ padding: 10 }}>Clics</th><th style={{ padding: 10 }}>CTR</th></tr></thead>
                <tbody>
                  {topPaths.map((row) => (
                    <tr key={row.path} style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}>
                      <td style={{ padding: 10 }}>{row.path}</td>
                      <td style={{ padding: 10 }}>{row.impressions.toLocaleString()}</td>
                      <td style={{ padding: 10 }}>{row.clicks.toLocaleString()}</td>
                      <td style={{ padding: 10 }}>{pct(row.clicks, row.impressions)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="muted">Todavía no hay eventos suficientes para desglosar el rendimiento.</p>}
          </section>

          <p className="muted" style={{ marginTop: 18, fontSize: 13 }}>
            Este enlace es privado y funciona como acceso al reporte de campaña. No lo publiques en redes ni lo compartas fuera de tu equipo.
          </p>
        </div>
      </section>
      <Footer />
    </main>
  );
}
