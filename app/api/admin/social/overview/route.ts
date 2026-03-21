import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/adminAuth";

type UnifiedQueueItem =
  | {
      id: string;
      kind: "job";
      title: string;
      subtitle: string;
      status: string;
      scheduledFor: string | null;
      createdAt: string | null;
      platform: string | null;
      error: string | null;
      actionKey: string | null;
      meta: Record<string, any>;
    }
  | {
      id: string;
      kind: "scheduled_post";
      title: string;
      subtitle: string;
      status: string;
      scheduledFor: string | null;
      createdAt: string | null;
      platform: string | null;
      error: string | null;
      actionKey: string | null;
      meta: Record<string, any>;
    }
  | {
      id: string;
      kind: "social_publication";
      title: string;
      subtitle: string;
      status: string;
      scheduledFor: string | null;
      createdAt: string | null;
      platform: string | null;
      error: string | null;
      actionKey: string | null;
      meta: Record<string, any>;
    };

function normalizeText(value?: string | null) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaffApi(request, ["manage_news", "manage_blog", "view_schedule"]);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const [jobsRes, scheduledRes, socialRes] = await Promise.all([
      auth.service
        .from("automation_jobs")
        .select("id, job_type, source, title, content_type, content_id, status, priority, scheduled_for, created_at, error")
        .order("scheduled_for", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(80),
      auth.service
        .from("scheduled_posts")
        .select("id, platform, message, campaign_label, campaign_key, status, scheduled_for, created_at, error, publish_as")
        .order("scheduled_for", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(80),
      auth.service
        .from("social_publications")
        .select("id, article_id, platform, status, payload, created_at, published_at, response")
        .order("created_at", { ascending: false })
        .limit(80)
    ]);

    if (jobsRes.error) return NextResponse.json({ ok: false, error: jobsRes.error.message }, { status: 400 });
    if (scheduledRes.error) return NextResponse.json({ ok: false, error: scheduledRes.error.message }, { status: 400 });
    if (socialRes.error) return NextResponse.json({ ok: false, error: socialRes.error.message }, { status: 400 });

    const items: UnifiedQueueItem[] = [
      ...((jobsRes.data ?? []) as Array<any>).map((row) => ({
        id: String(row.id),
        kind: "job" as const,
        title: normalizeText(row.title) || normalizeText(row.job_type) || "Job",
        subtitle: [normalizeText(row.job_type), normalizeText(row.source), normalizeText(row.content_type)].filter(Boolean).join(" · "),
        status: normalizeText(row.status) || "queued",
        scheduledFor: row.scheduled_for ?? null,
        createdAt: row.created_at ?? null,
        platform: normalizeText(row.job_type).includes("instagram") ? "Instagram" : normalizeText(row.job_type).includes("facebook") ? "Facebook" : null,
        error: normalizeText(row.error) || null,
        actionKey: row.job_type === "facebook_post_episode" ? "job:facebook_post_episode" : null,
        meta: {
          jobType: row.job_type,
          source: row.source,
          contentType: row.content_type,
          contentId: row.content_id,
          priority: row.priority
        }
      })),
      ...((scheduledRes.data ?? []) as Array<any>).map((row) => ({
        id: String(row.id),
        kind: "scheduled_post" as const,
        title: normalizeText(row.campaign_label) || normalizeText(row.campaign_key) || "Post programado",
        subtitle: normalizeText(row.message).slice(0, 140) || "Sin mensaje",
        status: normalizeText(row.status) || "queued",
        scheduledFor: row.scheduled_for ?? null,
        createdAt: row.created_at ?? null,
        platform: normalizeText(row.platform) || null,
        error: normalizeText(row.error) || null,
        actionKey: "scheduled_post",
        meta: {
          campaignLabel: row.campaign_label,
          campaignKey: row.campaign_key,
          publishAs: row.publish_as
        }
      })),
      ...((socialRes.data ?? []) as Array<any>).map((row) => ({
        id: String(row.id),
        kind: "social_publication" as const,
        title: `Social Queue · ${normalizeText(row.platform) || "social"}`,
        subtitle: normalizeText(row?.payload?.message ?? row?.payload?.link ?? row.article_id) || "Elemento en cola social",
        status: normalizeText(row.status) || "queued",
        scheduledFor: row.published_at ?? null,
        createdAt: row.created_at ?? null,
        platform: normalizeText(row.platform) || null,
        error: normalizeText(row?.response?.error) || null,
        actionKey: "social_publication",
        meta: {
          articleId: row.article_id,
          externalId: row?.response?.externalId ?? null
        }
      }))
    ]
      .sort((a, b) => {
        const left = new Date(a.scheduledFor ?? a.createdAt ?? 0).getTime();
        const right = new Date(b.scheduledFor ?? b.createdAt ?? 0).getTime();
        return right - left;
      })
      .slice(0, 120);

    const summary = items.reduce(
      (acc, item) => {
        acc.total += 1;
        acc.byKind[item.kind] = (acc.byKind[item.kind] ?? 0) + 1;
        acc.byStatus[item.status] = (acc.byStatus[item.status] ?? 0) + 1;
        return acc;
      },
      { total: 0, byKind: {} as Record<string, number>, byStatus: {} as Record<string, number> }
    );

    return NextResponse.json({ ok: true, items, summary });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
