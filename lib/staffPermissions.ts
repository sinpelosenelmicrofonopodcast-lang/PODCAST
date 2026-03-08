export const STAFF_PERMISSIONS = [
  "manage_home",
  "manage_news",
  "manage_news_sources",
  "manage_blog",
  "manage_events",
  "manage_promotions",
  "manage_newsletter",
  "manage_guest_requests",
  "moderate_community",
  "moderate_confessions",
  "moderate_theories",
  "view_stats",
  "view_reports",
  "view_schedule"
] as const;

export type StaffPermission = (typeof STAFF_PERMISSIONS)[number];

export const STAFF_PERMISSION_LABELS: Record<StaffPermission, string> = {
  manage_home: "Home (contenido principal)",
  manage_news: "Noticias",
  manage_news_sources: "Fuentes RSS / Automatización",
  manage_blog: "Blog",
  manage_events: "Eventos",
  manage_promotions: "Promociones",
  manage_newsletter: "Newsletter",
  manage_guest_requests: "Invitados",
  moderate_community: "Moderar comunidad / foro",
  moderate_confessions: "Moderar confesiones",
  moderate_theories: "Moderar teorías",
  view_stats: "Ver estadísticas",
  view_reports: "Ver reportes",
  view_schedule: "Ver programación / cola"
};

export function isStaffPermission(value: string): value is StaffPermission {
  return (STAFF_PERMISSIONS as readonly string[]).includes(value);
}

export function normalizePermissionList(values: unknown): StaffPermission[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<StaffPermission>();
  for (const value of values) {
    const candidate = String(value ?? "").trim();
    if (!candidate) continue;
    if (isStaffPermission(candidate)) seen.add(candidate);
  }
  return Array.from(seen);
}

export type AccessShape = {
  isAdmin: boolean;
  permissions: string[];
};

export function hasPermission(access: AccessShape, permission: StaffPermission) {
  return access.isAdmin || access.permissions.includes(permission);
}

export function hasAnyPermission(access: AccessShape, required: StaffPermission | StaffPermission[]) {
  if (access.isAdmin) return true;
  const list = Array.isArray(required) ? required : [required];
  return list.some((permission) => access.permissions.includes(permission));
}

export function requiredPermissionForAdminPage(pathname: string): StaffPermission | "admin" | null {
  if (pathname === "/admin" || pathname === "/admin/") return null;
  if (pathname.startsWith("/admin/auto-posts")) return "admin";
  if (pathname.startsWith("/admin/facebook-fans")) return "admin";
  if (pathname.startsWith("/admin/users")) return "admin";
  if (pathname.startsWith("/admin/mic-brawl")) return "admin";
  if (pathname.startsWith("/admin/home")) return "manage_home";
  if (pathname.startsWith("/admin/news-sources")) return "manage_news_sources";
  if (pathname.startsWith("/admin/news")) return "manage_news";
  if (pathname.startsWith("/admin/episodes")) return "manage_news";
  if (pathname.startsWith("/admin/blog")) return "manage_blog";
  if (pathname.startsWith("/admin/events")) return "manage_events";
  if (pathname.startsWith("/admin/promotions")) return "manage_promotions";
  if (pathname.startsWith("/admin/newsletter")) return "manage_newsletter";
  if (pathname.startsWith("/admin/guest-requests")) return "manage_guest_requests";
  if (pathname.startsWith("/admin/stats")) return "view_stats";
  if (pathname.startsWith("/admin/seo")) return "view_stats";
  if (pathname.startsWith("/admin/reports")) return "view_reports";
  if (pathname.startsWith("/admin/schedule")) return "view_schedule";
  if (pathname.startsWith("/admin/content")) return "manage_home";
  return null;
}

export function requiredPermissionForAdminApi(pathname: string): StaffPermission | "admin" | null {
  if (pathname === "/api/admin/me") return null;
  if (pathname.startsWith("/api/admin/auto-posts")) return "admin";
  if (pathname.startsWith("/api/admin/facebook-fans")) return "admin";
  if (pathname.startsWith("/api/admin/users")) return "admin";
  if (pathname.startsWith("/api/admin/mic-brawl")) return "admin";
  if (pathname.startsWith("/api/admin/stats")) return "view_stats";
  if (pathname.startsWith("/api/admin/jobs")) return "view_schedule";
  if (pathname.startsWith("/api/admin/pipeline-events")) return "view_reports";
  if (pathname.startsWith("/api/admin/schema/blog-posts")) return "manage_blog";
  if (pathname.startsWith("/api/admin/news-sources")) return "manage_news_sources";
  if (pathname.startsWith("/api/admin/news-automation")) return "manage_news_sources";
  if (pathname.startsWith("/api/admin/news/rewrite")) return "manage_news";
  if (pathname.startsWith("/api/admin/notifications/onesignal")) return "manage_news";
  if (pathname.startsWith("/api/admin/promotions")) return "manage_promotions";
  if (pathname.startsWith("/api/admin/delete")) return null;
  return null;
}
