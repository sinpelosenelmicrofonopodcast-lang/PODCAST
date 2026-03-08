import { requireStaffPageOrRedirect } from "@/lib/adminAuth";
import { supabaseService } from "@/lib/supabaseService";

export default async function AdminNewsEngineTrendsPage() {
  await requireStaffPageOrRedirect("/admin/news-engine/trends", "manage_news_sources");
  const service = supabaseService();

  const { data, error } = await service
    .from("trend_snapshots")
    .select("id, source, keyword, region, score, created_at")
    .order("created_at", { ascending: false })
    .limit(150);

  return (
    <main>
      <h1 className="section-title">News Engine · Trends</h1>
      <p className="muted">Señales agregadas desde Google Trends, X (si disponible) e interacción interna.</p>
      {error ? <div className="card"><p className="muted">{error.message}</p></div> : null}
      <div className="list" style={{ marginTop: 14 }}>
        {(data ?? []).map((item: any) => (
          <article key={item.id} className="card" style={{ display: "grid", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <strong>{item.keyword}</strong>
              <span className="news-badge">{Number(item.score ?? 0).toFixed(1)}</span>
            </div>
            <p className="muted" style={{ margin: 0 }}>{item.source} · {item.region ?? "global"} · {new Date(item.created_at).toLocaleString("es-PR")}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
