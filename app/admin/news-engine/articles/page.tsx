import { requireStaffPageOrRedirect } from "@/lib/adminAuth";
import { supabaseService } from "@/lib/supabaseService";
import { NewsEngineArticleActions } from "@/components/admin/NewsEngineArticleActions";

function fmtDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-PR");
}

export default async function AdminNewsEngineArticlesPage() {
  await requireStaffPageOrRedirect("/admin/news-engine/articles", "manage_news");
  const service = supabaseService();

  const { data, error } = await service
    .from("news_articles")
    .select("id, title, slug, status, category, region, published_at, publish_at, trending_score, discover_score")
    .order("created_at", { ascending: false })
    .limit(40);

  return (
    <main>
      <h1 className="section-title">News Engine · Artículos</h1>
      <p className="muted">Control editorial con acciones rápidas (IA/assets/publicación/social).</p>

      {error ? <div className="card"><p className="muted">{error.message}</p></div> : null}

      <div className="list" style={{ marginTop: 14 }}>
        {(data ?? []).map((item: any) => (
          <article key={item.id} className="card" style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <strong>{item.title}</strong>
              <span className="news-badge">{item.status}</span>
            </div>
            <p className="muted" style={{ margin: 0 }}>
              /noticias/{item.slug} · {item.category ?? "—"} · {item.region ?? "—"}
            </p>
            <p className="muted" style={{ margin: 0 }}>
              Publish at: {fmtDate(item.publish_at)} · Published: {fmtDate(item.published_at)} · Trend: {Number(item.trending_score ?? 0).toFixed(2)} · Discover: {Number(item.discover_score ?? 0).toFixed(2)}
            </p>
            <NewsEngineArticleActions articleId={item.id} />
          </article>
        ))}
      </div>
    </main>
  );
}
