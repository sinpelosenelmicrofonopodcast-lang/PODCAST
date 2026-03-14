import Link from "next/link";
import { requireStaffPageOrRedirect } from "@/lib/adminAuth";
import { supabaseService } from "@/lib/supabaseService";
import { NewsEngineRunCron } from "@/components/admin/NewsEngineRunCron";

export default async function AdminNewsEnginePage() {
  await requireStaffPageOrRedirect("/admin/news-engine", "manage_news");
  const service = supabaseService();

  const [kpisRes, articlesRes, socialRes] = await Promise.all([
    service.from("admin_viral_kpis").select("*").limit(1).maybeSingle(),
    service.from("news_articles").select("id", { count: "exact", head: true }),
    service.from("social_publications").select("id", { count: "exact", head: true }).eq("status", "queued")
  ]);

  const kpis = (kpisRes.data as any) ?? null;

  return (
    <main>
      <h1 className="section-title">News Engine Viral OS</h1>
      <p className="muted">Operación editorial automatizada: ingestión, trends, publicación, social y analytics.</p>

      <div className="admin-grid" style={{ marginTop: 18 }}>
        <article className="card"><h3>Total artículos</h3><p className="section-title">{kpis?.total_articles ?? articlesRes.count ?? 0}</p></article>
        <article className="card"><h3>Publicados</h3><p className="section-title">{kpis?.published_articles ?? 0}</p></article>
        <article className="card"><h3>En cola social</h3><p className="section-title">{kpis?.social_queued ?? socialRes.count ?? 0}</p></article>
        <article className="card"><h3>Trends 24h</h3><p className="section-title">{kpis?.trends_24h ?? 0}</p></article>
      </div>

      <div className="grid" style={{ marginTop: 20, gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
        <Link className="card" href="/admin/news-engine/articles"><h3>Artículos</h3><p className="muted">Borrador, rewrite IA, assets, publicar y social queue.</p></Link>
        <Link className="card" href="/admin/news-sources"><h3>Fuentes</h3><p className="muted">RSS/API/trend, prioridad y estado de ingestión.</p></Link>
        <Link className="card" href="/admin/news-engine/trends"><h3>Tendencias</h3><p className="muted">Keywords calientes por región y proveedor.</p></Link>
        <Link className="card" href="/admin/news-engine/assets"><h3>Assets</h3><p className="muted">Generación y revisión de cover/meme/quote/reel thumbnail.</p></Link>
        <Link className="card" href="/admin/news-engine/social"><h3>Distribución social</h3><p className="muted">Cola de publicaciones y resultados por red.</p></Link>
        <Link className="card" href="/admin/news-engine/analytics"><h3>Analytics</h3><p className="muted">Rendimiento, engagement y señales de viralidad.</p></Link>
        <Link className="card" href="/admin/news-engine/settings"><h3>Settings</h3><p className="muted">Pesos de scoring, tono editorial y automatizaciones.</p></Link>
      </div>

      <div style={{ marginTop: 20 }}>
        <NewsEngineRunCron />
      </div>
    </main>
  );
}
