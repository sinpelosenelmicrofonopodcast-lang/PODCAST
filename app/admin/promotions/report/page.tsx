import Link from "next/link";
import { requireStaffPageOrRedirect } from "@/lib/adminAuth";
import { supabaseService } from "@/lib/supabaseService";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Promotion = {
  id: string;
  title: string;
  placement: string;
  promo_type: string | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

type PromoEvent = {
  promotion_id: string;
  placement: string;
  event: string;
  session_id: string;
  created_at: string;
};

type CampaignMetric = {
  promotion: Promotion;
  impressions: number;
  clicks: number;
  dismissals: number;
  sessions: Set<string>;
  placements: Set<string>;
};

function pct(clicks: number, impressions: number) {
  if (!impressions) return "0.00%";
  return `${((clicks / impressions) * 100).toFixed(2)}%`;
}

function dateLabel(value: string | null) {
  if (!value) return "Sin límite";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString("es-US", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function PromotionsReportPage() {
  await requireStaffPageOrRedirect("/admin/promotions/report", "manage_promotions");
  const service = supabaseService();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [promosResp, eventsResp] = await Promise.all([
    service
      .from("promotions")
      .select("id,title,placement,promo_type,is_active,starts_at,ends_at")
      .order("is_active", { ascending: false })
      .order("display_order", { ascending: true }),
    service
      .from("promotion_events")
      .select("promotion_id,placement,event,session_id,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50000)
  ]);

  const promotions = (promosResp.data ?? []) as Promotion[];
  const events = (eventsResp.data ?? []) as PromoEvent[];
  const metrics = new Map<string, CampaignMetric>();

  promotions.forEach((promotion) => {
    metrics.set(promotion.id, {
      promotion,
      impressions: 0,
      clicks: 0,
      dismissals: 0,
      sessions: new Set<string>(),
      placements: new Set<string>()
    });
  });

  events.forEach((event) => {
    const row = metrics.get(event.promotion_id);
    if (!row) return;
    if (event.event === "impression") row.impressions += 1;
    if (event.event === "click") row.clicks += 1;
    if (event.event === "dismiss") row.dismissals += 1;
    if (event.session_id) row.sessions.add(event.session_id);
    if (event.placement) row.placements.add(event.placement);
  });

  const rows = Array.from(metrics.values()).sort((a, b) => {
    if (a.promotion.is_active !== b.promotion.is_active) return a.promotion.is_active ? -1 : 1;
    return b.impressions - a.impressions;
  });

  const totalImpressions = rows.reduce((sum, row) => sum + row.impressions, 0);
  const totalClicks = rows.reduce((sum, row) => sum + row.clicks, 0);
  const totalSessions = new Set(events.map((event) => event.session_id).filter(Boolean)).size;

  return (
    <main className="admin-page">
      <div className="admin-page-head">
        <div>
          <p className="page-kicker">MONETIZACIÓN · ÚLTIMOS 30 DÍAS</p>
          <h1>Reporte de sponsors</h1>
          <p className="muted">Impresiones, clics, CTR, sesiones y placements registrados por campaña.</p>
        </div>
        <div className="admin-item-actions">
          <Link className="button secondary" href="/admin/promotions">Gestionar promociones</Link>
          <Link className="button secondary" href="/publicidad">Ver landing comercial</Link>
        </div>
      </div>

      {(promosResp.error || eventsResp.error) ? (
        <div className="card" style={{ marginBottom: 20 }}>
          <strong>No se pudo cargar parte del reporte.</strong>
          <p className="muted">{promosResp.error?.message ?? eventsResp.error?.message}</p>
        </div>
      ) : null}

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14, marginBottom: 24 }}>
        <article className="card"><p className="muted">Impresiones</p><h2>{totalImpressions.toLocaleString()}</h2></article>
        <article className="card"><p className="muted">Clics</p><h2>{totalClicks.toLocaleString()}</h2></article>
        <article className="card"><p className="muted">CTR global</p><h2>{pct(totalClicks, totalImpressions)}</h2></article>
        <article className="card"><p className="muted">Sesiones alcanzadas</p><h2>{totalSessions.toLocaleString()}</h2></article>
      </section>

      <section className="card" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th style={{ padding: 12 }}>Campaña</th>
              <th style={{ padding: 12 }}>Estado</th>
              <th style={{ padding: 12 }}>Placement</th>
              <th style={{ padding: 12 }}>Impresiones</th>
              <th style={{ padding: 12 }}>Clics</th>
              <th style={{ padding: 12 }}>CTR</th>
              <th style={{ padding: 12 }}>Sesiones</th>
              <th style={{ padding: 12 }}>Periodo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.promotion.id} style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}>
                <td style={{ padding: 12 }}><strong>{row.promotion.title}</strong><div className="muted" style={{ fontSize: 12 }}>{row.promotion.promo_type ?? "sponsor"}</div></td>
                <td style={{ padding: 12 }}>{row.promotion.is_active ? "Activa" : "Inactiva"}</td>
                <td style={{ padding: 12 }}>{Array.from(row.placements).join(", ") || row.promotion.placement}</td>
                <td style={{ padding: 12 }}>{row.impressions.toLocaleString()}</td>
                <td style={{ padding: 12 }}>{row.clicks.toLocaleString()}</td>
                <td style={{ padding: 12 }}>{pct(row.clicks, row.impressions)}</td>
                <td style={{ padding: 12 }}>{row.sessions.size.toLocaleString()}</td>
                <td style={{ padding: 12 }}>{dateLabel(row.promotion.starts_at)} → {dateLabel(row.promotion.ends_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="muted">Todavía no hay campañas configuradas.</p> : null}
      </section>
    </main>
  );
}
