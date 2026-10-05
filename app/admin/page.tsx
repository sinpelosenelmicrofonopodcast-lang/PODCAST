import Link from "next/link";
import type { Route } from "next";
import { AdminSyncYouTube } from "@/components/AdminSyncYouTube";
import { hasAnyPermission, type StaffPermission } from "@/lib/staffPermissions";
import { requireStaffPageOrRedirect } from "@/lib/adminAuth";
import { supabaseService } from "@/lib/supabaseService";

type DashboardCounts = {
  news: number;
  blogs: number;
  events: number;
  promotions: number;
  guestsNew: number;
  users: number;
};

type QuickAction = {
  title: string;
  description: string;
  href: Route;
  label: string;
};

type AttentionItem = {
  label: string;
  value: number;
  helper: string;
  href: Route;
  tone: "danger" | "warning" | "neutral";
};

function QuickActionCard({ action }: { action: QuickAction }) {
  return (
    <Link className="dashboard-action" href={action.href}>
      <span className="dashboard-action-copy">
        <strong>{action.title}</strong>
        <span>{action.description}</span>
      </span>
      <span className="dashboard-action-cta">{action.label} →</span>
    </Link>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="dashboard-metric">
      <span>{label}</span>
      <strong>{value.toLocaleString("es-PR")}</strong>
    </div>
  );
}

