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
    <div className="admin-shell">
      <Sidebar access={access} />
      <main className="admin-main">
        <div className="admin-content">{children}</div>
      </main>
    </div>
  );
}
