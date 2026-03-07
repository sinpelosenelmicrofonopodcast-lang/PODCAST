import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/adminAuth";
import { createAutomationJob, logPipelineEvent, updateAutomationJob } from "@/lib/pipelineOps";
import { postBlogToInstagram } from "@/lib/socialInstagram";
import { getRequestAuditMeta, logAdminAudit } from "@/lib/adminAudit";

type BlogRow = {
  id: string;
  slug: string | null;
  title: string | null;
  excerpt: string | null;
  cover_url: string | null;
};

export async function POST(request: NextRequest) {
  let jobId = "";
  try {
    const auth = await requireStaffApi(request, "manage_blog");
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const reqMeta = getRequestAuditMeta(request);

    const body = await request.json().catch(() => ({}));
    const blogId = String(body?.blogId ?? "").trim();
    let blogSlug = String(body?.blogSlug ?? "").trim();
    let title = String(body?.title ?? "").trim();
    let excerpt = String(body?.excerpt ?? "").trim();
    let coverUrl = String(body?.coverUrl ?? "").trim();

    if (!blogId) return NextResponse.json({ ok: false, error: "blogId requerido." }, { status: 400 });

    if (!title || !excerpt || !coverUrl || !blogSlug) {
      const blogRes = await auth.service
        .from("blog_posts")
        .select("id, slug, title, excerpt, cover_url")
        .eq("id", blogId)
        .limit(1)
        .maybeSingle();

      if (blogRes.error) {
        return NextResponse.json({ ok: false, error: blogRes.error.message }, { status: 400 });
      }

      const row = (blogRes.data ?? null) as BlogRow | null;
      if (!row) return NextResponse.json({ ok: false, error: "Artículo no encontrado." }, { status: 404 });

      if (!blogSlug) blogSlug = String(row.slug ?? "").trim();
      if (!title) title = String(row.title ?? "").trim();
      if (!excerpt) excerpt = String(row.excerpt ?? "").trim();
      if (!coverUrl) coverUrl = String(row.cover_url ?? "").trim();
    }

    if (!coverUrl) {
      return NextResponse.json(
        {
          ok: false,
          error: "Instagram requiere cover_url pública (imagen accesible por URL)."
        },
        { status: 400 }
      );
    }

    jobId = await createAutomationJob(auth.service, {
      jobType: "instagram_post_blog",
      source: "instagram",
      title: title || "Publicar blog en Instagram",
      contentType: "blog",
      contentId: blogId,
      payload: { title, excerpt, blogSlug: blogSlug || null, coverUrl },
      status: "running",
      createdBy: auth.userId
    });

    await logPipelineEvent(auth.service, {
      jobId,
      stage: "social",
      status: "info",
      contentType: "blog",
      contentId: blogId,
      platform: "Instagram",
      message: "Inicio de publicación de blog en Instagram",
      actorId: auth.userId
    });

    const posted = await postBlogToInstagram({ blogId, blogSlug: blogSlug || null, title, excerpt, coverUrl });

    await auth.service.from("external_posts").upsert(
      {
        platform: "Instagram",
        external_id: String(posted.mediaId ?? `blog-${blogId}`),
        title: title || null,
        caption: excerpt || null,
        media_url: coverUrl,
        metrics: null,
        posted_at: new Date().toISOString(),
        source_url: posted.articleUrl
      },
      { onConflict: "platform,external_id", ignoreDuplicates: true }
    );

    await logPipelineEvent(auth.service, {
      jobId,
      stage: "social",
      status: "ok",
      contentType: "blog",
      contentId: blogId,
      platform: "Instagram",
      message: "Blog publicado en Instagram",
      meta: { mediaId: posted.mediaId ?? null, link: posted.articleUrl },
      actorId: auth.userId
    });

    await updateAutomationJob(auth.service, jobId, {
      status: "done",
      attempts: 1,
      finishedAt: new Date().toISOString(),
      payload: { title, excerpt, coverUrl, link: posted.articleUrl, mediaId: posted.mediaId ?? null }
    });

    await logAdminAudit(auth.service, {
      actorId: auth.userId,
      action: "admin.blog.instagram_post",
      targetTable: "blog_posts",
      targetId: blogId,
      meta: { media_id: posted.mediaId ?? null, link: posted.articleUrl },
      ...reqMeta
    });

    return NextResponse.json({ ok: true, result: { id: posted.mediaId }, link: posted.articleUrl });
  } catch (e: any) {
    if (jobId) {
      try {
        const auth = await requireStaffApi(request, "manage_blog");
        if (auth.ok) {
          await logPipelineEvent(auth.service, {
            jobId,
            stage: "failed",
            status: "error",
            platform: "Instagram",
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
