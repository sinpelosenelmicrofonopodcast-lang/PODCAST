"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="layout">
      <Sidebar active={pathname} />
      <div style={{ padding: 32 }}>{children}</div>
    </div>
  );
}
