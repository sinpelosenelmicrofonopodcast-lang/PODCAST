import { NextRequest, NextResponse } from "next/server";

const SOCIAL_ADMIN_APIS = new Set(["/api/social/youtube/sync", "/api/social/meta/facebook/post-news"]);
const ACCESS_TOKEN_COOKIE = "sp_access_token";

function readBearer(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
}

async function isAdminToken(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !anonKey || !serviceKey) return false;

  const userRes = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`
    },
    cache: "no-store"
  });
  if (!userRes.ok) return false;
  const user = await userRes.json().catch(() => null);
  const userId = String(user?.id ?? "").trim();
  if (!userId) return false;

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
  if (!rolesRes.ok) return false;
  const rows = (await rolesRes.json().catch(() => [])) as any[];
  return (rows ?? []).some((row: any) => {
    const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
    return role?.name === "admin";
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsAdminPage = pathname.startsWith("/admin");
  const needsAdminApi = pathname.startsWith("/api/admin") || SOCIAL_ADMIN_APIS.has(pathname);
  if (!needsAdminPage && !needsAdminApi) return NextResponse.next();

  const token = readBearer(request) || request.cookies.get(ACCESS_TOKEN_COOKIE)?.value || "";
  if (!token) {
    if (needsAdminPage) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = await isAdminToken(token);
  if (!isAdmin) {
    if (needsAdminPage) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/api/social/youtube/sync", "/api/social/meta/facebook/post-news"]
};
