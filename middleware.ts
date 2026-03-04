import { NextRequest, NextResponse } from "next/server";
import {
  hasAnyPermission,
  requiredPermissionForAdminApi,
  requiredPermissionForAdminPage,
  type StaffPermission
} from "./lib/staffPermissions";

const SOCIAL_STAFF_APIS = new Set([
  "/api/social/youtube/sync",
  "/api/social/meta/facebook/post-news",
  "/api/social/meta/instagram/post-news"
]);
const SOCIAL_ADMIN_APIS = new Set(["/api/social/meta/facebook/diagnose"]);
const ACCESS_TOKEN_COOKIE = "sp_access_token";

type AccessInfo = {
  userId: string;
  roles: string[];
  permissions: StaffPermission[];
  isAdmin: boolean;
  isStaff: boolean;
};

function readBearer(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
}

async function getAccessByToken(token: string): Promise<AccessInfo | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !anonKey || !serviceKey) return null;

  const userRes = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`
    },
    cache: "no-store"
  });
  if (!userRes.ok) return null;
  const user = await userRes.json().catch(() => null);
  const userId = String(user?.id ?? "").trim();
  if (!userId) return null;

  const rolesUrl = new URL(`${url}/rest/v1/user_roles`);
  rolesUrl.searchParams.set("user_id", `eq.${userId}`);
  rolesUrl.searchParams.set("select", "roles(name)");
  const rolesRes = await fetch(rolesUrl.toString(), {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: "application/json"
    },
    cache: "no-store"
  });
  if (!rolesRes.ok) return null;
  const rolesRows = (await rolesRes.json().catch(() => [])) as any[];
  const roles = (rolesRows ?? [])
    .map((row: any) => {
      const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
      return String(role?.name ?? "").trim();
    })
    .filter(Boolean);

  const isAdmin = roles.includes("admin");

  let permissions: StaffPermission[] = [];
  {
    const permsUrl = new URL(`${url}/rest/v1/user_permissions`);
    permsUrl.searchParams.set("user_id", `eq.${userId}`);
    permsUrl.searchParams.set("select", "permission");
    const permsRes = await fetch(permsUrl.toString(), {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Accept: "application/json"
      },
      cache: "no-store"
    });
    if (permsRes.ok) {
      const rows = (await permsRes.json().catch(() => [])) as Array<{ permission?: string }>;
      permissions = rows
        .map((row) => String(row?.permission ?? "").trim())
        .filter(Boolean) as StaffPermission[];
    }
  }

  const isStaff = isAdmin || roles.includes("editor") || roles.includes("moderator") || permissions.length > 0;
  return { userId, roles, permissions, isAdmin, isStaff };
}

function denyPage(request: NextRequest, target: "/admin" | "/") {
  return NextResponse.redirect(new URL(target, request.url));
}

function denyApi(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsStaffPage = pathname.startsWith("/admin");
  const needsStaffApi = pathname.startsWith("/api/admin") || SOCIAL_STAFF_APIS.has(pathname) || SOCIAL_ADMIN_APIS.has(pathname);
  if (!needsStaffPage && !needsStaffApi) return NextResponse.next();

  const token = readBearer(request) || request.cookies.get(ACCESS_TOKEN_COOKIE)?.value || "";
  if (!token) {
    if (needsStaffPage) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return denyApi(401, "Unauthorized");
  }

  const access = await getAccessByToken(token);
  if (!access) {
    if (needsStaffPage) return denyPage(request, "/");
    return denyApi(401, "Unauthorized");
  }

  if (!access.isStaff) {
    if (needsStaffPage) return denyPage(request, "/");
    return denyApi(403, "Forbidden");
  }

  if (needsStaffPage) {
    const required = requiredPermissionForAdminPage(pathname);
    if (required === "admin" && !access.isAdmin) return denyPage(request, "/admin");
    if (required && required !== "admin" && !hasAnyPermission(access, required)) return denyPage(request, "/admin");
  }

  if (needsStaffApi) {
    const required = requiredPermissionForAdminApi(pathname);
    if (required === "admin" && !access.isAdmin) return denyApi(403, "Sin permiso.");
    if (required && required !== "admin" && !hasAnyPermission(access, required)) return denyApi(403, "Sin permiso.");
    if (pathname === "/api/social/youtube/sync" && !hasAnyPermission(access, "manage_news_sources")) return denyApi(403, "Sin permiso.");
    if (pathname === "/api/social/meta/facebook/post-news" && !hasAnyPermission(access, "manage_news")) return denyApi(403, "Sin permiso.");
    if (pathname === "/api/social/meta/instagram/post-news" && !hasAnyPermission(access, "manage_news")) return denyApi(403, "Sin permiso.");
    if (pathname === "/api/social/meta/facebook/diagnose" && !access.isAdmin) return denyApi(403, "Sin permiso.");
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/social/youtube/sync",
    "/api/social/meta/facebook/post-news",
    "/api/social/meta/instagram/post-news",
    "/api/social/meta/facebook/diagnose"
  ]
};
