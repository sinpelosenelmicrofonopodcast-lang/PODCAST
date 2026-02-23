import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PipelineStage = "ingested" | "draft" | "published" | "social" | "failed";
export type PipelineStatus = "info" | "ok" | "error";
export type JobStatus = "queued" | "running" | "done" | "failed" | "cancelled";

export function normalizeSourceUrl(url?: string | null) {
  const value = String(url ?? "").trim().toLowerCase();
  return value.length > 0 ? value : null;
}

export function contentHash(parts: Array<string | null | undefined>) {
  const normalized = parts.map((p) => String(p ?? "").trim()).join("|");
  return createHash("sha256").update(normalized).digest("hex");
}

type CreateJobInput = {
  jobType: string;
  source?: string | null;
  title?: string | null;
  contentType?: string | null;
  contentId?: string | null;
  payload?: Record<string, any>;
  status?: JobStatus;
  priority?: number;
  scheduledFor?: string;
  createdBy?: string | null;
};

export async function createAutomationJob(service: SupabaseClient, input: CreateJobInput) {
  const { data, error } = await service
    .from("automation_jobs")
    .insert({
      job_type: input.jobType,
      source: input.source ?? null,
      title: input.title ?? null,
      content_type: input.contentType ?? null,
      content_id: input.contentId ?? null,
      payload: input.payload ?? {},
      status: input.status ?? "queued",
      priority: input.priority ?? 50,
      scheduled_for: input.scheduledFor ?? new Date().toISOString(),
      started_at: input.status === "running" ? new Date().toISOString() : null,
      created_by: input.createdBy ?? null
    })
    .select("id")
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return String(data?.id ?? "");
}

export async function updateAutomationJob(
  service: SupabaseClient,
  jobId: string,
  patch: Partial<{
    status: JobStatus;
    error: string | null;
    attempts: number;
    startedAt: string | null;
    finishedAt: string | null;
    payload: Record<string, any>;
  }>
) {
  const next: Record<string, any> = {};
  if (patch.status) next.status = patch.status;
  if (patch.error !== undefined) next.error = patch.error;
  if (patch.attempts !== undefined) next.attempts = patch.attempts;
  if (patch.startedAt !== undefined) next.started_at = patch.startedAt;
  if (patch.finishedAt !== undefined) next.finished_at = patch.finishedAt;
  if (patch.payload !== undefined) next.payload = patch.payload;
  if (Object.keys(next).length === 0) return;

  const { error } = await service.from("automation_jobs").update(next).eq("id", jobId);
  if (error) throw new Error(error.message);
}

type LogEventInput = {
  jobId?: string | null;
  stage: PipelineStage;
  status?: PipelineStatus;
  contentType?: string | null;
  contentId?: string | null;
  platform?: string | null;
  message?: string | null;
  meta?: Record<string, any>;
  actorId?: string | null;
};

export async function logPipelineEvent(service: SupabaseClient, input: LogEventInput) {
  const { error } = await service.from("pipeline_events").insert({
    job_id: input.jobId ?? null,
    stage: input.stage,
    status: input.status ?? "info",
    content_type: input.contentType ?? null,
    content_id: input.contentId ?? null,
    platform: input.platform ?? null,
    message: input.message ?? null,
    meta: input.meta ?? {},
    actor_id: input.actorId ?? null
  });
  if (error) throw new Error(error.message);
}
