import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
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
