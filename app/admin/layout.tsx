import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { AdminWall } from "@/components/AdminWall";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminShell>
      <AdminWall />
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
