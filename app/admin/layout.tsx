import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { requireAdminPageOrRedirect } from "@/lib/adminAuth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPageOrRedirect("/admin");

  return (
    <AdminShell>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <Link className="button secondary" href="/">
          Volver al Home
        </Link>
        <span className="muted">Modo Admin</span>
      </div>
      {children}
    </AdminShell>
  );
}
