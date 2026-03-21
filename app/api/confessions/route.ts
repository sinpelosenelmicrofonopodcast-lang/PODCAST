import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabaseService";
import { getUserIdFromBearer } from "@/lib/authToken";
import { checkRateLimit } from "@/lib/validations/rateLimit";
import { asBoolean, asOptionalString, asString } from "@/lib/validations/common";
import { buildConfessionHeadline, buildConfessionPreview } from "@/lib/confessions";
import { createAutomationJob } from "@/lib/pipelineOps";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
    const limited = checkRateLimit(`api:confessions:${ip}`, 3, 15 * 60_000);
    if (!limited.ok) {
      return NextResponse.json({ ok: false, error: "Límite alcanzado. Intenta más tarde." }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const confessionBody = asString(body?.body, 3000);
    if (confessionBody.length < 10) {
      return NextResponse.json({ ok: false, error: "Confesión muy corta." }, { status: 400 });
    }

    const userId = await getUserIdFromBearer(request.headers.get("authorization"));
    const service = supabaseService();
    const nowIso = new Date().toISOString();
    const title = buildConfessionHeadline(confessionBody, asOptionalString(body?.title, 180));

    const insert = await service
      .from("confessions")
      .insert({
        title,
        body: confessionBody,
        media_url: asOptionalString(body?.mediaUrl, 600),
        is_anonymous: asBoolean(body?.isAnonymous, true),
        status: "published",
        category: asOptionalString(body?.category, 50),
        region: asOptionalString(body?.region, 30),
        created_by: userId,
        author_id: userId,
        level: "public",
        published_at: nowIso,
        approved_by: userId
      })
      .select("id,title,body,status,created_at,published_at")
      .limit(1)
      .maybeSingle();

    if (insert.error || !insert.data?.id) {
      return NextResponse.json({ ok: false, error: insert.error?.message ?? "No se pudo guardar." }, { status: 400 });
    }

    const confession = insert.data as { id: string; title?: string | null; body?: string | null; status?: string | null; created_at?: string | null; published_at?: string | null };

    await createAutomationJob(service, {
      jobType: "facebook_post_confession",
      source: "facebook",
      title: confession.title ?? title,
      contentType: "confession",
      contentId: confession.id,
      payload: {
        confessionId: confession.id,
        title: confession.title ?? title,
        teaser: buildConfessionPreview(confession.body ?? confessionBody)
      },
      status: "queued",
      priority: 40,
      createdBy: userId
    });

    return NextResponse.json({ ok: true, confession });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unknown error" }, { status: 500 });
  }
}
