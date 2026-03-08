import { createClient } from "@supabase/supabase-js";

export async function getUserIdFromBearer(authHeader: string | null | undefined) {
  const token = String(authHeader ?? "").startsWith("Bearer ")
    ? String(authHeader).slice(7).trim()
    : "";
  if (!token) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !anon) return null;

  const client = createClient(url, anon, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  const { data, error } = await client.auth.getUser(token);
  if (error) return null;
  return String(data.user?.id ?? "").trim() || null;
}
