import { requireStaffPageOrRedirect } from "@/lib/adminAuth";
import { supabaseService } from "@/lib/supabaseService";
import { SocialQueueRunner } from "@/components/admin/SocialQueueRunner";

export default async function AdminNewsEngineSocialPage() {
  await requireStaffPageOrRedirect("/admin/news-engine/social", "manage_news");
  const service = supabaseService();

  const { data, error } = await service
    .from("social_publications")
    .select("id, article_id, platform, status, external_id, created_at, published_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <main>
      <h1 className="section-title">News Engine · Social Queue</h1>
      <p className="muted">Estado de distribución en Facebook/X/Instagram/TikTok.</p>
      <div style={{ marginTop: 12 }}><SocialQueueRunner /></div>

      {error ? <div className="card"><p className="muted">{error.message}</p></div> : null}

      <div className="list" style={{ marginTop: 14 }}>
        {(data ?? []).map((item: any) => (
          <article key={item.id} className="card" style={{ display: "grid", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <strong>{item.platform}</strong>
              <span className="news-badge">{item.status}</span>
            </div>
            <p className="muted" style={{ margin: 0 }}>article: {item.article_id}</p>
            <p className="muted" style={{ margin: 0 }}>external: {item.external_id ?? "—"}</p>
            <p className="muted" style={{ margin: 0 }}>
              created: {new Date(item.created_at).toLocaleString("es-PR")} · published: {item.published_at ? new Date(item.published_at).toLocaleString("es-PR") : "—"}
            </p>
          </article>
        ))}
      </div>
    </main>
  );
}
