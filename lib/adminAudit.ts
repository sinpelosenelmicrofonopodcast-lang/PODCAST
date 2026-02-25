import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminAuditInput = {
  actorId: string;
  action: string;
  targetTable?: string | null;
  targetId?: string | null;
  meta?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
};

export function getRequestAuditMeta(request: NextRequest) {
  const ipHeader =
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    "";
  const ip = ipHeader.split(",")[0]?.trim() || null;
  const userAgent = request.headers.get("user-agent") || null;
  return { ip, userAgent };
}

export async function logAdminAudit(service: SupabaseClient, input: AdminAuditInput) {
  const { error } = await service.from("admin_audit_logs").insert({
    actor_id: input.actorId,
    action: input.action,
    target_table: input.targetTable ?? null,
    target_id: input.targetId ?? null,
    meta: input.meta ?? {},
    ip: input.ip ?? null,
    user_agent: input.userAgent ?? null
  });

  // Migration-safe: no-op if table/column is not ready yet.
  if (error) {
    const msg = String(error.message ?? "").toLowerCase();
    const ignorable =
      msg.includes("admin_audit_logs") ||
      msg.includes("relation") ||
      msg.includes("schema cache") ||
      msg.includes("column");
    if (!ignorable) {
      console.warn("[admin-audit] insert failed:", error.message);
    }
  }
}

