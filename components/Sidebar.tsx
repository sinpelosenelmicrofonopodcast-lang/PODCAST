"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { hasAnyPermission, type StaffPermission } from "@/lib/staffPermissions";
import type { Route } from "next";

type LinkItem = {
  href: Route;
  label: string;
  section: "overview" | "content" | "growth" | "admin";
  required?: StaffPermission;
  adminOnly?: boolean;
};

type AccessState = {
  isAdmin: boolean;
  permissions: StaffPermission[];
};

const links: LinkItem[] = [
  { href: "/admin", label: "Dashboard", section: "overview" },
  { href: "/admin/social", label: "Social Hub", section: "overview" },
  { href: "/admin/home", label: "Home", section: "overview", required: "manage_home" },
  { href: "/admin/stats", label: "Estadísticas", section: "overview", required: "view_stats" },
  { href: "/admin/reports", label: "Reportes", section: "overview", required: "view_reports" },
  { href: "/admin/schedule", label: "Programación", section: "overview", required: "view_schedule" },
  { href: "/admin/news", label: "Noticias", section: "content", required: "manage_news" },
  { href: "/admin/news-engine", label: "News Engine", section: "content", required: "manage_news" },
  { href: "/admin/news-sources", label: "Fuentes RSS", section: "content", required: "manage_news_sources" },
  { href: "/admin/blog", label: "Blog", section: "content", required: "manage_blog" },
  { href: "/admin/events", label: "Eventos", section: "content", required: "manage_events" },
  { href: "/admin/promotions", label: "Promociones", section: "growth", required: "manage_promotions" },
  { href: "/admin/newsletter", label: "Newsletter", section: "growth", required: "manage_newsletter" },
  { href: "/admin/guest-requests", label: "Invitados", section: "growth", required: "manage_guest_requests" },
  { href: "/admin/confessions", label: "Confesiones", section: "growth", required: "moderate_confessions" },
  { href: "/admin/auto-posts", label: "Auto Posts", section: "admin", adminOnly: true },
  { href: "/admin/social-replies" as Route, label: "Social Replies", section: "admin", adminOnly: true },
  { href: "/admin/facebook-fans", label: "Facebook Fans", section: "admin", adminOnly: true },
  { href: "/admin/mic-brawl", label: "Mic Brawl", section: "admin", adminOnly: true },
  { href: "/admin/users", label: "Usuarios", section: "admin", adminOnly: true }
];

const sectionLabels: Record<LinkItem["section"], string> = {
  overview: "Resumen",
  content: "Contenido",
  growth: "Audiencia",
  admin: "Sistema"
};

function isLinkActive(currentPath: string, href: Route) {
  if (href === "/admin") return currentPath === href;
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export function Sidebar({ access }: { access: AccessState }) {
  const active = usePathname() ?? "";
  const sections = useMemo(
    () =>
      (["overview", "content", "growth", "admin"] as const)
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
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="badge">Admin Core</div>
        <p className="sidebar-copy muted">Operación editorial, comunidad y distribución desde un solo panel.</p>
      </div>
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
    </aside>
  );
}
