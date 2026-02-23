import Link from "next/link";
import type { Route } from "next";

const links: Array<{ href: Route; label: string }> = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/home", label: "Home" },
  { href: "/admin/stats", label: "Estadísticas" },
  { href: "/admin/content", label: "Contenido" },
  { href: "/admin/news", label: "Noticias" },
  { href: "/admin/news-sources", label: "Fuentes RSS" },
  { href: "/admin/blog", label: "Blog" },
  { href: "/admin/events", label: "Eventos" },
  { href: "/admin/promotions", label: "Promociones" },
  { href: "/admin/newsletter", label: "Newsletter" },
  { href: "/admin/guest-requests", label: "Invitados" },
  { href: "/admin/users", label: "Usuarios" },
  { href: "/admin/reports", label: "Reportes" },
  { href: "/admin/schedule", label: "Programación" }
];

export function Sidebar({ active }: { active: string }) {
  return (
    <aside className="sidebar">
      <div className="badge" style={{ marginBottom: 18 }}>
        Admin Core
      </div>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={active === link.href ? "active" : undefined}
        >
          {link.label}
        </Link>
      ))}
    </aside>
  );
}
