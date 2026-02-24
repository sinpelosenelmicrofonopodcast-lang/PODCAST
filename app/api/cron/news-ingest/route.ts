import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  buildAutoAnalysis,
  computeNewsAutomationHash,
  inferCategories,
  inferTags,
  parseFeedXml,
  summarizeDescription,
  type NewsSource
} from "@/lib/newsAutomation";
import { createAutomationJob, logPipelineEvent, normalizeSourceUrl, updateAutomationJob } from "@/lib/pipelineOps";

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
  if (auth === `Bearer ${secret}`) return true;
  if ((request.headers.get("x-cron-secret") ?? "") === secret) return true;
  if ((request.nextUrl.searchParams.get("secret") ?? "") === secret) return true;
  return false;
}

async function queueFacebookPost(service: any, payload: { newsId: string; title: string; summary: string }) {
  await createAutomationJob(service, {
    jobType: "facebook_post_news",
    source: "facebook",
    title: payload.title,
    contentType: "news",
    contentId: payload.newsId,
    payload,
    status: "queued",
    priority: 40,
    scheduledFor: new Date().toISOString()
  });
}

async function insertNewsWithFallback(
  service: any,
  payload: {
    title: string;
    summary: string;
    analysis: string;
    sourceUrl: string;
    categories: string[];
    tags: string[];
    ingestSource: string;
    publicationState: "draft" | "published";
    publishedAt: string | null;
    rawTitle: string;
    rawSummary: string;
    rawBody: string;
    rewriteStatus: "queued" | "done";
  }
) {
  const primary = await service
    .from("news_items")
    .insert({
      title: payload.title,
      summary: payload.summary || null,
      analysis: payload.analysis,
      source_url: payload.sourceUrl,
      categories: payload.categories,
      tags: payload.tags,
      publication_state: payload.publicationState,
      published_at: payload.publishedAt,
      ingest_source: payload.ingestSource,
      raw_title: payload.rawTitle,
      raw_summary: payload.rawSummary || null,
      raw_body: payload.rawBody || null,
      rewrite_status: payload.rewriteStatus,
      rewrite_error: null,
      needs_review: false,
      raw_payload: {
        source: payload.ingestSource
      }
    })
    .select("id")
    .limit(1)
    .maybeSingle();

  if (!primary.error && primary.data?.id) return primary;

  const missingRewriteColumns = /(raw_title|raw_summary|raw_body|rewrite_status|raw_payload|needs_review)/i.test(
    primary.error?.message ?? ""
  );
  if (!missingRewriteColumns) return primary;

  return service
    .from("news_items")
    .insert({
      title: payload.title,
      summary: payload.summary || null,
      analysis: payload.analysis,
      source_url: payload.sourceUrl,
      categories: payload.categories,
      tags: payload.tags,
      publication_state: payload.publicationState,
      published_at: payload.publishedAt,
      ingest_source: payload.ingestSource
    })
    .select("id")
    .limit(1)
    .maybeSingle();
}

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized cron call." }, { status: 401 });
  }

  const service = getServiceClient();
  let rootJobId = "";
  try {
    const { data: sourcesData, error: sourcesError } = await service
      .from("news_sources")
      .select("id, name, rss_url, region, default_categories, auto_publish, auto_post_facebook, max_items_per_run")
      .eq("is_active", true)
      .order("updated_at", { ascending: false });

    if (sourcesError) {
      return NextResponse.json({ ok: false, error: sourcesError.message }, { status: 400 });
    }

    const sources = (sourcesData ?? []) as NewsSource[];
    const aiEnabled = Boolean(process.env.OPENAI_API_KEY);
    rootJobId = await createAutomationJob(service, {
      jobType: "news_ingest_run",
      source: "rss",
      title: "Ingesta automática de noticias",
      payload: { sourceCount: sources.length, aiEnabled },
      status: "running",
      priority: 30
    });
    await logPipelineEvent(service, {
      jobId: rootJobId,
      stage: "ingested",
      status: "info",
      contentType: "news",
      message: `Inicio de ingesta automática (${sources.length} fuentes)`
    });

    let scanned = 0;
    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const source of sources) {
      const sourceJobId = await createAutomationJob(service, {
        jobType: "news_ingest_source",
        source: source.name,
        title: source.name,
        payload: { rss_url: source.rss_url },
        status: "running",
        priority: 35
      });
      try {
        const res = await fetch(source.rss_url, { cache: "no-store" });
        if (!res.ok) throw new Error(`RSS HTTP ${res.status}`);
        const xml = await res.text();
        const items = parseFeedXml(xml);
        const slice = items.slice(0, Math.max(1, Number(source.max_items_per_run ?? 12)));

        for (const item of slice) {
          scanned += 1;
          const normalizedUrl = normalizeSourceUrl(item.link);
          if (!normalizedUrl) {
            skipped += 1;
            continue;
          }

          const summary = summarizeDescription(item.description);
          const analysis = buildAutoAnalysis({ sourceName: source.name, title: item.title, summary });
          const categories = inferCategories({
            region: source.region,
            title: item.title,
            description: summary,
            defaults: source.default_categories
          });
          const tags = inferTags(item.title, summary, categories);
          const hash = computeNewsAutomationHash({
            title: item.title,
            summary,
            analysis,
            sourceUrl: normalizedUrl
          });

          const { data: existing } = await service
            .from("news_items")
            .select("id")
            .eq("source_url", normalizedUrl)
            .eq("content_hash", hash)
            .limit(1)
            .maybeSingle();

          if (existing?.id) {
            skipped += 1;
            continue;
          }

          const shouldPublish = source.auto_publish !== false;
          const publicationState: "draft" | "published" = aiEnabled ? "draft" : shouldPublish ? "published" : "draft";
          const publishedAt = publicationState === "published" ? item.publishedAt ?? new Date().toISOString() : null;
          const rewriteStatus: "queued" | "done" = aiEnabled ? "queued" : "done";

          const insert = await insertNewsWithFallback(service, {
            title: item.title,
            summary,
            analysis,
            sourceUrl: normalizedUrl,
            categories,
            tags,
            ingestSource: source.name,
            publicationState,
            publishedAt,
            rawTitle: item.title,
            rawSummary: summary,
            rawBody: item.description ?? "",
            rewriteStatus
          });

          if (insert.error || !insert.data?.id) {
            // 23505 = duplicate key (race condition / same run)
            if (insert.error?.code === "23505") {
              skipped += 1;
              continue;
            }
            failed += 1;
            await logPipelineEvent(service, {
              jobId: sourceJobId,
              stage: "failed",
              status: "error",
              contentType: "news",
              message: insert.error?.message ?? "No se pudo insertar noticia",
              meta: { source: source.name, title: item.title }
            });
            continue;
          }

          created += 1;
          const newsId = insert.data.id as string;
          await logPipelineEvent(service, {
            jobId: sourceJobId,
            stage: "ingested",
            status: "ok",
            contentType: "news",
            contentId: newsId,
            message: "Noticia ingerida automáticamente",
            meta: { source: source.name, source_url: normalizedUrl }
          });
          await logPipelineEvent(service, {
            jobId: sourceJobId,
            stage: publicationState === "published" ? "published" : "draft",
            status: "ok",
            contentType: "news",
            contentId: newsId,
            message:
              publicationState === "published"
                ? "Noticia publicada automáticamente"
                : aiEnabled
                  ? "Noticia en borrador; reescritura IA en cola"
                  : "Noticia guardada como borrador"
          });

          if (aiEnabled) {
            await createAutomationJob(service, {
              jobType: "rewrite_news",
              source: source.name,
              title: item.title,
              contentType: "news",
              contentId: newsId,
              payload: {
                newsId,
                sourceName: source.name,
                shouldPublish,
                autoPostFacebook: source.auto_post_facebook === true,
                publishedAt: item.publishedAt ?? null
              },
              status: "queued",
              priority: 20,
              scheduledFor: new Date().toISOString()
            });
          } else if (shouldPublish && source.auto_post_facebook === true) {
            await queueFacebookPost(service, { newsId, title: item.title, summary });
            await logPipelineEvent(service, {
              jobId: sourceJobId,
              stage: "social",
              status: "info",
              contentType: "news",
              contentId: newsId,
              platform: "Facebook",
              message: "Post a Facebook en cola"
            });
          }
        }

        await service.from("news_sources").update({ last_scanned_at: new Date().toISOString() }).eq("id", source.id);
        await updateAutomationJob(service, sourceJobId, {
          status: "done",
          finishedAt: new Date().toISOString()
        });
      } catch (error: any) {
        failed += 1;
        await logPipelineEvent(service, {
          jobId: sourceJobId,
          stage: "failed",
          status: "error",
          contentType: "news",
          message: error?.message ?? "Error leyendo feed",
          meta: { source: source.name, rss_url: source.rss_url }
        });
        await updateAutomationJob(service, sourceJobId, {
          status: "failed",
          finishedAt: new Date().toISOString(),
          error: error?.message ?? "Error leyendo feed"
        });
      }
    }

    await logPipelineEvent(service, {
      jobId: rootJobId,
      stage: "published",
      status: failed > 0 ? "info" : "ok",
      contentType: "news",
      message: "Ciclo de ingesta completado",
      meta: { scanned, created, skipped, failed }
    });
    await updateAutomationJob(service, rootJobId, {
      status: failed > 0 ? "done" : "done",
      finishedAt: new Date().toISOString(),
      payload: { scanned, created, skipped, failed }
    });

    return NextResponse.json({ ok: true, scanned, created, skipped, failed });
  } catch (e: any) {
    if (rootJobId) {
      await logPipelineEvent(service, {
        jobId: rootJobId,
        stage: "failed",
        status: "error",
        contentType: "news",
        message: e?.message ?? "Error en ingesta automática"
      }).catch(() => null);
      await updateAutomationJob(service, rootJobId, {
        status: "failed",
        finishedAt: new Date().toISOString(),
        error: e?.message ?? "Error en ingesta automática"
      }).catch(() => null);
    }
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
