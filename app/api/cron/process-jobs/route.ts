import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAutomationJob, logPipelineEvent, updateAutomationJob } from "@/lib/pipelineOps";
import { postBlogToFacebook, postConfessionToFacebook, postNewsToFacebook } from "@/lib/socialFacebook";
import { postNewsToInstagram } from "@/lib/socialInstagram";
import { rewriteNewsWithAI } from "@/lib/newsRewrite";
import { publishFromSocialQueue } from "@/lib/social/publisher";
import { cleanNewsCategories } from "@/lib/newsCategories";
import { publishFacebookEpisodeAutomationJob } from "@/lib/facebookEpisodeJobs";

type QueueJob = {
  id: string;
  job_type: string;
  source: string | null;
  status: "queued" | "running" | "done" | "failed" | "cancelled";
  payload: Record<string, any> | null;
  content_type: string | null;
  content_id: string | null;
  attempts: number;
  max_attempts: number;
};

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !serviceKey) throw new Error("Faltan variables de Supabase para cron.");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function isCronAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return false;
  const auth = request.headers.get("authorization") ?? "";
  if (auth === secret) return true;
  if (auth === `Bearer ${secret}`) return true;
  if ((request.headers.get("x-cron-secret") ?? "") === secret) return true;
  if ((request.nextUrl.searchParams.get("secret") ?? "") === secret) return true;
  return false;
}

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized cron call." }, { status: 401 });
  }

  const service = getServiceClient();
  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await service
      .from("automation_jobs")
      .select("id, job_type, source, status, payload, content_type, content_id, attempts, max_attempts")
      .eq("status", "queued")
      .lte("scheduled_for", nowIso)
      .order("priority", { ascending: true })
      .order("scheduled_for", { ascending: true })
      .limit(20);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    const jobs = (data ?? []) as QueueJob[];

    let done = 0;
    let failed = 0;
    let skipped = 0;

    for (const job of jobs) {
      const nextAttempts = Number(job.attempts ?? 0) + 1;
      await updateAutomationJob(service, job.id, {
        status: "running",
        attempts: nextAttempts,
        startedAt: new Date().toISOString(),
        error: null
      });

      try {
        if (job.job_type === "facebook_post_news") {
          const newsId = String(job.payload?.newsId ?? job.content_id ?? "").trim();
          const title = String(job.payload?.title ?? "").trim();
          const summary = String(job.payload?.summary ?? "").trim();
          if (!newsId) throw new Error("Job inválido: falta newsId.");

          const posted = await postNewsToFacebook({ newsId, title, summary });

          await service.from("external_posts").upsert(
            {
              platform: "Facebook",
              external_id: posted.postId || `news-${newsId}`,
              title: title || null,
              caption: summary || null,
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
            contentType: "news",
            contentId: newsId,
            platform: "Facebook",
            message: "Post publicado por worker",
            meta: { postId: posted.postId, link: posted.link }
          });
          await updateAutomationJob(service, job.id, {
            status: "done",
            finishedAt: new Date().toISOString(),
            payload: { ...(job.payload ?? {}), postId: posted.postId, link: posted.link }
          });
          done += 1;
          continue;
        }

        if (job.job_type === "facebook_post_blog") {
          const blogId = String(job.payload?.blogId ?? job.content_id ?? "").trim();
          let blogSlug = String(job.payload?.blogSlug ?? "").trim();
          let title = String(job.payload?.title ?? "").trim();
          let excerpt = String(job.payload?.excerpt ?? "").trim();
          if (!blogId) throw new Error("Job inválido: falta blogId.");

          if (!title || !excerpt || !blogSlug) {
            const blogRes = await service
              .from("blog_posts")
              .select("slug, title, excerpt")
              .eq("id", blogId)
              .limit(1)
              .maybeSingle();

            if (blogRes.error) throw new Error(blogRes.error.message);
            const row = blogRes.data as { slug?: string | null; title?: string | null; excerpt?: string | null } | null;
            if (!row) throw new Error("No se encontró el artículo del blog para publicar.");
            if (!blogSlug) blogSlug = String(row.slug ?? "").trim();
            if (!title) title = String(row.title ?? "").trim();
            if (!excerpt) excerpt = String(row.excerpt ?? "").trim();
          }

          const posted = await postBlogToFacebook({ blogId, blogSlug: blogSlug || null, title, excerpt });

          await service.from("external_posts").upsert(
            {
              platform: "Facebook",
              external_id: posted.postId || `blog-${blogId}`,
              title: title || null,
              caption: excerpt || null,
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
            contentType: "blog",
            contentId: blogId,
            platform: "Facebook",
            message: "Blog publicado por worker",
            meta: { postId: posted.postId, link: posted.link }
          });
          await updateAutomationJob(service, job.id, {
            status: "done",
            finishedAt: new Date().toISOString(),
            payload: { ...(job.payload ?? {}), blogSlug: blogSlug || null, title, excerpt, postId: posted.postId, link: posted.link }
          });
          done += 1;
          continue;
        }

        if (job.job_type === "instagram_post_news") {
          const newsId = String(job.payload?.newsId ?? job.content_id ?? "").trim();
          let newsSlug = String(job.payload?.newsSlug ?? "").trim();
          let title = String(job.payload?.title ?? "").trim();
          let summary = String(job.payload?.summary ?? "").trim();
          let coverUrl = String(job.payload?.coverUrl ?? "").trim();
          if (!newsId) throw new Error("Job inválido: falta newsId.");

          if (!coverUrl || !title || !summary || !newsSlug) {
            const newsRes = await service
              .from("news_items")
              .select("slug, title, summary, cover_url")
              .eq("id", newsId)
              .limit(1)
              .maybeSingle();

            if (newsRes.error) throw new Error(newsRes.error.message);
            const row = newsRes.data as { slug?: string | null; title?: string | null; summary?: string | null; cover_url?: string | null } | null;
            if (!row) throw new Error("No se encontró la noticia para Instagram.");
            if (!newsSlug) newsSlug = String(row.slug ?? "").trim();
            if (!title) title = String(row.title ?? "").trim();
            if (!summary) summary = String(row.summary ?? "").trim();
            if (!coverUrl) coverUrl = String(row.cover_url ?? "").trim();
          }

          const posted = await postNewsToInstagram({ newsId, newsSlug, title, summary, coverUrl });

          await service.from("external_posts").upsert(
            {
              platform: "Instagram",
              external_id: posted.mediaId || `news-${newsId}`,
              title: title || null,
              caption: summary || null,
              media_url: coverUrl || null,
              metrics: null,
              posted_at: new Date().toISOString(),
              source_url: posted.articleUrl
            },
            { onConflict: "platform,external_id", ignoreDuplicates: true }
          );

          await logPipelineEvent(service, {
            jobId: job.id,
            stage: "social",
            status: "ok",
            contentType: "news",
            contentId: newsId,
            platform: "Instagram",
            message: "Post publicado por worker",
            meta: { mediaId: posted.mediaId, link: posted.articleUrl }
          });

          await updateAutomationJob(service, job.id, {
            status: "done",
            finishedAt: new Date().toISOString(),
            payload: {
              ...(job.payload ?? {}),
              newsSlug: newsSlug || null,
              title,
              summary,
              coverUrl: coverUrl || null,
              mediaId: posted.mediaId,
              link: posted.articleUrl
            }
          });
          done += 1;
          continue;
        }

        if (job.job_type === "facebook_post_episode") {
          await publishFacebookEpisodeAutomationJob(service, job);
          done += 1;
          continue;
        }

        if (job.job_type === "facebook_post_confession") {
          const confessionId = String(job.payload?.confessionId ?? job.content_id ?? "").trim();
          let title = String(job.payload?.title ?? "").trim();
          let body = String(job.payload?.body ?? "").trim();
          if (!confessionId) throw new Error("Job invalido: falta confessionId.");

          if (!title || !body) {
            const confessionRes = await service
              .from("confessions")
              .select("id, title, body, status, level")
              .eq("id", confessionId)
              .limit(1)
              .maybeSingle();

            if (confessionRes.error) throw new Error(confessionRes.error.message);
            const row = confessionRes.data as { id?: string; title?: string | null; body?: string | null; status?: string | null; level?: string | null } | null;
            if (!row?.id) throw new Error("No se encontro la confesion para Facebook.");
            if (String(row.status ?? "") !== "published" || String(row.level ?? "public") !== "public") {
              throw new Error("Confesion no publica: bloqueada para Facebook.");
            }
            if (!title) title = String(row.title ?? "").trim();
            if (!body) body = String(row.body ?? "").trim();
          }

          const posted = await postConfessionToFacebook({ confessionId, title, body });

          await service.from("external_posts").upsert(
            {
              platform: "Facebook",
              external_id: posted.postId || `confession-${confessionId}`,
              title: title || "Confesion anonima",
              caption: String(job.payload?.teaser ?? "").trim() || null,
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
            contentType: "confession",
            contentId: confessionId,
            platform: "Facebook",
            message: "Confesion publicada en Facebook por worker",
            meta: { postId: posted.postId, link: posted.link }
          });
          await updateAutomationJob(service, job.id, {
            status: "done",
            finishedAt: new Date().toISOString(),
            payload: { ...(job.payload ?? {}), title, body, postId: posted.postId, link: posted.link }
          });
          done += 1;
          continue;
        }

        if (job.job_type === "rewrite_news") {
          const newsId = String(job.payload?.newsId ?? job.content_id ?? "").trim();
          if (!newsId) throw new Error("Job inválido: falta newsId para rewrite_news.");

          const newsResp = await service
            .from("news_items")
            .select(
              "id, title, summary, analysis, source_url, categories, tags, publication_state, published_at, raw_title, raw_summary, raw_body"
            )
            .eq("id", newsId)
            .limit(1)
            .maybeSingle();

          if (newsResp.error) throw new Error(newsResp.error.message);
          if (!newsResp.data) throw new Error("No se encontró la noticia para reescritura.");

          const news = newsResp.data as {
            id: string;
            title: string | null;
            summary: string | null;
            analysis: string | null;
            source_url: string | null;
            categories: string[] | null;
            tags: string[] | null;
            publication_state: "draft" | "published" | null;
            published_at: string | null;
            raw_title?: string | null;
            raw_summary?: string | null;
            raw_body?: string | null;
          };

          await service
            .from("news_items")
            .update({ rewrite_status: "processing", rewrite_error: null })
            .eq("id", newsId);

          const rewritten = await rewriteNewsWithAI({
            sourceName: String(job.payload?.sourceName ?? job.source ?? "RSS"),
            sourceUrl: String(news.source_url ?? ""),
            originalTitle: String(news.raw_title ?? news.title ?? ""),
            originalSummary: String(news.raw_summary ?? news.summary ?? ""),
            originalBody: String(news.raw_body ?? ""),
            currentCategories: news.categories ?? [],
            currentTags: news.tags ?? []
          });

          const shouldPublish = job.payload?.shouldPublish === true && rewritten.needsReview !== true;
          const nextPublishedAt = shouldPublish
            ? String(job.payload?.publishedAt ?? news.published_at ?? new Date().toISOString())
            : null;
          const rewrittenCategories = cleanNewsCategories(rewritten.categories);
          const currentCategories = cleanNewsCategories(news.categories ?? []);
          const nextCategories = rewrittenCategories.length > 0 ? rewrittenCategories : currentCategories;

          const update = await service
            .from("news_items")
            .update({
              title: rewritten.title,
              summary: rewritten.summary || null,
              analysis: rewritten.analysis || null,
              categories: nextCategories.length > 0 ? nextCategories : ["Mundo"],
              tags: rewritten.tags.length > 0 ? rewritten.tags : news.tags,
              publication_state: shouldPublish ? "published" : "draft",
              published_at: nextPublishedAt,
              rewrite_status: "done",
              rewrite_error: null,
              rewritten_at: new Date().toISOString(),
              ai_model: rewritten.model,
              ai_provider: "openai",
              needs_review: rewritten.needsReview
            })
            .eq("id", newsId);

          if (update.error) throw new Error(update.error.message);

          await logPipelineEvent(service, {
            jobId: job.id,
            stage: shouldPublish ? "published" : "draft",
            status: rewritten.needsReview ? "info" : "ok",
            contentType: "news",
            contentId: newsId,
            message: rewritten.needsReview
              ? "Reescritura IA completada (requiere revisión)"
              : shouldPublish
                ? "Reescritura IA completada y publicada"
                : "Reescritura IA completada"
          });

          if (shouldPublish && job.payload?.autoPostFacebook === true) {
            await createAutomationJob(service, {
              jobType: "facebook_post_news",
              source: "facebook",
              title: rewritten.title,
              contentType: "news",
              contentId: newsId,
              payload: { newsId, title: rewritten.title, summary: rewritten.summary },
              status: "queued",
              priority: 40,
              scheduledFor: new Date().toISOString()
            });
            await logPipelineEvent(service, {
              jobId: job.id,
              stage: "social",
              status: "info",
              contentType: "news",
              contentId: newsId,
              platform: "Facebook",
              message: "Post a Facebook en cola tras reescritura IA"
            });
          }

          await updateAutomationJob(service, job.id, {
            status: "done",
            finishedAt: new Date().toISOString(),
            payload: {
              ...(job.payload ?? {}),
              model: rewritten.model,
              needsReview: rewritten.needsReview,
              published: shouldPublish
            }
          });
          done += 1;
          continue;
        }

        await logPipelineEvent(service, {
          jobId: job.id,
          stage: "failed",
          status: "error",
          contentType: job.content_type,
          contentId: job.content_id,
          message: `Job type no soportado: ${job.job_type}`
        });
        await updateAutomationJob(service, job.id, {
          status: "failed",
          finishedAt: new Date().toISOString(),
          error: `Job type no soportado: ${job.job_type}`
        });
        skipped += 1;
      } catch (e: any) {
        const exceeded = nextAttempts >= Number(job.max_attempts ?? 3);
        await logPipelineEvent(service, {
          jobId: job.id,
          stage: "failed",
          status: "error",
          contentType: job.content_type,
          contentId: job.content_id,
          message: e?.message ?? "Error procesando job",
          meta: { attempt: nextAttempts, max_attempts: job.max_attempts }
        });
        if (job.job_type === "rewrite_news" && job.content_id) {
          try {
            await service
              .from("news_items")
              .update({ rewrite_status: "failed", rewrite_error: e?.message ?? "Error de reescritura IA" })
              .eq("id", job.content_id);
          } catch {
            // no-op
          }
        }
        await updateAutomationJob(service, job.id, {
          status: exceeded ? "failed" : "queued",
          finishedAt: exceeded ? new Date().toISOString() : null,
          error: e?.message ?? "Error procesando job"
        });
        failed += 1;
      }
    }

    const socialQueue = await publishFromSocialQueue(service, 20).catch(() => ({
      queued: 0,
      done: 0,
      failed: 0
    }));

    return NextResponse.json({
      ok: true,
      total: jobs.length,
      done,
      failed,
      skipped,
      socialQueue
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