export default async function AdminDashboard() {
  const access = await requireStaffPageOrRedirect("/admin");
  const can = (permission: StaffPermission) => hasAnyPermission(access, permission);
  const service = supabaseService();

  const counts: DashboardCounts = {
    news: 0,
    blogs: 0,
    events: 0,
    promotions: 0,
    guestsNew: 0,
    users: 0
  };

  const statusMessages: string[] = [];

  if (can("view_stats")) {
    const [newsR, blogsR, eventsR, promoR, usersR] = await Promise.all([
      service.from("news_items").select("id", { count: "exact", head: true }),
      service.from("blog_posts").select("id", { count: "exact", head: true }),
      service.from("live_events").select("id", { count: "exact", head: true }),
      service.from("promotions").select("id", { count: "exact", head: true }),
      service.from("users").select("id", { count: "exact", head: true })
    ]);

    const error = newsR.error || blogsR.error || eventsR.error || promoR.error || usersR.error;
    if (error) statusMessages.push(`Métricas: ${error.message}`);

    counts.news = newsR.count ?? 0;
    counts.blogs = blogsR.count ?? 0;
    counts.events = eventsR.count ?? 0;
    counts.promotions = promoR.count ?? 0;
    counts.users = usersR.count ?? 0;
  }

  if (can("manage_guest_requests") || can("view_stats")) {
    const guestR = await service.from("guest_requests").select("id", { count: "exact", head: true }).eq("status", "new");
    if (guestR.error) statusMessages.push(`Invitados: ${guestR.error.message}`);
    counts.guestsNew = guestR.count ?? 0;
  }

  const attention: AttentionItem[] = [];
  if (can("manage_guest_requests") && counts.guestsNew > 0) {
    attention.push({
      label: "Solicitudes de invitados",
      value: counts.guestsNew,
      helper: "Hay personas nuevas esperando clasificación.",
      href: "/admin/guest-requests",
      tone: "warning"
    });
  }

  const quickActions: QuickAction[] = [
    {
      title: "Publicar ahora",
      description: "Publica contenido existente en redes sin programarlo desde la web.",
      href: "/admin/social",
      label: "Abrir"
    }
  ];

  if (can("manage_news")) {
    quickActions.push(
      {
        title: "Noticias",
        description: "Revisa y administra noticias que ya existen en el sitio.",
        href: "/admin/news",
        label: "Gestionar"
      },
      {
        title: "Episodios",
        description: "Administra el catálogo y publica episodios cuando haga falta.",
        href: "/admin/episodes",
        label: "Gestionar"
      }
    );
  }
  if (can("manage_blog")) {
    quickActions.push({
      title: "Editoriales",
      description: "Trabaja piezas largas y contenido de Desde el Micrófono.",
      href: "/admin/blog",
      label: "Abrir"
    });
  }
  if (can("manage_guest_requests")) {
    quickActions.push({
      title: "Invitados",
      description: "Clasifica solicitudes y mueve cada contacto al próximo paso.",
      href: "/admin/guest-requests",
      label: "Revisar"
    });
  }

  return (
    <section className="admin-dashboard admin-dashboard-v2">
      <header className="dashboard-command">
        <div>
          <p className="page-kicker">Cabina de operaciones</p>
          <h1>Dashboard</h1>
          <p className="muted">Administración y revisión. La generación, ingesta y programación se manejan fuera del panel.</p>
        </div>
        <div className="dashboard-command-meta">
          <span className="dashboard-role">{access.isAdmin ? "Administrador" : "Staff"}</span>
          {!access.isAdmin ? <span>{access.permissions.length} permisos activos</span> : <span>Acceso completo</span>}
        </div>
      </header>

      {statusMessages.length > 0 ? (
        <div className="dashboard-notice" role="status">
          <strong>Hay datos que no pudieron cargar.</strong>
          <span>{statusMessages.join(" · ")}</span>
        </div>
      ) : null}

      <div className="dashboard-priority-grid">
        <section className="dashboard-panel dashboard-attention-panel" aria-labelledby="dashboard-attention-title">
          <div className="dashboard-panel-head">
            <div>
              <p className="page-kicker">Prioridad</p>
              <h2 id="dashboard-attention-title">Necesita atención</h2>
            </div>
            <span className="dashboard-panel-count">{attention.length}</span>
          </div>

          <div className="dashboard-attention-list">
            {attention.length > 0 ? (
              attention.map((item) => (
                <Link key={`${item.label}-${item.tone}`} className={`dashboard-attention-item ${item.tone}`} href={item.href}>
                  <strong>{item.value}</strong>
                  <span>
                    <b>{item.label}</b>
                    <small>{item.helper}</small>
                  </span>
                  <em>Revisar →</em>
                </Link>
              ))
            ) : (
              <div className="dashboard-clear-state">
                <strong>Sin pendientes urgentes.</strong>
                <span>El panel no muestra colas de programación ni tareas de ingesta.</span>
              </div>
            )}
          </div>
        </section>

        <section className="dashboard-panel" aria-labelledby="dashboard-actions-title">
          <div className="dashboard-panel-head">
            <div>
              <p className="page-kicker">Trabajo diario</p>
              <h2 id="dashboard-actions-title">Acciones rápidas</h2>
            </div>
          </div>
          <div className="dashboard-action-list">
            {quickActions.slice(0, 4).map((action) => (
              <QuickActionCard key={action.href} action={action} />
            ))}
          </div>
        </section>
      </div>

      {can("view_stats") ? (
        <section className="dashboard-panel dashboard-metrics-panel" aria-labelledby="dashboard-metrics-title">
          <div className="dashboard-panel-head dashboard-panel-head-inline">
            <div>
              <p className="page-kicker">Pulso del sitio</p>
              <h2 id="dashboard-metrics-title">Contenido y audiencia</h2>
            </div>
            <Link className="dashboard-text-link" href="/admin/stats">
              Ver estadísticas →
            </Link>
          </div>
          <div className="dashboard-metrics-grid">
            <Metric label="Noticias" value={counts.news} />
            <Metric label="Editoriales" value={counts.blogs} />
            <Metric label="Eventos" value={counts.events} />
            <Metric label="Promociones" value={counts.promotions} />
            <Metric label="Usuarios" value={counts.users} />
          </div>
        </section>
      ) : null}

      {access.isAdmin ? (
        <section className="dashboard-integration" aria-labelledby="dashboard-integration-title">
          <div className="dashboard-section-intro">
            <div>
              <p className="page-kicker">Integraciones</p>
              <h2 id="dashboard-integration-title">Mantenimiento manual</h2>
              <p className="muted">Solo acciones directas de mantenimiento. Sin generadores, ingesta ni programación de contenido.</p>
            </div>
          </div>
          <div className="dashboard-integration-grid">
            <AdminSyncYouTube />
          </div>
        </section>
      ) : null}

      {!access.isAdmin && access.permissions.length === 0 ? (
        <div className="dashboard-notice">
          <strong>Tu cuenta todavía no tiene permisos asignados.</strong>
          <span>Un administrador debe habilitar las áreas que vas a operar.</span>
        </div>
      ) : null}
    </section>
  );
}
