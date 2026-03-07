import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/adminAuth";
import { getRequestAuditMeta, logAdminAudit } from "@/lib/adminAudit";
import { createAutomationJob, logPipelineEvent, updateAutomationJob } from "@/lib/pipelineOps";
import { postEpisodeToFacebook } from "@/lib/socialFacebook";
import { getYouTubeVideoId } from "@/lib/youtube";

type EpisodeRow = {
  id: string;
  slug: string | null;
  title: string | null;
  description: string | null;
  youtube_url: string | null;
  thumbnail_url: string | null;
};

type ExternalEpisodeRow = {
  id: string;
  title: string | null;
  caption: string | null;
  source_url: string | null;
  media_url: string | null;
  metrics: { isShort?: boolean; durationSeconds?: number } | null;
};

function isLikelyMissingEpisodesTable(errorMessage?: string | null) {
  const text = String(errorMessage ?? "").toLowerCase();
  return text.includes("episodes") && (text.includes("relation") || text.includes("schema cache") || text.includes("does not exist"));
}

function isShortExternalEpisode(row: ExternalEpisodeRow | null) {
  if (!row) return false;
  if (row.metrics?.isShort === true) return true;
  const duration = Number(row.metrics?.durationSeconds ?? 0);
  if (Number.isFinite(duration) && duration > 0 && duration <= 180) return true;
  const source = String(row.source_url ?? "").toLowerCase();
  if (source.includes("/shorts/")) return true;
  return false;
}

