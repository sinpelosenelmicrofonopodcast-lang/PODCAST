import "../editorial-v2.css";
import "./admin.css";
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

  return <AdminShell access={{ isAdmin: access.isAdmin, permissions: access.permissions }}>{children}</AdminShell>;
}
