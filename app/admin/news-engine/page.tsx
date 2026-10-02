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

  const draftsRes = await service
    .from("news_articles")
    .select("id", { count: "exact", head: true })
    .in("status", ["draft", "pending_review"]);

  const kpis = (kpisRes.data as any) ?? null;

  return (
    <main>
      <div className="editorial-live-badge"><span /> MODO EDITORIAL MANUAL</div>
      <h1 className="section-title">SPM Newsroom</h1>
      <p className="muted">
        Descubre, ingiere, puntúa y prepara historias. Nada de este panel se considera aprobado por el agente: la decisión final es humana.
      </p>

      <div className="admin-grid" style={{ marginTop: 18 }}>
        <article className="card"><h3>Total artículos</h3><p className="section-title">{kpis?.total_articles ?? articlesRes.count ?? 0}</p></article>
        <article className="card"><h3>Esperando editor</h3><p className="section-title">{draftsRes.count ?? 0}</p></article>
        <article className="card"><h3>Publicados</h3><p className="section-title">{kpis?.published_articles ?? 0}</p></article>
        <article className="card"><h3>Cola social</h3><p className="section-title">{kpis?.social_queued ?? socialRes.count ?? 0}</p></article>
        <article className="card"><h3>Señales 24h</h3><p className="section-title">{kpis?.trends_24h ?? 0}</p></article>
      </div>

      <div className="grid" style={{ marginTop: 20, gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
        <Link className="card" href="/admin/editorial-engine"><h3>Editorial Engine</h3><p className="muted">Analiza noticias o transcripts y produce enseñanzas, impacto, drafts, SEO y social.</p></Link>
        <Link className="card" href="/admin/news-engine/articles"><h3>Control de historias</h3><p className="muted">Preview, edición, filtros y decisión editorial.</p></Link>
        <Link className="card" href="/admin/news-sources"><h3>Fuentes</h3><p className="muted">RSS/API/trend, prioridad y estado de ingestión.</p></Link>
        <Link className="card" href="/admin/news-engine/trends"><h3>Tendencias</h3><p className="muted">Keywords y señales calientes por región y proveedor.</p></Link>
        <Link className="card" href="/admin/news-engine/assets"><h3>Assets</h3><p className="muted">Covers, quote cards y piezas visuales para revisión.</p></Link>
        <Link className="card" href="/admin/news-engine/social"><h3>Distribución social</h3><p className="muted">Contenido preparado y resultados por red.</p></Link>
        <Link className="card" href="/admin/news-engine/analytics"><h3>Analytics</h3><p className="muted">Rendimiento, engagement y señales de conversación.</p></Link>
        <Link className="card" href="/admin/news-engine/settings"><h3>Settings</h3><p className="muted">Pesos de scoring, tono editorial y controles del motor.</p></Link>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <p className="page-kicker">Herramientas manuales</p>
        <h3 style={{ marginTop: 4 }}>Correr procesos bajo demanda</h3>
        <p className="muted">Estos controles ejecutan tareas cuando tú las ordenas. No convierten el Editorial Engine en autopublisher.</p>
        <NewsEngineRunCron />
      </div>
    </main>
  );
}
