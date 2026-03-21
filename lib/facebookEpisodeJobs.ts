import type { SupabaseClient } from "@supabase/supabase-js";
import { updateAutomationJob, logPipelineEvent } from "@/lib/pipelineOps";
import { postEpisodeToFacebook } from "@/lib/socialFacebook";
import { getYouTubeVideoId } from "@/lib/youtube";

type FacebookEpisodeJobPayload = Record<string, any> | null;

type PublishFacebookEpisodeJobInput = {
  id: string;
  payload: FacebookEpisodeJobPayload;
  content_id: string | null;
};

export async function publishFacebookEpisodeAutomationJob(
  service: SupabaseClient,
  job: PublishFacebookEpisodeJobInput,
  options?: { actorId?: string | null }
) {
  const actorId = options?.actorId ?? null;
  const payload = job.payload ?? {};
  const episodeId = String(payload.episodeId ?? job.content_id ?? "").trim();
  let episodeSlug = String(payload.episodeSlug ?? "").trim();
  let title = String(payload.title ?? "").trim();
  let description = String(payload.description ?? "").trim();
  let sourceUrl = String(payload.sourceUrl ?? "").trim();
  const customText = String(payload.customText ?? "").trim();

  if (!episodeId) {
    throw new Error("Job inválido: falta episodeId.");
  }

  if (!title || !description || !episodeSlug || !sourceUrl) {
    const externalRes = await service
      .from("external_posts")
      .select("id, title, caption, source_url")
      .eq("id", episodeId)
      .limit(1)
      .maybeSingle();

    if (externalRes.error) throw new Error(externalRes.error.message);
    const row = (externalRes.data ?? null) as { id?: string | null; title?: string | null; caption?: string | null; source_url?: string | null } | null;
    if (row) {
      if (!title) title = String(row.title ?? "").trim();
      if (!description) description = String(row.caption ?? "").trim();
      if (!sourceUrl) sourceUrl = String(row.source_url ?? "").trim();
      if (!episodeSlug) episodeSlug = getYouTubeVideoId(row.source_url) || String(row.id ?? "").trim();
    }
  }

  if (!title) title = "Nuevo episodio";
  if (!episodeSlug) episodeSlug = getYouTubeVideoId(sourceUrl) || episodeId;

  const posted = await postEpisodeToFacebook({
    episodeId,
    episodeSlug,
    title,
    description,
    sourceUrl: sourceUrl || null,
    customText: customText || null
  });

  await service.from("external_posts").upsert(
    {
      platform: "Facebook",
      external_id: posted.postId || `episode-${episodeId}`,
      title: title || null,
      caption: customText || description || null,
      media_url: null,
      metrics: null,
      posted_at: new Date().toISOString(),
      source_url: posted.link
    },
    { onConflict: "platform,external_id", ignoreDuplicates: true }
  );

  await logPipelineEvent(service, {
    jobId: job.id,
    stage: "social",
    status: "ok",
    contentType: "episode",
    contentId: episodeId,
    platform: "Facebook",
    message: "Episodio publicado por worker",
    meta: { postId: posted.postId, link: posted.link },
    actorId
  });

  await updateAutomationJob(service, job.id, {
    status: "done",
    finishedAt: new Date().toISOString(),
    payload: {
      ...(payload ?? {}),
      title,
      description,
      sourceUrl: sourceUrl || null,
      episodeSlug,
      customText: customText || null,
      postId: posted.postId,
      link: posted.link
    }
  });

  return {
    episodeId,
    episodeSlug,
    title,
    description,
    sourceUrl: sourceUrl || null,
    customText: customText || null,
    postId: posted.postId ?? null,
    link: posted.link
  };
}
