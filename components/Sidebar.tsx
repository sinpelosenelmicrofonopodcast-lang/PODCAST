import Link from "next/link";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/content", label: "Contenido" },
  { href: "/admin/news", label: "Noticias" },
  { href: "/admin/blog", label: "Blog" },
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
