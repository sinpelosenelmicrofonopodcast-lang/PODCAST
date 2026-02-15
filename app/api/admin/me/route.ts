import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getClients(authToken?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  // Use RLS with the caller's JWT. This avoids hard dependency on service role key for simple "am I admin?" checks.
  const anon = createClient(url, anonKey, {
    global: authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : undefined
  });
  return { anon };
}

async function requireAdmin(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return { ok: false as const, status: 401 };

  const { anon } = getClients(token);
  const { data: userData } = await anon.auth.getUser(token);
  const requesterId = userData.user?.id ?? null;
  if (!requesterId) return { ok: false as const, status: 401 };

  const { data: roles, error } = await anon
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", requesterId);

  if (error) {
    // If RLS/policies are missing or misconfigured, surface as 500 so the UI can show a clear message.
    return { ok: false as const, status: 500 };
  }

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
    if (!auth.ok) return NextResponse.json({ ok: false }, { status: auth.status });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
