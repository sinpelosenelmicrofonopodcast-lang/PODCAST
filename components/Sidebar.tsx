"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { hasAnyPermission, type StaffPermission } from "@/lib/staffPermissions";
import type { Route } from "next";

type Section = "workspace" | "publish" | "audience" | "insights" | "system";

type LinkItem = {
  href: Route;
  label: string;
  section: Section;
  required?: StaffPermission;
  adminOnly?: boolean;
};

type AccessState = {
  isAdmin: boolean;
  permissions: StaffPermission[];
};

const links: LinkItem[] = [
  { href: "/admin", label: "Dashboard", section: "workspace" },
  { href: "/admin/social", label: "Publicar ahora", section: "workspace" },

  { href: "/admin/home", label: "Homepage", section: "publish", required: "manage_home" },
  { href: "/admin/news", label: "Noticias", section: "publish", required: "manage_news" },
  { href: "/admin/episodes", label: "Episodios", section: "publish", required: "manage_news" },
  { href: "/admin/blog", label: "Editoriales", section: "publish", required: "manage_blog" },
  { href: "/admin/editorial-engine" as Route, label: "Podcast Editorial", section: "publish", required: "manage_news" },
  { href: "/admin/events", label: "Eventos", section: "publish", required: "manage_events" },
  { href: "/admin/event-board" as Route, label: "Aprobar eventos y cobros", section: "publish", required: "manage_events" },

  { href: "/admin/promotions", label: "Promociones", section: "audience", required: "manage_promotions" },
  { href: "/admin/ad-requests" as Route, label: "Leads patrocinio", section: "audience", required: "manage_promotions" },
  { href: "/admin/business-inquiries" as Route, label: "Cotizaciones Prime Cut", section: "audience", required: "manage_promotions" },
  { href: "/admin/sponsor-prospects" as Route, label: "Prospectos comerciales", section: "audience", required: "manage_promotions" },
  { href: "/admin/newsletter-sponsor" as Route, label: "Newsletter patrocinable", section: "audience", required: "manage_newsletter" },
  { href: "/admin/newsletter", label: "Newsletter", section: "audience", required: "manage_newsletter" },
  { href: "/admin/guest-requests", label: "Invitados", section: "audience", required: "manage_guest_requests" },
  { href: "/admin/confessions", label: "Confesiones", section: "audience", required: "moderate_confessions" },

  { href: "/admin/stats", label: "Estadísticas", section: "insights", required: "view_stats" },
  { href: "/admin/reports", label: "Reportes", section: "insights", required: "view_reports" },
  { href: "/admin/seo", label: "SEO", section: "insights", required: "view_stats" },

  { href: "/admin/editorial-drive" as Route, label: "Editorial · Drive", section: "system", adminOnly: true },
  { href: "/admin/social-replies" as Route, label: "Social Replies", section: "system", adminOnly: true },
  { href: "/admin/facebook-fans", label: "Facebook Fans", section: "system", adminOnly: true },
  { href: "/admin/mic-brawl", label: "Mic Brawl", section: "system", adminOnly: true },
  { href: "/admin/users", label: "Usuarios", section: "system", adminOnly: true }
];

const sectionLabels: Record<Section, string> = {
  workspace: "Trabajo diario",
  publish: "Publicación",
  audience: "Audiencia",
  insights: "Medición",
  system: "Sistema"
};

function isLinkActive(currentPath: string, href: Route) {
  if (href === "/admin") return currentPath === href;
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export function Sidebar({ access }: { access: AccessState }) {
  const active = usePathname() ?? "";
  const sections = useMemo(
    () =>
      (["workspace", "publish", "audience", "insights", "system"] as const)
        .map((section) => ({
          section,
          items: links.filter((link) => {
            if (link.section !== section) return false;
            if (link.adminOnly) return access.isAdmin;
            if (!link.required) return true;
            return hasAnyPermission(access, link.required);
          })
        }))
        .filter((group) => group.items.length > 0),
    [access]
  );

  return (
    <aside className="sidebar admin-sidebar">
      <div className="sidebar-brand">
        <div className="badge">SPM Editorial OS</div>
        <div className="sidebar-role-row">
          <strong>{access.isAdmin ? "Administrador" : "Staff"}</strong>
          <span>{access.isAdmin ? "Acceso completo" : `${access.permissions.length} permisos`}</span>
        </div>
      </div>

      <nav className="admin-sidebar-nav" aria-label="Navegación del panel administrativo">
        {sections.map((group) => (
          <div key={group.section} className="sidebar-section">
            <p className="sidebar-heading">{sectionLabels[group.section]}</p>
            <div className="sidebar-links">
              {group.items.map((link) => (
                <Link key={link.href} href={link.href} className={isLinkActive(active, link.href) ? "active" : undefined}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="admin-sidebar-footer">
        <Link className="button secondary" href="/">
          Ver sitio público
        </Link>
      </div>
    </aside>
  );
}
