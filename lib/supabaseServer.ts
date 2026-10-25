import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { withGoogleEditorial } from "./googleEditorial";

let serverClient: SupabaseClient | null = null;

export function supabaseServer(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  if (serverClient) return serverClient;
  serverClient = withGoogleEditorial(createClient(url, key, { auth: { persistSession: false } }));
  return serverClient!;
}
