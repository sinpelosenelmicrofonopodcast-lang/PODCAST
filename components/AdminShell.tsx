import { Sidebar } from "@/components/Sidebar";
import type { StaffPermission } from "@/lib/staffPermissions";

type AdminShellProps = {
  children: React.ReactNode;
  access: {
    isAdmin: boolean;
    permissions: StaffPermission[];
  };
};

export function AdminShell({ children, access }: AdminShellProps) {
  return (
    <div className="layout">
      <Sidebar access={access} />
      <div style={{ padding: 32 }}>{children}</div>
    </div>
  );
}
