import Link from "next/link";
import type { Route } from "next";
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

type ModuleCardProps = {
  title: string;
  description: string;
  primaryHref?: Route;
  primaryLabel?: string;
  secondaryHref?: Route;
  secondaryLabel?: string;
};

function ModuleCard({ title, description, primaryHref, primaryLabel, secondaryHref, secondaryLabel }: ModuleCardProps) {
  return (
    <div className="card dashboard-module-card">
      <div className="dashboard-module-copy">
        <h3>{title}</h3>
        <p className="muted">{description}</p>
      </div>
      <div className="admin-item-actions">
        {primaryHref && primaryLabel ? (
          <Link className="button" href={primaryHref}>
            {primaryLabel}
          </Link>
        ) : null}
        {secondaryHref && secondaryLabel ? (
          <Link className="button secondary" href={secondaryHref}>
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

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

  const editorialModules: ModuleCardProps[] = [];
  if (can("manage_home")) {
    editorialModules.push({
      title: "Editar homepage",
      description: "Ajusta jerarquía editorial, módulos visibles y mensaje principal del home.",
      primaryHref: "/admin/home",
      primaryLabel: "Configurar home"
    });
  }
  if (can("manage_news")) {
    editorialModules.push({
      title: "Noticias y News Engine",
      description: "Gestiona publicaciones, pipeline editorial, assets y distribución social desde un mismo flujo.",
      primaryHref: "/admin/news",
      primaryLabel: "Gestionar noticias",
      secondaryHref: "/admin/news-engine",
      secondaryLabel: "Abrir News Engine"
    });
    editorialModules.push({
      title: "Episodios a Facebook",
      description: "Publica episodios nuevos o de catálogo con copy propio o extracto automático.",
      primaryHref: "/admin/episodes",
      primaryLabel: "Gestionar episodios"
    });
  }
  if (can("manage_blog")) {
    editorialModules.push({
      title: "Blog",
      description: "Administra piezas largas, linking editorial y presencia en buscadores.",
      primaryHref: "/admin/blog",
      primaryLabel: "Abrir blog"
    });
  }
  if (can("manage_events") || can("manage_promotions")) {
    editorialModules.push({
      title: "Eventos y promociones",
      description: "Coordina agenda en vivo y espacios comerciales sin duplicar esfuerzos.",
      primaryHref: can("manage_events") ? "/admin/events" : "/admin/promotions",
      primaryLabel: can("manage_events") ? "Gestionar eventos" : "Gestionar promociones",
      secondaryHref: can("manage_events") && can("manage_promotions") ? "/admin/promotions" : undefined,
      secondaryLabel: can("manage_events") && can("manage_promotions") ? "Promociones" : undefined
    });
  }
  if (can("manage_guest_requests")) {
    editorialModules.push({
      title: "Invitados al programa",
      description: "Revisa solicitudes nuevas, clasifica leads y mueve cada caso por estado.",
      primaryHref: "/admin/guest-requests",
      primaryLabel: "Ver solicitudes"
    });
  }

  const operationsModules: ModuleCardProps[] = [];
  if (can("manage_news_sources") || can("view_schedule")) {
    operationsModules.push({
      title: "Fuentes RSS y programación",
      description: "Controla fuentes, frecuencia de ingesta y la cola de ejecución operativa.",
      primaryHref: can("manage_news_sources") ? "/admin/news-sources" : "/admin/schedule",
      primaryLabel: can("manage_news_sources") ? "Gestionar fuentes" : "Ver cola",
      secondaryHref: can("manage_news_sources") && can("view_schedule") ? "/admin/schedule" : undefined,
      secondaryLabel: can("manage_news_sources") && can("view_schedule") ? "Ver cola" : undefined
    });
  }
  if (can("view_stats")) {
    operationsModules.push({
      title: "SEO y métricas",
      description: "Supervisa rendimiento técnico, visibilidad orgánica y señales de tráfico del sitio.",
      primaryHref: "/admin/seo",
      primaryLabel: "Abrir SEO",
      secondaryHref: "/admin/stats",
      secondaryLabel: "Ver estadísticas"
    });
  }
  if (access.isAdmin) {
    operationsModules.push(
      {
        title: "Facebook Fans Activos",
        description: "Detecta superfans y relaciones de mayor valor con señales sociales reales.",
        primaryHref: "/admin/facebook-fans",
        primaryLabel: "Abrir módulo"
      },
      {
        title: "Mic Brawl",
        description: "Monitorea salas, resets, skins y ranking del juego sin salir del admin.",
        primaryHref: "/admin/mic-brawl",
        primaryLabel: "Abrir Mic Brawl"
      }
    );
  }

  return (
    <section className="admin-dashboard">
      <div className="card dashboard-hero">
        <div className="dashboard-hero-copy">
          <p className="page-kicker">Resumen operativo</p>
          <h2 className="section-title">Panel Admin</h2>
          <p className="muted">
            Centro de operaciones para contenido, distribución, audiencia y comunidad con acceso controlado por rol.
          </p>
        </div>
        <div className="dashboard-hero-meta">
          <span>{access.isAdmin ? "Administrador" : "Staff"}</span>
          <span>{access.permissions.length} permisos activos</span>
        </div>
      </div>

      {status ? (
        <div className="card state-card compact">
          <p className="muted">{status}</p>
        </div>
      ) : null}

      <div className="admin-grid dashboard-stats">
        <StatCard label="Noticias" value={String(counts.news)} />
        <StatCard label="Blogs" value={String(counts.blogs)} />
        <StatCard label="Eventos" value={String(counts.events)} />
        <StatCard label="Promociones" value={String(counts.promotions)} />
        <StatCard label="Solicitudes nuevas" value={String(counts.guestsNew)} />
        <StatCard label="Usuarios" value={String(counts.users)} />
      </div>

      {editorialModules.length > 0 ? (
        <div className="dashboard-section">
          <div className="dashboard-section-head">
            <h3>Edición y producto</h3>
            <p className="muted">Las pantallas críticas para operar portada, contenido y programación editorial.</p>
          </div>
          <div className="dashboard-module-grid">
            {editorialModules.map((module) => (
              <ModuleCard key={module.title} {...module} />
            ))}
          </div>
        </div>
      ) : null}

      <div className="dashboard-section">
        <div className="dashboard-section-head">
          <h3>Operación y distribución</h3>
          <p className="muted">Automatizaciones, fuentes, analítica y mantenimiento del ecosistema.</p>
        </div>
        <div className="dashboard-module-grid">
          {operationsModules.map((module) => (
            <ModuleCard key={module.title} {...module} />
          ))}
          {can("manage_news_sources") ? <AdminSyncYouTube /> : null}
        </div>
      </div>

      {!access.isAdmin && access.permissions.length === 0 ? (
        <div className="card state-card">
          <p className="muted">
            Tu cuenta no tiene permisos asignados todavía. Un administrador debe habilitar secciones desde Usuarios.
          </p>
        </div>
      ) : null}
    </section>
  );
}
