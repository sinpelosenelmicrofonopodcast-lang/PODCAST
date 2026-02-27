import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import { ACCESS_TOKEN_COOKIE } from "@/lib/authCookies";

type Config = {
  url: string;
  anonKey: string;
  serviceKey: string;
};

export function getMicBrawlConfig(): Config {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !anonKey || !serviceKey) {
    throw new Error("Faltan variables de Supabase en servidor.");
  }
  return { url, anonKey, serviceKey };
}

export function createServiceClient() {
  const config = getMicBrawlConfig();
  return createClient(config.url, config.serviceKey, { auth: { persistSession: false } });
}

export function readTokenFromRequest(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (bearer) return bearer;
  return request.cookies.get(ACCESS_TOKEN_COOKIE)?.value ?? "";
}

export function createUserClientFromToken(token: string): SupabaseClient {
  const config = getMicBrawlConfig();
  return createClient(config.url, config.anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
}

export async function resolveUserFromRequest(request: NextRequest): Promise<{ user: User; token: string } | null> {
  const token = readTokenFromRequest(request);
  if (!token) return null;

  const userClient = createUserClientFromToken(token);
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data.user) return null;
  return { user: data.user, token };
}

export async function ensureMicBrawlProfile(service: SupabaseClient, user: User) {
  const fallback = `player_${String(user.id).replace(/-/g, "").slice(0, 8)}`;
  const fromEmail = String(user.email ?? "")
    .split("@")[0]
    ?.toLowerCase()
    ?.replace(/[^a-z0-9_]+/g, "");
  const handle = fromEmail || fallback;

  await service
    .from("profiles")
    .upsert(
      {
        id: user.id,
        handle
      },
      { onConflict: "id", ignoreDuplicates: false }
    )
    .select("id")
    .single();
}

export function parseJsonBody<T = any>(value: unknown): T {
  if (typeof value === "object" && value !== null) return value as T;
  return {} as T;
}

