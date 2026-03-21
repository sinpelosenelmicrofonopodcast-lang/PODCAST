import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/adminAuth";
import { asOptionalString, asString, asStringArray, parseDate, slugify } from "@/lib/validations/common";
import { buildSpmCoverPrompt } from "@/lib/news/spmCoverPrompt";

export async function GET(request: NextRequest) {
  const auth = await requireStaffApi(request, "manage_news");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const status = asOptionalString(request.nextUrl.searchParams.get("status"), 40);
    const region = asOptionalString(request.nextUrl.searchParams.get("region"), 20);
    const category = asOptionalString(request.nextUrl.searchParams.get("category"), 50);
    const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? 80);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, Math.floor(limitRaw))) : 80;

    let query = auth.service
      .from("news_articles")
      .select("id, slug, title, status, category, region, summary, published_at, publish_at, trending_score, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) query = query.eq("status", status);
    if (region) query = query.eq("region", region);
    if (category) query = query.eq("category", category);

    const { data, error } = await query;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, items: data ?? [] });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireStaffApi(request, "manage_news");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const body = await request.json().catch(() => ({}));
    const title = asString(body?.title, 220);
    if (!title) return NextResponse.json({ ok: false, error: "title es requerido." }, { status: 400 });

    const status = asString(body?.status || "draft", 32);
    const publishAt = parseDate(body?.publishAt);
    const nowIso = new Date().toISOString();
    const category = asOptionalString(body?.category, 50);
    const region = asOptionalString(body?.region, 20);
    const summary = asOptionalString(body?.summary, 500);
    const coverSpec = buildSpmCoverPrompt({
      title,
      summary,
      category,
      region
    });

    const payload = {
      title,
      slug: slugify(asString(body?.slug || title, 180)),
      summary,
      excerpt: asOptionalString(body?.excerpt, 700),
      original_content: asOptionalString(body?.content, 30000),
      rewritten_content: asOptionalString(body?.rewrittenContent, 30000),
      category,
      region,
      tags: asStringArray(body?.tags, 20, 40),
      source_url: asOptionalString(body?.sourceUrl, 600),
      cover_image_url: asOptionalString(body?.coverImageUrl, 2500),
      ai_metadata: {
        cover: {
          prompt: coverSpec.prompt,
          file_name: coverSpec.fileName,
          headline: coverSpec.headline,
          subtitle: coverSpec.subtitle,
          visual_brief: coverSpec.visualBrief,
          layout: "spm_news_v1"
        }
      },
      status: ["draft", "pending_review", "scheduled", "published", "rejected", "archived"].includes(status) ? status : "draft",
      publish_at: publishAt,
      published_at: status === "published" ? publishAt || nowIso : null,
      created_by: auth.userId,
      updated_by: auth.userId
    };

    const { data, error } = await auth.service.from("news_articles").insert(payload).select("id,slug,status").limit(1).maybeSingle();
    if (error || !data?.id) return NextResponse.json({ ok: false, error: error?.message ?? "No se pudo crear." }, { status: 400 });

    return NextResponse.json({ ok: true, article: data });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unknown error" }, { status: 500 });
  }
}
