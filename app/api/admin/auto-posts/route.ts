import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/adminAuth";
import { chicagoDateInputFromNow, chicagoDayBoundsUtc } from "@/lib/autoPosts";

const ALLOWED_STATUS = new Set(["queued", "publishing", "posted", "failed", "cancelled", "all"]);

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminApi(request);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const date = String(request.nextUrl.searchParams.get("date") ?? chicagoDateInputFromNow()).trim();
    const status = String(request.nextUrl.searchParams.get("status") ?? "all").trim().toLowerCase();
    if (!ALLOWED_STATUS.has(status)) {
      return NextResponse.json({ ok: false, error: "Filtro status inválido." }, { status: 400 });
    }

    const { startUtc, endUtcExclusive } = chicagoDayBoundsUtc(date);

    let query = auth.service
      .from("scheduled_posts")
      .select("id, platform, message, media_url, scheduled_for, status, posted_at, remote_id, error, created_by, created_at, updated_at")
      .eq("platform", "facebook_page")
      .gte("scheduled_for", startUtc)
      .lt("scheduled_for", endUtcExclusive)
      .order("scheduled_for", { ascending: true });

    if (status !== "all") query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    const items = data ?? [];
    const summary = items.reduce(
      (acc: { total: number; byStatus: Record<string, number> }, row: any) => {
        const key = String(row.status ?? "queued");
        acc.total += 1;
        acc.byStatus[key] = (acc.byStatus[key] ?? 0) + 1;
        return acc;
      },
      { total: 0, byStatus: {} as Record<string, number> }
    );

    return NextResponse.json({
      ok: true,
      date,
      timezone: "America/Chicago",
      window: { startUtc, endUtcExclusive },
      summary,
      items
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
