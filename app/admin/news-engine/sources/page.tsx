import Link from "next/link";
import { requireStaffPageOrRedirect } from "@/lib/adminAuth";
import { supabaseService } from "@/lib/supabaseService";

export default async function AdminNewsEngineSourcesPage() {
  await requireStaffPageOrRedirect("/admin/news-engine/sources", "manage_news_sources");
  const service = supabaseService();

  const { data, error } = await service
    .from("news_sources")
    .select("id, name, type, region, category, active, is_active, priority, trust_score, rss_url, api_url, last_checked_at, updated_at")
    .order("priority", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(80);

  return (
    <main>
      <h1 className="section-title">News Engine · Fuentes</h1>
      <p className="muted">Gestión operativa de fuentes RSS/API/trend para la ingesta automática.</p>
      <div className="admin-item-actions" style={{ marginTop: 10 }}>
        <Link className="button secondary" href="/admin/news-sources">Abrir CRUD existente</Link>
      </div>
      {error ? <div className="card"><p className="muted">{error.message}</p></div> : null}
      <div className="list" style={{ marginTop: 14 }}>
        {(data ?? []).map((item: any) => (
          <article key={item.id} className="card" style={{ display: "grid", gap: 6 }}>
            <strong>{item.name}</strong>
            <p className="muted" style={{ margin: 0 }}>
              {item.type ?? "rss"} · región {item.region ?? "—"} · categoría {item.category ?? "—"} · priority {item.priority ?? 0} · trust {item.trust_score ?? 0}
            </p>
            <p className="muted" style={{ margin: 0, wordBreak: "break-all" }}>{item.rss_url ?? item.api_url ?? "—"}</p>
            <p className="muted" style={{ margin: 0 }}>Último check: {item.last_checked_at ? new Date(item.last_checked_at).toLocaleString("es-PR") : "—"}</p>
            <span className="news-badge">{item.active ?? item.is_active ? "ACTIVA" : "INACTIVA"}</span>
          </article>
        ))}
      </div>
    </main>
  );
}
