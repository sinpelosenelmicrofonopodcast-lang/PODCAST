import { NextResponse } from "next/server";
import { queryHomepageOverview } from "@/lib/homepageQueries";

export async function GET() {
  try {
    const data = await queryHomepageOverview();
    return NextResponse.json(
      { ok: true, ...data },
      { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" } }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
