import Link from "next/link";
import { requireStaffPageOrRedirect } from "@/lib/adminAuth";
import { supabaseService } from "@/lib/supabaseService";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SELLABLE_PLACEMENTS = [
  "top_banner",
  "home_featured",
  "home_mid",
  "section_header",
  "mid_content",
  "article_inline_2",
  "side_sticky",
  "podcast_sponsor",
  "community_partner",
  "bottom_sticky",
];

type Promotion = {
  id: string;
  title: string;
  placement: string;
  promo_type: string | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  campaign_id: string | null;
  advertiser: string | null;
  creative_id: string | null;
  weight: number | null;
  frequency_cap: number | null;
  max_impressions: number | null;
  daily_cap: number | null;
  revenue_cents: number | null;
  report_token: string | null;
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

function pct(value: number, total: number) {
  if (!total) return "0.00%";
  return `${((value / total) * 100).toFixed(2)}%`;
}

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
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
      .select("id,title,placement,promo_type,is_active,starts_at,ends_at,campaign_id,advertiser,creative_id,weight,frequency_cap,max_impressions,daily_cap,revenue_cents,report_token")
      .order("is_active", { ascending: false })
      .order("display_order", { ascending: true }),
    service
      .from("promotion_events")
      .select("promotion_id,placement,event,session_id,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50000),
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
      placements: new Set<string>(),
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
  const totalRevenueCents = promotions.reduce((sum, promo) => sum + Number(promo.revenue_cents ?? 0), 0);
  const activePlacements = new Set(promotions.filter((promo) => promo.is_active && SELLABLE_PLACEMENTS.includes(promo.placement)).map((promo) => promo.placement));
  const inventoryOccupancy = pct(activePlacements.size, SELLABLE_PLACEMENTS.length);
  const realizedCpm = totalImpressions > 0 ? (totalRevenueCents / 100 / totalImpressions) * 1000 : 0;

  return (
    <main className="admin-page">
      <div className="admin-page-head">
        <div>
          <p className="page-kicker">MONETIZACIÓN · ÚLTIMOS 30 DÍAS</p>
          <h1>Reporte de sponsors</h1>
          <p className="muted">Impresiones, clics, CTR, sesiones, revenue, ocupación de inventario y portal privado por campaña.</p>
        </div>
        <div className="admin-item-actions">
          <Link className="button secondary" href="/admin/promotions">Gestionar campañas</Link>
          <a className="button secondary" href="/api/admin/promotions/report?format=csv">Exportar CSV</a>
          <Link className="button secondary" href="/publicidad">Landing comercial</Link>
        </div>
      </div>

      {(promosResp.error || eventsResp.error) ? (
        <div className="card" style={{ marginBottom: 20 }}>
          <strong>No se pudo cargar parte del reporte.</strong>
          <p className="muted">{promosResp.error?.message ?? eventsResp.error?.message}</p>
        </div>
      ) : null}

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 24 }}>
        <article className="card"><p className="muted">Impresiones</p><h2>{totalImpressions.toLocaleString()}</h2></article>
        <article className="card"><p className="muted">Clics</p><h2>{totalClicks.toLocaleString()}</h2></article>
        <article className="card"><p className="muted">CTR global</p><h2>{pct(totalClicks, totalImpressions)}</h2></article>
        <article className="card"><p className="muted">Sesiones</p><h2>{totalSessions.toLocaleString()}</h2></article>
        <article className="card"><p className="muted">Revenue contratado</p><h2>{money(totalRevenueCents)}</h2></article>
        <article className="card"><p className="muted">Ocupación inventario</p><h2>{inventoryOccupancy}</h2><small className="muted">{activePlacements.size}/{SELLABLE_PLACEMENTS.length} placements con campaña activa</small></article>
        <article className="card"><p className="muted">CPM contractual aprox.</p><h2>${realizedCpm.toFixed(2)}</h2><small className="muted">Revenue contratado / impresiones registradas</small></article>
      </section>

      <section className="card" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1320 }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th style={{ padding: 12 }}>Campaña</th>
              <th style={{ padding: 12 }}>Advertiser</th>
              <th style={{ padding: 12 }}>Estado</th>
              <th style={{ padding: 12 }}>Placement</th>
              <th style={{ padding: 12 }}>Impresiones</th>
              <th style={{ padding: 12 }}>Clics</th>
              <th style={{ padding: 12 }}>CTR</th>
              <th style={{ padding: 12 }}>Sesiones</th>
              <th style={{ padding: 12 }}>Caps</th>
              <th style={{ padding: 12 }}>Revenue</th>
              <th style={{ padding: 12 }}>Periodo</th>
              <th style={{ padding: 12 }}>Sponsor portal</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.promotion.id} style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}>
                <td style={{ padding: 12 }}><strong>{row.promotion.title}</strong><div className="muted" style={{ fontSize: 12 }}>{row.promotion.campaign_id || "Sin campaign ID"} · {row.promotion.creative_id || "Sin creative ID"}</div></td>
                <td style={{ padding: 12 }}>{row.promotion.advertiser || "—"}</td>
                <td style={{ padding: 12 }}>{row.promotion.is_active ? "Activa" : "Inactiva"}</td>
                <td style={{ padding: 12 }}>{Array.from(row.placements).join(", ") || row.promotion.placement}</td>
                <td style={{ padding: 12 }}>{row.impressions.toLocaleString()}</td>
                <td style={{ padding: 12 }}>{row.clicks.toLocaleString()}</td>
                <td style={{ padding: 12 }}>{pct(row.clicks, row.impressions)}</td>
                <td style={{ padding: 12 }}>{row.sessions.size.toLocaleString()}</td>
                <td style={{ padding: 12 }}><small>sesión {row.promotion.frequency_cap ?? "∞"}<br />día {row.promotion.daily_cap ?? "∞"}<br />total {row.promotion.max_impressions ?? "∞"}</small></td>
                <td style={{ padding: 12 }}>{money(Number(row.promotion.revenue_cents ?? 0))}</td>
                <td style={{ padding: 12 }}>{dateLabel(row.promotion.starts_at)} → {dateLabel(row.promotion.ends_at)}</td>
                <td style={{ padding: 12 }}>
                  {row.promotion.report_token ? (
                    <a className="button secondary" href={`/sponsor-report/${row.promotion.report_token}`} target="_blank" rel="noreferrer">Abrir reporte</a>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="muted">Todavía no hay campañas configuradas.</p> : null}
      </section>
    </main>
  );
}
