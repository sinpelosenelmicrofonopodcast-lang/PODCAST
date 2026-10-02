import "../editorial-v2.css";
import Link from "next/link";
import type { Metadata } from "next";
import { AdminShell } from "@/components/AdminShell";
import { requireStaffPageOrRedirect } from "@/lib/adminAuth";
import { buildSeoMetadata } from "@/lib/seo/meta";

export const metadata: Metadata = buildSeoMetadata({
  title: "SPM Editorial OS | Sin Pelos en el Micrófono",
  description: "Sala editorial de Sin Pelos.",
  path: "/admin",
  noindex: true
});

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const access = await requireStaffPageOrRedirect("/admin");

  return (
    <AdminShell access={{ isAdmin: access.isAdmin, permissions: access.permissions }}>
      <header className="admin-layout-header card">
        <div>
          <p className="page-kicker">SPM Editorial OS</p>
          <h1 className="admin-layout-title">La sala donde una conversación se convierte en contenido.</h1>
          <p className="muted admin-layout-copy">
            Noticias, podcasts, editoriales, comunidad y distribución con control humano antes de publicar.
          </p>
        </div>
        <Link className="button secondary" href="/">
          Ver Media Hub
        </Link>
      </header>
      {children}
    </AdminShell>
  );
}
