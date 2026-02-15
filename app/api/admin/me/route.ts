import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getClients(authToken?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  // Use the caller JWT for auth, service role for role lookup to avoid RLS recursion / RPC param-name mismatches.
  const anon = createClient(url, anonKey, {
    global: authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : undefined
  });
  const service = createClient(url, serviceKey);
  return { anon, service };
}

async function requireAdmin(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return { ok: false as const, status: 401 };

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { ok: false as const, status: 500, error: "Falta SUPABASE_SERVICE_ROLE_KEY." };

  const { anon, service } = getClients(token);
  const { data: userData } = await anon.auth.getUser(token);
  const requesterId = userData.user?.id ?? null;
  if (!requesterId) return { ok: false as const, status: 401 };

  const { data: roles, error } = await service
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", requesterId);

  if (error) return { ok: false as const, status: 500, error: error.message };

  const isAdmin = (roles ?? []).some((row: any) => {
    const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
    return role?.name === "admin";
  });

  if (!isAdmin) return { ok: false as const, status: 403 };
  return { ok: true as const, status: 200 };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return NextResponse.json({ ok: false, error: (auth as any).error ?? null }, { status: auth.status });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
