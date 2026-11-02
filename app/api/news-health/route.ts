import { NextResponse } from "next/server";
import { loadNewsWire } from "@/lib/newsWire";
import { loadPublishedNewsBridge, loadArchivedNewsItem } from "@/lib/publicNewsBridge";

export const revalidate = 300;
const SMOKE_ID = "74f3aaaa-83ae-4514-a816-0f475a14d7c8";

export async function GET() {
  const [recent, radar, archive] = await Promise.allSettled([
    loadPublishedNewsBridge(),
    loadNewsWire(),
    loadArchivedNewsItem(SMOKE_ID)
  ]);
  const news = recent.status === "fulfilled" ? recent.value : [];
  const headlines = radar.status === "fulfilled" ? radar.value : [];
  const archived = archive.status === "fulfilled" && archive.value?.id === SMOKE_ID;
  const healthy = news.length > 0 && headlines.length > 0 && archived;
  return NextResponse.json({
    status: healthy ? "operational" : "degraded",
    checkedAt: new Date().toISOString(),
    publishedNewsCount: news.length,
    latestPublishedAt: news[0]?.published_at ?? null,
    latestPublishedTitle: news[0]?.title ?? null,
    liveHeadlines: headlines.length,
    permanentArchiveReadable: archived,
    editorialPublisher: "Google Workspace; separate service"
  }, {
    status: 200,
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300" }
  });
}
