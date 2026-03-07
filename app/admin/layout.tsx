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
  await requireStaffPageOrRedirect("/admin");

  return (
    <AdminShell>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <Link className="button secondary" href="/">
          Volver al Home
        </Link>
        <span className="muted">Panel editorial</span>
      </div>
      {children}
    </AdminShell>
  );
}
