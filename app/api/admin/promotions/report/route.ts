import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function csv(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const auth = await requireStaffApi(request, "manage_promotions");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [promosResp, eventsResp] = await Promise.all([
    auth.service
      .from("promotions")
      .select("id,title,advertiser,campaign_id,creative_id,placement,is_active,starts_at,ends_at,revenue_cents,frequency_cap,daily_cap,max_impressions")
      .order("display_order", { ascending: true }),
    auth.service
      .from("promotion_events")
      .select("promotion_id,event,session_id,placement,created_at")
      .gte("created_at", since)
      .limit(50000),
  ]);

  if (promosResp.error || eventsResp.error) {
    return NextResponse.json({ ok: false, error: promosResp.error?.message ?? eventsResp.error?.message }, { status: 400 });
  }

  const metrics = new Map<string, { impressions: number; clicks: number; dismissals: number; sessions: Set<string>; placements: Set<string> }>();
  for (const promo of promosResp.data ?? []) metrics.set(String(promo.id), { impressions: 0, clicks: 0, dismissals: 0, sessions: new Set(), placements: new Set() });
  for (const event of eventsResp.data ?? []) {
    const row = metrics.get(String(event.promotion_id));
    if (!row) continue;
    if (event.event === "impression") row.impressions += 1;
    if (event.event === "click") row.clicks += 1;
    if (event.event === "dismiss") row.dismissals += 1;
    if (event.session_id) row.sessions.add(String(event.session_id));
    if (event.placement) row.placements.add(String(event.placement));
  }

  const header = [
    "title","advertiser","campaign_id","creative_id","active","placement","impressions","clicks","ctr","unique_sessions","dismissals","frequency_cap","daily_cap","max_impressions","revenue_usd","starts_at","ends_at"
  ];
  const lines = [header.map(csv).join(",")];

  for (const promo of promosResp.data ?? []) {
    const row = metrics.get(String(promo.id)) ?? { impressions: 0, clicks: 0, dismissals: 0, sessions: new Set<string>(), placements: new Set<string>() };
    const ctr = row.impressions ? ((row.clicks / row.impressions) * 100).toFixed(2) : "0.00";
    lines.push([
      promo.title,
      promo.advertiser,
      promo.campaign_id,
      promo.creative_id,
      promo.is_active ? "yes" : "no",
      Array.from(row.placements).join("|") || promo.placement,
      row.impressions,
      row.clicks,
      ctr,
      row.sessions.size,
      row.dismissals,
      promo.frequency_cap,
      promo.daily_cap,
      promo.max_impressions,
      (Number(promo.revenue_cents ?? 0) / 100).toFixed(2),
      promo.starts_at,
      promo.ends_at,
    ].map(csv).join(","));
  }

  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sin-pelos-sponsors-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
