import { requireStaffPageOrRedirect } from "@/lib/adminAuth";
import { supabaseService } from "@/lib/supabaseService";

export default async function AdminNewsEngineAnalyticsPage() {
  await requireStaffPageOrRedirect("/admin/news-engine/analytics", "view_stats");
  const service = supabaseService();

  const [topViews, topEngagement, byRegion] = await Promise.all([
    service
      .from("trending_metrics")
      .select("article_id, views, shares, comments, updated_at")
      .order("views", { ascending: false })
      .limit(20),
    service
      .from("news_articles")
      .select("id, title, region, engagement_score, trending_score, discover_score")
      .eq("status", "published")
      .order("engagement_score", { ascending: false })
      .limit(20),
    service
      .from("news_articles")
      .select("id, region")
      .eq("status", "published")
      .limit(500)
  ]);

  const regionCounts = new Map<string, number>();
  (byRegion.data ?? []).forEach((row: any) => {
    const key = String(row.region ?? "Mundo");
    regionCounts.set(key, (regionCounts.get(key) ?? 0) + 1);
  });

  return (
    <main>
      <h1 className="section-title">News Engine · Analytics</h1>
      <p className="muted">Top por views, top por engagement y distribución regional.</p>

      <section className="card" style={{ marginTop: 14 }}>
        <h3 style={{ marginTop: 0 }}>Top métricas (views/shares/comments)</h3>
        <div className="list">
          {(topViews.data ?? []).map((row: any) => (
            <div key={row.article_id} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span className="muted">{row.article_id}</span>
              <strong>V:{row.views} · S:{row.shares} · C:{row.comments}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginTop: 14 }}>
        <h3 style={{ marginTop: 0 }}>Top engagement</h3>
        <div className="list">
          {(topEngagement.data ?? []).map((row: any) => (
            <div key={row.id} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span className="muted clamp-1">{row.title}</span>
              <strong>{Number(row.engagement_score ?? 0).toFixed(2)}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginTop: 14 }}>
        <h3 style={{ marginTop: 0 }}>Tendencias por región</h3>
        <div className="list">
          {Array.from(regionCounts.entries()).map(([region, count]) => (
            <div key={region} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span>{region}</span>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
