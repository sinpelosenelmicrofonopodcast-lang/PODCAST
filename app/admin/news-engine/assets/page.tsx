import { requireStaffPageOrRedirect } from "@/lib/adminAuth";
import { supabaseService } from "@/lib/supabaseService";

export default async function AdminNewsEngineAssetsPage() {
  await requireStaffPageOrRedirect("/admin/news-engine/assets", "manage_news");
  const service = supabaseService();

  const { data, error } = await service
    .from("news_assets")
    .select("id, article_id, asset_type, url, created_at")
    .order("created_at", { ascending: false })
    .limit(80);

  return (
    <main>
      <h1 className="section-title">News Engine · Assets</h1>
      <p className="muted">Portadas, memes, quote cards y thumbnails generados.</p>
      {error ? <div className="card"><p className="muted">{error.message}</p></div> : null}
      <div className="grid" style={{ marginTop: 14, gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))" }}>
        {(data ?? []).map((item: any) => (
          <article key={item.id} className="card" style={{ display: "grid", gap: 8 }}>
            <strong>{item.asset_type}</strong>
            <p className="muted" style={{ margin: 0 }}>article: {item.article_id}</p>
            <p className="muted" style={{ margin: 0 }}>{new Date(item.created_at).toLocaleString("es-PR")}</p>
            <a className="muted" href={item.url} target="_blank" rel="noreferrer">Abrir asset</a>
          </article>
        ))}
      </div>
    </main>
  );
}