export async function POST(request: NextRequest) {
  let jobId = "";
  try {
    const auth = await requireStaffApi(request, "manage_news");
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const reqMeta = getRequestAuditMeta(request);

    const body = await request.json().catch(() => ({}));
    const episodeId = String(body?.episodeId ?? "").trim();
    let episodeSlug = String(body?.episodeSlug ?? "").trim();
    let title = String(body?.title ?? "").trim();
    let description = String(body?.description ?? "").trim();
    let sourceUrl = String(body?.sourceUrl ?? "").trim();
    const customText = String(body?.customText ?? "").trim();
    const scheduleForRaw = String(body?.scheduleFor ?? "").trim();

    if (!episodeId) {
      return NextResponse.json({ ok: false, error: "episodeId requerido." }, { status: 400 });
    }

    if (!title || !description || !episodeSlug || !sourceUrl) {
      const episodeRes = await auth.service
        .from("episodes")
        .select("id, slug, title, description, youtube_url, thumbnail_url")
        .eq("id", episodeId)
        .limit(1)
        .maybeSingle();

      const dbEpisode = (episodeRes.data ?? null) as EpisodeRow | null;
      if (episodeRes.error && !isLikelyMissingEpisodesTable(episodeRes.error.message)) {
        return NextResponse.json({ ok: false, error: episodeRes.error.message }, { status: 400 });
      }

      if (!dbEpisode) {
        const externalRes = await auth.service
          .from("external_posts")
          .select("id, title, caption, source_url, media_url, metrics")
          .eq("id", episodeId)
          .limit(1)
          .maybeSingle();

        if (externalRes.error) return NextResponse.json({ ok: false, error: externalRes.error.message }, { status: 400 });
        const externalRow = (externalRes.data ?? null) as ExternalEpisodeRow | null;
        if (!externalRow) {
          return NextResponse.json({ ok: false, error: "Episodio no encontrado." }, { status: 404 });
        }
        if (isShortExternalEpisode(externalRow)) {
          return NextResponse.json({ ok: false, error: "Ese contenido es un clip/short, no un episodio largo." }, { status: 400 });
        }

        if (!title) title = String(externalRow.title ?? "").trim();
        if (!description) description = String(externalRow.caption ?? "").trim();
        if (!sourceUrl) sourceUrl = String(externalRow.source_url ?? "").trim();
        if (!episodeSlug) episodeSlug = getYouTubeVideoId(externalRow.source_url) ?? String(externalRow.id);
      } else {
        if (!title) title = String(dbEpisode.title ?? "").trim();
        if (!description) description = String(dbEpisode.description ?? "").trim();
        if (!sourceUrl) sourceUrl = String(dbEpisode.youtube_url ?? "").trim();
        if (!episodeSlug) {
          episodeSlug = String(dbEpisode.slug ?? "").trim() || getYouTubeVideoId(dbEpisode.youtube_url) || String(dbEpisode.id);
        }
      }
    }

    if (!title) title = "Nuevo episodio";
    if (!episodeSlug) episodeSlug = getYouTubeVideoId(sourceUrl) || episodeId;

    let scheduleForIso: string | null = null;
    if (scheduleForRaw) {
      const parsed = new Date(scheduleForRaw);
      if (!Number.isFinite(parsed.getTime())) {
        return NextResponse.json({ ok: false, error: "scheduleFor inválido." }, { status: 400 });
      }
      scheduleForIso = parsed.toISOString();
      if (parsed.getTime() <= Date.now() + 30_000) {
        return NextResponse.json({ ok: false, error: "La fecha programada debe ser futura (mínimo 30 segundos)." }, { status: 400 });
      }
    }

    if (scheduleForIso) {
      jobId = await createAutomationJob(auth.service, {
        jobType: "facebook_post_episode",
        source: "facebook",
        title: title || "Programar episodio en Facebook",
        contentType: "episode",
        contentId: episodeId,
        payload: {
          episodeId,
          episodeSlug,
          title,
          description,
          sourceUrl: sourceUrl || null,
          customText: customText || null
        },
        status: "queued",
        priority: 45,
        scheduledFor: scheduleForIso,
        createdBy: auth.userId
      });

      await logPipelineEvent(auth.service, {
        jobId,
        stage: "social",
        status: "info",
        contentType: "episode",
        contentId: episodeId,
        platform: "Facebook",
        message: "Post de episodio programado para Facebook",
        meta: { scheduled_for: scheduleForIso },
        actorId: auth.userId
      });

      await logAdminAudit(auth.service, {
        actorId: auth.userId,
        action: "admin.episodes.facebook_schedule",
        targetTable: "external_posts",
        targetId: episodeId,
        meta: { scheduled_for: scheduleForIso, episode_slug: episodeSlug },
        ...reqMeta
      });

      return NextResponse.json({
        ok: true,
        queued: true,
        jobId,
        scheduledFor: scheduleForIso
      });
    }

    jobId = await createAutomationJob(auth.service, {
      jobType: "facebook_post_episode",
      source: "facebook",
      title: title || "Publicar episodio en Facebook",
      contentType: "episode",
      contentId: episodeId,
      payload: {
        episodeId,
        title,
        description,
        sourceUrl: sourceUrl || null,
        customText: customText || null,
        episodeSlug
      },
      status: "running",
      createdBy: auth.userId
    });

    await logPipelineEvent(auth.service, {
      jobId,
      stage: "social",
      status: "info",
      contentType: "episode",
      contentId: episodeId,
      platform: "Facebook",
      message: "Inicio de publicación de episodio en Facebook",
      actorId: auth.userId
    });

    const posted = await postEpisodeToFacebook({
      episodeId,
      episodeSlug,
      title,
      description,
      sourceUrl: sourceUrl || null,
      customText: customText || null
    });

    await auth.service.from("external_posts").upsert(
      {
        platform: "Facebook",
        external_id: String(posted.postId ?? `episode-${episodeId}`),
        title: title || null,
        caption: customText || description || null,
        media_url: null,
        metrics: null,
        posted_at: new Date().toISOString(),
        source_url: posted.link
      },
      { onConflict: "platform,external_id", ignoreDuplicates: true }
    );

    await logPipelineEvent(auth.service, {
      jobId,
      stage: "social",
      status: "ok",
      contentType: "episode",
      contentId: episodeId,
      platform: "Facebook",
      message: "Episodio publicado en Facebook",
      meta: { postId: posted.postId ?? null, link: posted.link },
      actorId: auth.userId
    });

    await updateAutomationJob(auth.service, jobId, {
      status: "done",
      attempts: 1,
      finishedAt: new Date().toISOString(),
      payload: {
        title,
        description,
        link: posted.link,
        postId: posted.postId ?? null,
        customText: customText || null
      }
    });

    await logAdminAudit(auth.service, {
      actorId: auth.userId,
      action: "admin.episodes.facebook_post",
      targetTable: "external_posts",
      targetId: episodeId,
      meta: { post_id: posted.postId ?? null, link: posted.link, episode_slug: episodeSlug },
      ...reqMeta
    });

    return NextResponse.json({ ok: true, result: { id: posted.postId }, link: posted.link, message: posted.message });
  } catch (e: any) {
    if (jobId) {
      try {
        const auth = await requireStaffApi(request, "manage_news");
        if (auth.ok) {
          await logPipelineEvent(auth.service, {
            jobId,
            stage: "failed",
            status: "error",
            platform: "Facebook",
            message: e?.message ?? "Unknown error",
            actorId: auth.userId
          });
          await updateAutomationJob(auth.service, jobId, {
            status: "failed",
            attempts: 1,
            error: e?.message ?? "Unknown error",
            finishedAt: new Date().toISOString()
          });
        }
      } catch {
        // no-op
      }
    }
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
