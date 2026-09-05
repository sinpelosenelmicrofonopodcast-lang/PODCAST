import { NextRequest, NextResponse } from "next/server";
import {
  hasAnyPermission,
  requiredPermissionForAdminApi,
  requiredPermissionForAdminPage,
  type StaffPermission
} from "./lib/staffPermissions";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "./lib/authCookies";
import { canonicalHost } from "@/lib/seo/constants";
import { isPrivateSeoPath } from "@/lib/seo/privateRoutes";

const SOCIAL_STAFF_APIS = new Set([
  "/api/social/youtube/sync",
  "/api/social/meta/facebook/post-news",
  "/api/social/meta/facebook/post-episode",
  "/api/social/meta/instagram/post-news",
  "/api/social/meta/facebook/post-blog",
  "/api/social/meta/instagram/post-blog"
]);
const SOCIAL_ADMIN_APIS = new Set(["/api/social/meta/facebook/diagnose"]);

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

type RefreshedSession = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

async function refreshSessionByRefreshToken(refreshToken: string): Promise<RefreshedSession | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !anonKey || !refreshToken) return null;

  const endpoint = `${url}/auth/v1/token?grant_type=refresh_token`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store"
  }).catch(() => null);

  if (!res?.ok) return null;
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  const nextAccessToken = String(json?.access_token ?? "").trim();
  const nextRefreshToken = String(json?.refresh_token ?? refreshToken).trim();
  const expiresIn = Number(json?.expires_in ?? 3600);
  if (!nextAccessToken || !nextRefreshToken) return null;
  return {
    accessToken: nextAccessToken,
    refreshToken: nextRefreshToken,
    expiresIn: Number.isFinite(expiresIn) ? Math.max(60, Math.floor(expiresIn)) : 3600
  };
}

function denyPage(request: NextRequest, target: "/admin" | "/") {
  return withNoindex(NextResponse.redirect(new URL(target, request.url)));
}

function denyApi(status: number, error: string) {
  return withNoindex(NextResponse.json({ ok: false, error }, { status }));
}

function withNoindex(response: NextResponse) {
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

function isAssetPath(pathname: string) {
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/favicon")) return true;
  if (pathname.startsWith("/images/")) return true;
  if (pathname.startsWith("/icons/")) return true;
  if (pathname.startsWith("/logo")) return true;
  if (pathname.startsWith("/manifest")) return true;
  return /\.[a-zA-Z0-9]+$/.test(pathname);
}

function shouldCanonicalRedirect(request: NextRequest) {
  const url = request.nextUrl.clone();
  const hostHeader = (request.headers.get("host") ?? "").toLowerCase();
  const host = hostHeader || url.host.toLowerCase();
  const protocol = (request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "")).toLowerCase();
  const localHost = host.includes("localhost") || host.startsWith("127.0.0.1");
  const targetHost = canonicalHost();

  let changed = false;
  if (!localHost && protocol === "http") {
    url.protocol = "https:";
    changed = true;
  }
  if (!localHost && host !== targetHost) {
    url.host = targetHost;
    changed = true;
  }
  if (url.pathname !== "/" && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/+$/, "");
    changed = true;
  }
  return changed ? url : null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isAssetPath(pathname)) return NextResponse.next();

  // Vercel invokes cron routes on the deployment hostname. Let each route
  // validate CRON_SECRET directly instead of redirecting and dropping auth.
  if (pathname.startsWith("/api/cron/")) return NextResponse.next();

  const redirectTo = shouldCanonicalRedirect(request);
  if (redirectTo) return NextResponse.redirect(redirectTo, 308);

  const needsStaffPage = pathname.startsWith("/admin");
  const needsStaffApi = pathname.startsWith("/api/admin") || SOCIAL_STAFF_APIS.has(pathname) || SOCIAL_ADMIN_APIS.has(pathname);
  const privateSeoPath = isPrivateSeoPath(pathname);
  if (!needsStaffPage && !needsStaffApi) {
    const response = NextResponse.next();
    if (privateSeoPath) withNoindex(response);
    return response;
  }

  let token = readBearer(request) || request.cookies.get(ACCESS_TOKEN_COOKIE)?.value || "";
  let access = token ? await getAccessByToken(token) : null;
  let refreshedSession: RefreshedSession | null = null;

  if (!access) {
    const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value ?? "";
    if (refreshToken) {
      refreshedSession = await refreshSessionByRefreshToken(refreshToken);
      if (refreshedSession?.accessToken) {
        token = refreshedSession.accessToken;
        access = await getAccessByToken(token);
      }
    }
  }

  if (!token || !access) {
    if (needsStaffPage) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return withNoindex(NextResponse.redirect(loginUrl));
    }
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
    if (pathname === "/api/social/meta/facebook/post-episode" && !hasAnyPermission(access, "manage_news")) return denyApi(403, "Sin permiso.");
    if (pathname === "/api/social/meta/instagram/post-news" && !hasAnyPermission(access, "manage_news")) return denyApi(403, "Sin permiso.");
    if (pathname === "/api/social/meta/facebook/post-blog" && !hasAnyPermission(access, "manage_blog")) return denyApi(403, "Sin permiso.");
    if (pathname === "/api/social/meta/instagram/post-blog" && !hasAnyPermission(access, "manage_blog")) return denyApi(403, "Sin permiso.");
    if (pathname === "/api/social/meta/facebook/diagnose" && !access.isAdmin) return denyApi(403, "Sin permiso.");
  }

  const response = NextResponse.next();
  if (refreshedSession) {
    const secure = process.env.NODE_ENV === "production";
    response.cookies.set(ACCESS_TOKEN_COOKIE, refreshedSession.accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: refreshedSession.expiresIn
    });
    response.cookies.set(REFRESH_TOKEN_COOKIE, refreshedSession.refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 60 * 60 * 24 * 30
    });
  }
  if (privateSeoPath) withNoindex(response);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
