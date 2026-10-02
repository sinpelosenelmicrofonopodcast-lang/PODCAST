import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireStaffApi(request, "manage_news");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const { data, error } = await auth.service
    .from("editorial_runs")
    .select("id,mode,score,publication_recommendation,status,model,created_at,episode_source_id,result")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const items = (data ?? []).map((row: any) => ({
    id: row.id,
    mode: row.mode,
    score: row.score,
    publicationRecommendation: row.publication_recommendation,
    status: row.status,
    model: row.model,
    createdAt: row.created_at,
    episodeSourceId: row.episode_source_id,
    title: row.result?.draft?.title ?? row.result?.summary ?? "Análisis editorial"
  }));

  return NextResponse.json({ ok: true, items });
}
