import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/adminAuth";
import { createAutomationJob, logPipelineEvent, updateAutomationJob } from "@/lib/pipelineOps";
import { postBlogToFacebook } from "@/lib/socialFacebook";
import { getRequestAuditMeta, logAdminAudit } from "@/lib/adminAudit";

type BlogRow = {
  id: string;
  slug: string | null;
  title: string | null;
  excerpt: string | null;
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
    const scheduleForRaw = String(body?.scheduleFor ?? "").trim();

    if (!blogId) return NextResponse.json({ ok: false, error: "blogId requerido." }, { status: 400 });

    if (!title || !excerpt || !blogSlug) {
      const blogRes = await auth.service
        .from("blog_posts")
        .select("id, slug, title, excerpt")
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
    }

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
        jobType: "facebook_post_blog",
        source: "facebook",
        title: title || "Programar blog en Facebook",
        contentType: "blog",
        contentId: blogId,
        payload: { blogId, title, excerpt, blogSlug: blogSlug || null },
        status: "queued",
        priority: 40,
        scheduledFor: scheduleForIso,
        createdBy: auth.userId
      });

      await logPipelineEvent(auth.service, {
        jobId,
        stage: "social",
        status: "info",
        contentType: "blog",
        contentId: blogId,
        platform: "Facebook",
        message: "Post de blog programado para Facebook",
        meta: { scheduled_for: scheduleForIso },
        actorId: auth.userId
      });

      await logAdminAudit(auth.service, {
        actorId: auth.userId,
        action: "admin.blog.facebook_schedule",
        targetTable: "blog_posts",
        targetId: blogId,
        meta: { scheduled_for: scheduleForIso },
        ...reqMeta
      });

      return NextResponse.json({ ok: true, queued: true, jobId, scheduledFor: scheduleForIso });
    }

    jobId = await createAutomationJob(auth.service, {
      jobType: "facebook_post_blog",
      source: "facebook",
      title: title || "Publicar blog en Facebook",
      contentType: "blog",
      contentId: blogId,
      payload: { blogId, title, excerpt, blogSlug: blogSlug || null },
      status: "running",
      createdBy: auth.userId
    });

    await logPipelineEvent(auth.service, {
      jobId,
      stage: "social",
      status: "info",
      contentType: "blog",
      contentId: blogId,
      platform: "Facebook",
      message: "Inicio de publicación de blog en Facebook",
      actorId: auth.userId
    });

    const posted = await postBlogToFacebook({ blogId, blogSlug: blogSlug || null, title, excerpt });

    await auth.service.from("external_posts").upsert(
      {
        platform: "Facebook",
        external_id: String(posted.postId ?? `blog-${blogId}`),
        title: title || null,
        caption: excerpt || null,
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
      contentType: "blog",
      contentId: blogId,
      platform: "Facebook",
      message: "Blog publicado en Facebook",
      meta: { postId: posted.postId ?? null, link: posted.link },
      actorId: auth.userId
    });

    await updateAutomationJob(auth.service, jobId, {
      status: "done",
      attempts: 1,
      finishedAt: new Date().toISOString(),
      payload: { title, excerpt, link: posted.link, postId: posted.postId ?? null }
    });

    await logAdminAudit(auth.service, {
      actorId: auth.userId,
      action: "admin.blog.facebook_post",
      targetTable: "blog_posts",
      targetId: blogId,
      meta: { post_id: posted.postId ?? null, link: posted.link },
      ...reqMeta
    });

    return NextResponse.json({ ok: true, result: { id: posted.postId }, link: posted.link });
  } catch (e: any) {
    if (jobId) {
      try {
        const auth = await requireStaffApi(request, "manage_blog");
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
