import { requireStaffPageOrRedirect } from "@/lib/adminAuth";
import { supabaseService } from "@/lib/supabaseService";
import { getGscPerformance } from "@/lib/seo/gsc";
import { seoQueueStats } from "@/lib/seo/queue";
import { getPublishedEpisodes, getPublishedEvents, getPublishedPosts } from "@/lib/seo/content";
import { PUBLIC_CORE_PAGES } from "@/lib/seo/constants";

export const dynamic = "force-dynamic";

function fmtNum(value: number) {
  return Intl.NumberFormat("es-PR", { maximumFractionDigits: 2 }).format(value);
}

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

export default async function AdminSeoPage() {
  await requireStaffPageOrRedirect("/admin/seo", "view_stats");
  const service = supabaseService();

  const [posts, episodes, events, queueStats, queueRowsRes, auditRowsRes, gsc] = await Promise.all([
    getPublishedPosts(1000),
    getPublishedEpisodes(1000),
    getPublishedEvents(1000),
    seoQueueStats(),
    service
      .from("seo_queue")
      .select("id, url, type, status, attempts, last_error, updated_at")
      .order("updated_at", { ascending: false })
      .limit(80),
    service
      .from("seo_audit")
      .select("id, url, issue_type, details, created_at")
      .order("created_at", { ascending: false })
      .limit(120),
    getGscPerformance("28d").catch(() => null)
  ]);

  const queueRows = queueRowsRes.data ?? [];
  const auditRows = auditRowsRes.data ?? [];
  const sitemapCount = posts.length + episodes.length + events.length + PUBLIC_CORE_PAGES.length;
  const lastQueueRun = typeof queueRows[0]?.updated_at === "string" ? queueRows[0].updated_at : null;
  const lastAuditRun = typeof auditRows[0]?.created_at === "string" ? auditRows[0].created_at : null;
  const ctrOpportunities = (gsc?.rows ?? [])
    .filter((row) => row.impressions >= 100 && row.ctr <= 0.01)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 20);

  return (
    <main>
      <h1 className="section-title">SEO Autopilot</h1>
      <p className="muted">Sitemaps, cola SEO, auditoría y rendimiento de Search Console.</p>

      <div className="admin-grid" style={{ marginTop: 16 }}>
        <div className="card">
          <strong>Publicados</strong>
          <p className="muted" style={{ margin: "8px 0 0" }}>
            Posts: {posts.length} · Episodios: {episodes.length} · Eventos: {events.length}
          </p>
        </div>
        <div className="card">
          <strong>Cola SEO</strong>
          <p className="muted" style={{ margin: "8px 0 0" }}>
            Pendientes: {queueStats.pending} · Error: {queueStats.error} · Submitted: {queueStats.submitted}
          </p>
        </div>
        <div className="card">
          <strong>Auditoría</strong>
          <p className="muted" style={{ margin: "8px 0 0" }}>
            Issues registradas: {auditRows.length}
          </p>
        </div>
        <div className="card">
          <strong>Sitemaps (URLs)</strong>
          <p className="muted" style={{ margin: "8px 0 0" }}>
            Total indexables: {sitemapCount}
          </p>
        </div>
        <div className="card">
          <strong>GSC (28d)</strong>
          <p className="muted" style={{ margin: "8px 0 0" }}>
            Clicks: {fmtNum(gsc?.summary.clicks ?? 0)} · Impressions: {fmtNum(gsc?.summary.impressions ?? 0)} · CTR:{" "}
            {fmtNum((gsc?.summary.ctr ?? 0) * 100)}% · Position: {fmtNum(gsc?.summary.position ?? 0)}
          </p>
        </div>
        <div className="card">
          <strong>Últimas ejecuciones</strong>
          <p className="muted" style={{ margin: "8px 0 0" }}>
            Cola: {fmtDate(lastQueueRun)} · Auditoría: {fmtDate(lastAuditRun)}
          </p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Acciones rápidas</h3>
        <div className="admin-item-actions">
          <a className="button secondary" href="/sitemap.xml">
            Ver sitemap index
          </a>
          <span className="muted">Usa API POST para: `/api/seo/submit-sitemaps` y `/api/seo/process-queue`.</span>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>CTR opportunities</h3>
        {ctrOpportunities.length === 0 ? <p className="muted">Sin oportunidades detectadas.</p> : null}
        {ctrOpportunities.length > 0 ? (
          <div className="list">
            {ctrOpportunities.map((row) => (
              <div key={row.page} className="card" style={{ padding: 12 }}>
                <strong>{row.page}</strong>
                <div className="muted" style={{ fontSize: 13 }}>
                  {fmtNum(row.impressions)} impresiones · {fmtNum(row.clicks)} clicks · CTR {fmtNum(row.ctr * 100)}%
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>seo_queue</h3>
        {queueRows.length === 0 ? <p className="muted">Sin datos.</p> : null}
        {queueRows.length > 0 ? (
          <div className="list">
            {queueRows.map((row: any) => (
              <div key={row.id} className="card" style={{ padding: 12 }}>
                <strong>{row.url}</strong>
                <div className="muted" style={{ fontSize: 13 }}>
                  {row.type} · {row.status} · attempts {row.attempts}
                </div>
                {row.last_error ? (
                  <p className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                    {row.last_error}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>seo_audit</h3>
        {auditRows.length === 0 ? <p className="muted">Sin issues.</p> : null}
        {auditRows.length > 0 ? (
          <div className="list">
            {auditRows.map((row: any) => (
              <div key={row.id} className="card" style={{ padding: 12 }}>
                <strong>{row.issue_type}</strong>
                <div className="muted" style={{ fontSize: 12 }}>
                  {row.url}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </main>
  );
}
