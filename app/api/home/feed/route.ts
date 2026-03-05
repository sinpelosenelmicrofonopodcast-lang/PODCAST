import { NextRequest, NextResponse } from "next/server";
import { queryHomepageFeedPage } from "@/lib/homepageQueries";

export async function GET(request: NextRequest) {
  try {
    const cursor = String(request.nextUrl.searchParams.get("cursor") ?? "").trim() || null;
    const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "12");
    const limit = Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 12;
    const excludeRaw = String(request.nextUrl.searchParams.get("exclude") ?? "").trim();
    const exclude = excludeRaw
      ? excludeRaw
          .split(",")
          .map((v) => decodeURIComponent(String(v ?? "").trim()))
          .filter(Boolean)
      : [];

    const data = await queryHomepageFeedPage(cursor, limit, exclude);

    return NextResponse.json(
      { ok: true, ...data },
      {
        headers: {
          "Cache-Control": cursor ? "public, s-maxage=30, stale-while-revalidate=120" : "public, s-maxage=60, stale-while-revalidate=240"
        }
      }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
