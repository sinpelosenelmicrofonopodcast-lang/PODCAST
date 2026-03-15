import Link from "next/link";
import type { Metadata } from "next";
import { AdminShell } from "@/components/AdminShell";
import { requireStaffPageOrRedirect } from "@/lib/adminAuth";
import { buildSeoMetadata } from "@/lib/seo/meta";

export const metadata: Metadata = buildSeoMetadata({
  title: "Admin | Sin Pelos en el Micrófono",
  description: "Panel administrativo.",
  path: "/admin",
  noindex: true
});

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const access = await requireStaffPageOrRedirect("/admin");

  return (
    <AdminShell access={{ isAdmin: access.isAdmin, permissions: access.permissions }}>
      <header className="admin-layout-header card">
        <div>
          <p className="page-kicker">Panel editorial</p>
          <h1 className="admin-layout-title">Operaciones de Sin Pelos</h1>
          <p className="muted admin-layout-copy">
            Administra portada, contenido, comunidad y automatizaciones sin tocar la lógica actual.
          </p>
        </div>
        <Link className="button secondary" href="/">
          Volver al sitio
        </Link>
      </header>
      {children}
    </AdminShell>
  );
}
