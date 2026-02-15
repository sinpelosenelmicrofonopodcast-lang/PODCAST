import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getClients(authToken?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  // Use RLS with the caller's JWT. We rely on an RPC (`is_admin`) that should be SECURITY DEFINER on the DB side.
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

  const { data: isAdmin, error } = await anon.rpc("is_admin", { uid: requesterId });
  if (error) return { ok: false as const, status: 500 };

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
