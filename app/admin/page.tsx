import Link from "next/link";
import { StatCard } from "@/components/StatCard";
import { AdminSyncYouTube } from "@/components/AdminSyncYouTube";
import { hasAnyPermission, type StaffPermission } from "@/lib/staffPermissions";
import { requireStaffPageOrRedirect } from "@/lib/adminAuth";
import { supabaseService } from "@/lib/supabaseService";

type Counts = {
  news: number;
  blogs: number;
  events: number;
  promotions: number;
  guestsNew: number;
  users: number;
};

export default async function AdminDashboard() {
  const access = await requireStaffPageOrRedirect("/admin");
  const can = (permission: StaffPermission) => hasAnyPermission(access, permission);

  const counts: Counts = {
    news: 0,
    blogs: 0,
    events: 0,
    promotions: 0,
    guestsNew: 0,
    users: 0
  };

  let status: string | null = null;

  if (can("view_stats")) {
    const service = supabaseService();
    const [newsR, blogsR, eventsR, promoR, guestR, usersR] = await Promise.all([
      service.from("news_items").select("id", { count: "exact", head: true }),
      service.from("blog_posts").select("id", { count: "exact", head: true }),
      service.from("live_events").select("id", { count: "exact", head: true }),
      service.from("promotions").select("id", { count: "exact", head: true }),
      service.from("guest_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
      service.from("users").select("id", { count: "exact", head: true })
    ]);

    const error = newsR.error || blogsR.error || eventsR.error || promoR.error || guestR.error || usersR.error;
    if (error) status = error.message;

    counts.news = newsR.count ?? 0;
    counts.blogs = blogsR.count ?? 0;
    counts.events = eventsR.count ?? 0;
    counts.promotions = promoR.count ?? 0;
    counts.guestsNew = guestR.count ?? 0;
    counts.users = usersR.count ?? 0;
  }

  return (
    <main>
      <h1 className="section-title">Panel Admin</h1>
      <p className="muted">Centro de operaciones: homepage, contenido, eventos, promociones y comunidad.</p>
      {status ? (
        <div className="card" style={{ marginTop: 14 }}>
          <p className="muted" style={{ margin: 0 }}>{status}</p>
        </div>
      ) : null}
      <div className="admin-grid" style={{ marginTop: 20 }}>
        <StatCard label="Noticias" value={String(counts.news)} />
        <StatCard label="Blogs" value={String(counts.blogs)} />
        <StatCard label="Eventos" value={String(counts.events)} />
        <StatCard label="Promociones" value={String(counts.promotions)} />
        <StatCard label="Invitados (new)" value={String(counts.guestsNew)} />
        <StatCard label="Usuarios" value={String(counts.users)} />
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", marginTop: 28 }}>
        {can("manage_home") ? (
          <div className="card">
            <h3>Editar Homepage</h3>
            <p className="muted">Texto principal, módulos visibles y estructura editorial del home.</p>
            <Link className="button" href="/admin/home">
              Configurar Home
            </Link>
          </div>
        ) : null}
        {can("manage_events") || can("manage_promotions") ? (
          <div className="card">
            <h3>Eventos y Promociones</h3>
            <p className="muted">Crear eventos en vivo y anuncios de marcas para homepage.</p>
            <div className="admin-item-actions">
              {can("manage_events") ? (
                <Link className="button" href="/admin/events">
                  Gestionar Eventos
                </Link>
              ) : null}
              {can("manage_promotions") ? (
                <Link className="button secondary" href="/admin/promotions">
                  Gestionar Promociones
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
        {can("manage_news") ? (
          <div className="card">
            <h3>Episodios a Facebook</h3>
            <p className="muted">Publica episodios nuevos o viejos con texto propio o extracto automático.</p>
            <a className="button secondary" href="/admin/episodes">
              Gestionar Episodios
            </a>
          </div>
        ) : null}
        {can("manage_guest_requests") ? (
          <div className="card">
            <h3>Invitados al programa</h3>
            <p className="muted">Revisa solicitudes nuevas y mueve estado a contacted/closed.</p>
            <Link className="button secondary" href="/admin/guest-requests">
              Ver solicitudes
            </Link>
          </div>
        ) : null}
        {can("manage_news_sources") || can("view_schedule") ? (
          <div className="card">
            <h3>Fuentes RSS</h3>
            <p className="muted">Controla fuentes automáticas, región, categorías y frecuencia de escaneo.</p>
            <div className="admin-item-actions">
              {can("manage_news_sources") ? (
                <Link className="button" href="/admin/news-sources">
                  Gestionar fuentes
                </Link>
              ) : null}
              {can("view_schedule") ? (
                <Link className="button secondary" href="/admin/schedule">
                  Ver cola
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
        {can("manage_news") ? (
          <div className="card">
            <h3>News Engine Viral OS</h3>
            <p className="muted">Pipeline de ingestión, tendencias, assets, social queue y analytics viral.</p>
            <Link className="button secondary" href="/admin/news-engine">
              Abrir News Engine
            </Link>
          </div>
        ) : null}
        {can("manage_news_sources") ? <AdminSyncYouTube /> : null}
        {can("view_stats") ? (
          <div className="card">
            <h3>SEO Autopilot</h3>
            <p className="muted">Sitemaps, auditoría técnica y rendimiento en Search Console.</p>
            <a className="button secondary" href="/admin/seo">
              Abrir SEO Dashboard
            </a>
          </div>
        ) : null}
        {access.isAdmin ? (
          <div className="card">
            <h3>Facebook Fans Activos</h3>
            <p className="muted">CRM interno de comentaristas y reacciones para detectar superfans activos.</p>
            <Link className="button secondary" href="/admin/facebook-fans">
              Abrir módulo
            </Link>
          </div>
        ) : null}
        {access.isAdmin ? (
          <div className="card">
            <h3>SPM Arcade / Mic Brawl</h3>
            <p className="muted">Monitorea salas activas, leaderboard, resets y skins del juego.</p>
            <Link className="button secondary" href="/admin/mic-brawl">
              Abrir Mic Brawl Admin
            </Link>
          </div>
        ) : null}
      </div>
      {!access.isAdmin && access.permissions.length === 0 ? (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="muted" style={{ margin: 0 }}>
            Tu cuenta no tiene permisos asignados todavía. Un admin debe habilitar secciones desde Admin / Usuarios.
          </p>
        </div>
      ) : null}
    </main>
  );
}
