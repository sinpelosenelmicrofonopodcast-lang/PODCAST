import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { withGoogleEditorial } from "./googleEditorial";

let serviceClient: SupabaseClient | null = null;

export function supabaseService(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }
  if (serviceClient) return serviceClient;
  serviceClient = withGoogleEditorial(createClient(url, serviceRoleKey, { auth: { persistSession: false } }));
  return serviceClient!;
}
