import { cookies } from "next/headers";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { ACCESS_TOKEN_COOKIE } from "@/lib/authCookies";

type EnvConfig = {
  url: string;
  anonKey: string;
  serviceKey: string;
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

async function resolveAdminByToken(token: string, config: EnvConfig) {
  const anon = createClient(config.url, config.anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false }
  });
  const service = createClient(config.url, config.serviceKey, { auth: { persistSession: false } });

  const { data: userData, error: userError } = await anon.auth.getUser(token);
  if (userError || !userData.user?.id) {
    return { ok: false as const, status: 401, error: "Sesión inválida." };
  }
  const userId = userData.user.id;

  const { data: roles, error: rolesError } = await service
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", userId);

  if (rolesError) {
    return { ok: false as const, status: 500, error: rolesError.message };
  }

  const isAdmin = (roles ?? []).some((row: any) => {
    const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
    return role?.name === "admin";
  });
  if (!isAdmin) {
    return { ok: false as const, status: 403, error: "No autorizado." };
  }

  return { ok: true as const, userId, service };
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
  if (!token) {
    return { ok: false, status: 401, error: "Falta token." };
  }

  return resolveAdminByToken(token, config);
}

export async function requireAdminPageOrRedirect(nextPath: string = "/admin") {
  const config = getEnvConfig();
  if (!config) {
    redirect("/");
  }

  const token = cookies().get(ACCESS_TOKEN_COOKIE)?.value ?? "";
  if (!token) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  const auth = await resolveAdminByToken(token, config as EnvConfig);
  if (!auth.ok) {
    if (auth.status === 401) {
      redirect(`/login?next=${encodeURIComponent(nextPath)}`);
    }
    redirect("/");
  }

  return auth.userId;
}

