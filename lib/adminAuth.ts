import { cookies } from "next/headers";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/authCookies";
import { hasAnyPermission, isStaffPermission, type StaffPermission } from "@/lib/staffPermissions";

type EnvConfig = {
  url: string;
  anonKey: string;
  serviceKey: string;
};

type UserAccess = {
  userId: string;
  service: SupabaseClient;
  roles: string[];
  permissions: StaffPermission[];
  isAdmin: boolean;
  isStaff: boolean;
};

function getEnvConfig(): EnvConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !anonKey || !serviceKey) return null;
  return { url, anonKey, serviceKey };
}

function readBearerToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (bearer) return bearer;
  return request.cookies.get(ACCESS_TOKEN_COOKIE)?.value ?? "";
}

function readRefreshToken(request: NextRequest) {
  return request.cookies.get(REFRESH_TOKEN_COOKIE)?.value ?? "";
}

type RefreshedSession = {
  accessToken: string;
  refreshToken: string;
};

async function resolveAccessByToken(
  token: string,
  config: EnvConfig
): Promise<{ ok: true; access: UserAccess } | { ok: false; status: number; error: string }> {
  const anon = createClient(config.url, config.anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false }
  });
  const service = createClient(config.url, config.serviceKey, { auth: { persistSession: false } });

  const { data: userData, error: userError } = await anon.auth.getUser(token);
  if (userError || !userData.user?.id) {
    return { ok: false, status: 401, error: "Sesión inválida." };
  }
  const userId = userData.user.id;

  const { data: rolesRows, error: rolesError } = await service.from("user_roles").select("roles(name)").eq("user_id", userId);
  if (rolesError) {
    return { ok: false, status: 500, error: rolesError.message };
  }

  const roles = (rolesRows ?? [])
    .map((row: any) => {
      const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
      return String(role?.name ?? "").trim();
    })
    .filter(Boolean);

  const isAdmin = roles.includes("admin");

  let permissions: StaffPermission[] = [];
  {
    const { data: permissionRows, error: permissionError } = await service
      .from("user_permissions")
      .select("permission")
      .eq("user_id", userId);

    // Migration-safe: if table does not exist yet, continue with empty permission list.
    if (!permissionError) {
      permissions = (permissionRows ?? [])
        .map((row: any) => String(row.permission ?? "").trim())
        .filter((value): value is StaffPermission => isStaffPermission(value));
    }
  }

  const isStaff = isAdmin || roles.includes("editor") || roles.includes("moderator") || permissions.length > 0;

  return {
    ok: true,
    access: {
      userId,
      service,
      roles,
      permissions,
      isAdmin,
      isStaff
    }
  };
}

async function refreshSessionByToken(
  refreshToken: string,
  config: EnvConfig
): Promise<RefreshedSession | null> {
  if (!refreshToken) return null;
  const endpoint = `${config.url}/auth/v1/token?grant_type=refresh_token`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: config.anonKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store"
  }).catch(() => null);
  if (!response?.ok) return null;

  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
  };
  const accessToken = String(payload.access_token ?? "").trim();
  const nextRefreshToken = String(payload.refresh_token ?? refreshToken).trim();
  if (!accessToken || !nextRefreshToken) return null;
  return { accessToken, refreshToken: nextRefreshToken };
}

async function resolveAccessWithFallback(
  accessToken: string,
  refreshToken: string,
  config: EnvConfig
): Promise<
  | { ok: true; access: UserAccess; refreshed: RefreshedSession | null }
  | { ok: false; status: number; error: string }
> {
  if (accessToken) {
    const direct = await resolveAccessByToken(accessToken, config);
    if (direct.ok) return { ok: true, access: direct.access, refreshed: null };
    if (direct.status !== 401 || !refreshToken) return direct;
  } else if (!refreshToken) {
    return { ok: false, status: 401, error: "Falta token." };
  }

  const refreshed = await refreshSessionByToken(refreshToken, config);
  if (!refreshed) return { ok: false, status: 401, error: "Sesión inválida." };
  const retried = await resolveAccessByToken(refreshed.accessToken, config);
  if (!retried.ok) return retried;
  return { ok: true, access: retried.access, refreshed };
}

