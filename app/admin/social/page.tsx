import { AdminSocialHub } from "@/components/admin/AdminSocialHub";
import { hasAnyPermission } from "@/lib/staffPermissions";
import { requireStaffPageOrRedirect } from "@/lib/adminAuth";

export default async function AdminSocialPage() {
  const access = await requireStaffPageOrRedirect("/admin/social", ["manage_news", "manage_blog", "view_schedule"]);

  return (
    <AdminSocialHub
      canManageNews={hasAnyPermission(access, "manage_news")}
      canManageBlog={hasAnyPermission(access, "manage_blog")}
      canViewSchedule={hasAnyPermission(access, "view_schedule")}
    />
  );
}
