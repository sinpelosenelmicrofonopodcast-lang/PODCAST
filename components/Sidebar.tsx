"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { hasAnyPermission, type StaffPermission } from "@/lib/staffPermissions";
import type { Route } from "next";

type LinkItem = {
  href: Route;
  label: string;
  required?: StaffPermission;
  adminOnly?: boolean;
};

type AccessState = {
  isAdmin: boolean;
  permissions: StaffPermission[];
};

const links: LinkItem[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/home", label: "Home", required: "manage_home" },
  { href: "/admin/stats", label: "Estadísticas", required: "view_stats" },
  { href: "/admin/content", label: "Contenido", required: "manage_home" },
  { href: "/admin/news", label: "Noticias", required: "manage_news" },
  { href: "/admin/news-sources", label: "Fuentes RSS", required: "manage_news_sources" },
  { href: "/admin/blog", label: "Blog", required: "manage_blog" },
  { href: "/admin/events", label: "Eventos", required: "manage_events" },
  { href: "/admin/promotions", label: "Promociones", required: "manage_promotions" },
  { href: "/admin/newsletter", label: "Newsletter", required: "manage_newsletter" },
  { href: "/admin/guest-requests", label: "Invitados", required: "manage_guest_requests" },
  { href: "/admin/auto-posts", label: "Auto Posts", adminOnly: true },
  { href: "/admin/facebook-fans", label: "Facebook Fans", adminOnly: true },
  { href: "/admin/mic-brawl", label: "Mic Brawl", adminOnly: true },
  { href: "/admin/users", label: "Usuarios", adminOnly: true },
  { href: "/admin/reports", label: "Reportes", required: "view_reports" },
  { href: "/admin/schedule", label: "Programación", required: "view_schedule" }
];

async function loadAccess(): Promise<AccessState> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token ?? "";
  if (!token) return { isAdmin: false, permissions: [] };
  const res = await fetch("/api/admin/me", { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
  if (!res?.ok) return { isAdmin: false, permissions: [] };
  const json = await res.json().catch(() => ({}));
  return {
    isAdmin: Boolean(json?.isAdmin),
    permissions: Array.isArray(json?.permissions) ? (json.permissions as StaffPermission[]) : []
  };
}

export function Sidebar({ active }: { active: string }) {
  const [access, setAccess] = useState<AccessState>({ isAdmin: false, permissions: [] });

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      const next = await loadAccess();
      if (!mounted) return;
      setAccess(next);
    };
    run();
    return () => {
      mounted = false;
    };
  }, []);

  const visibleLinks = useMemo(
    () =>
      links.filter((link) => {
        if (link.adminOnly) return access.isAdmin;
        if (!link.required) return true;
        return hasAnyPermission(access, link.required);
      }),
    [access]
  );

  return (
    <aside className="sidebar">
      <div className="badge" style={{ marginBottom: 18 }}>
        Admin Core
      </div>
      {visibleLinks.map((link) => (
        <Link key={link.href} href={link.href} className={active === link.href ? "active" : undefined}>
          {link.label}
        </Link>
      ))}
    </aside>
  );
}
