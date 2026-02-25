import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { fetchYouTubeVideos, isShorts } from "@/lib/youtube";
import { requireStaffApi } from "@/lib/adminAuth";
import { createAutomationJob, logPipelineEvent, updateAutomationJob } from "@/lib/pipelineOps";

export async function POST(request: NextRequest) {
  let jobId = "";
  try {
    const auth = await requireStaffApi(request, "manage_news_sources");
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    jobId = await createAutomationJob(auth.service, {
      jobType: "youtube_sync",
      source: "youtube",
      title: "Sincronización YouTube",
      status: "running",
      createdBy: auth.userId
    });
    await logPipelineEvent(auth.service, {
      jobId,
      stage: "ingested",
      status: "info",
      platform: "YouTube",
      message: "Inicio de sincronización de YouTube",
      actorId: auth.userId
    });

    const supabase = supabaseServer();
    const videos = await fetchYouTubeVideos(25);
    const ids = videos.map((video) => video.id);

    const { data: existing } = await supabase
      .from("external_posts")
      .select("external_id")
      .eq("platform", "YouTube")
      .in("external_id", ids);

    const existingIds = new Set((existing ?? []).map((row) => row.external_id));

    const inserts = videos
      .filter((video) => !existingIds.has(video.id))
      .map((video) => ({
        platform: "YouTube",
        external_id: video.id,
        title: video.title,
        caption: video.description,
        media_url: video.thumbnailUrl,
        metrics: {
          views: video.viewCount,
          likes: video.likeCount,
          comments: video.commentCount,
          durationSeconds: video.durationSeconds,
          isShort: isShorts(video.durationSeconds)
        },
        posted_at: video.publishedAt,
        source_url: isShorts(video.durationSeconds)
          ? `https://www.youtube.com/shorts/${video.id}`
          : `https://www.youtube.com/watch?v=${video.id}`
      }));

    if (inserts.length > 0) {
      const upsertRes = await supabase.from("external_posts").upsert(inserts, {
        onConflict: "platform,external_id",
        ignoreDuplicates: true
      });
      if (upsertRes.error) throw new Error(upsertRes.error.message);
    }

    await logPipelineEvent(auth.service, {
      jobId,
      stage: "published",
      status: "ok",
      platform: "YouTube",
      message: "Sincronización completada",
      meta: {
        totalFetched: videos.length,
        inserted: inserts.length
      },
      actorId: auth.userId
    });
    await updateAutomationJob(auth.service, jobId, {
      status: "done",
      attempts: 1,
      finishedAt: new Date().toISOString(),
      payload: {
        totalFetched: videos.length,
        inserted: inserts.length
      }
    });

    return NextResponse.json({ ok: true, inserted: inserts.length });
  } catch (error: any) {
    if (jobId) {
      try {
        const admin = await requireStaffApi(request, "manage_news_sources");
        if (admin.ok) {
          await logPipelineEvent(admin.service, {
            jobId,
            stage: "failed",
            status: "error",
            platform: "YouTube",
            message: error?.message ?? "Unknown error",
            actorId: admin.userId
          });
          await updateAutomationJob(admin.service, jobId, {
            status: "failed",
            attempts: 1,
            error: error?.message ?? "Unknown error",
            finishedAt: new Date().toISOString()
          });
        }
      } catch {
        // no-op
      }
    }
    return NextResponse.json({ ok: false, error: error?.message ?? "Unknown error" }, { status: 500 });
  }
}