export async function requireAdminApi(request: NextRequest): Promise<
  | { ok: true; userId: string; service: SupabaseClient }
  | { ok: false; status: number; error: string }
> {
  const config = getEnvConfig();
  if (!config) {
    return { ok: false, status: 500, error: "Faltan variables de Supabase en servidor." };
  }

  const token = readBearerToken(request);
  const refreshToken = readRefreshToken(request);
  const resolved = await resolveAccessWithFallback(token, refreshToken, config);
  if (!resolved.ok) return resolved;
  if (!resolved.access.isAdmin) return { ok: false, status: 403, error: "No autorizado." };
  return { ok: true, userId: resolved.access.userId, service: resolved.access.service };
}

export async function requireStaffApi(
  request: NextRequest,
  required?: StaffPermission | StaffPermission[]
): Promise<
  | {
      ok: true;
      userId: string;
      service: SupabaseClient;
      roles: string[];
      permissions: StaffPermission[];
      isAdmin: boolean;
      isStaff: boolean;
    }
  | { ok: false; status: number; error: string }
> {
  const config = getEnvConfig();
  if (!config) {
    return { ok: false, status: 500, error: "Faltan variables de Supabase en servidor." };
  }

  const token = readBearerToken(request);
  const refreshToken = readRefreshToken(request);
  const resolved = await resolveAccessWithFallback(token, refreshToken, config);
  if (!resolved.ok) return resolved;

  const access = resolved.access;
  if (!access.isStaff) return { ok: false, status: 403, error: "No autorizado." };
  if (required && !hasAnyPermission(access, required)) {
    return { ok: false, status: 403, error: "Sin permiso para esta sección." };
  }

  return {
    ok: true,
    userId: access.userId,
    service: access.service,
    roles: access.roles,
    permissions: access.permissions,
    isAdmin: access.isAdmin,
    isStaff: access.isStaff
  };
}

export async function getAccessFromToken(token: string): Promise<
  | {
      ok: true;
      userId: string;
      roles: string[];
      permissions: StaffPermission[];
      isAdmin: boolean;
      isStaff: boolean;
    }
  | { ok: false; status: number; error: string }
> {
  const config = getEnvConfig();
  if (!config) return { ok: false, status: 500, error: "Faltan variables de Supabase en servidor." };
  const resolved = await resolveAccessByToken(token, config);
  if (!resolved.ok) return resolved;
  return {
    ok: true,
    userId: resolved.access.userId,
    roles: resolved.access.roles,
    permissions: resolved.access.permissions,
    isAdmin: resolved.access.isAdmin,
    isStaff: resolved.access.isStaff
  };
}

export async function requireAdminPageOrRedirect(nextPath: string = "/admin") {
  const config = getEnvConfig();
  if (!config) {
    redirect("/");
  }

  const cookieStore = cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value ?? "";
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value ?? "";

  if (!token && !refreshToken) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  const resolved = await resolveAccessWithFallback(token, refreshToken, config as EnvConfig);
  if (!resolved.ok) {
    if (resolved.status === 401) {
      redirect(`/login?next=${encodeURIComponent(nextPath)}`);
    }
    redirect("/");
  }
  if (!resolved.access.isAdmin) redirect("/");

  return resolved.access.userId;
}

export async function requireStaffPageOrRedirect(nextPath: string = "/admin", required?: StaffPermission | StaffPermission[]) {
  const config = getEnvConfig();
  if (!config) {
    redirect("/");
  }

  const cookieStore = cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value ?? "";
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value ?? "";

  if (!token && !refreshToken) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  const resolved = await resolveAccessWithFallback(token, refreshToken, config as EnvConfig);
  if (!resolved.ok) {
    if (resolved.status === 401) {
      redirect(`/login?next=${encodeURIComponent(nextPath)}`);
    }
    redirect("/");
  }

  const access = resolved.access;
  if (!access.isStaff) redirect("/");
  if (required && !hasAnyPermission(access, required)) redirect("/admin");
  return access;
}
