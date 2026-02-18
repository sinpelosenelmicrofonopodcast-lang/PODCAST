import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminApi } from "@/lib/adminAuth";

function getClients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  const service = createClient(url, serviceKey);
  return { service };
}

type ExternalPost = {
  id: string;
  platform: string | null;
  posted_at: string | null;
  metrics: any | null;
};

function normalizePlatform(value?: string | null) {
  const raw = String(value ?? "").toLowerCase().trim();
  if (raw.includes("youtube")) return "YouTube";
  if (raw.includes("instagram")) return "Instagram";
  if (raw.includes("facebook")) return "Facebook";
  if (raw.includes("tiktok") || raw.includes("tik tok")) return "TikTok";
  return "Other";
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminApi(request);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const { service } = getClients();
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(dayStart);
    weekStart.setDate(dayStart.getDate() - 6);
    const monthStart = new Date(dayStart);
    monthStart.setDate(dayStart.getDate() - 29);
    const chartStart = new Date(dayStart);
    chartStart.setDate(dayStart.getDate() - 13);

    const [postsResp, visitsResp] = await Promise.all([
      service.from("external_posts").select("id, platform, posted_at, metrics").order("posted_at", { ascending: false }).limit(2000),
      service
        .from("page_visits")
        .select("visitor_id, visited_at")
        .gte("visited_at", monthStart.toISOString())
        .order("visited_at", { ascending: false })
        .limit(50000)
    ]);

    if (postsResp.error) return NextResponse.json({ ok: false, error: postsResp.error.message }, { status: 400 });
    if (visitsResp.error) return NextResponse.json({ ok: false, error: visitsResp.error.message }, { status: 400 });

    const posts = (postsResp.data ?? []) as ExternalPost[];
    const visits = (visitsResp.data ?? []) as Array<{ visitor_id: string; visited_at: string }>;

    const platformAgg: Record<
      string,
      { posts: number; views: number; likes: number; comments: number; shares: number; lastPostAt: string | null; shorts: number; long: number }
    > = {};

    for (const p of posts) {
      const key = normalizePlatform(p.platform);
      if (!platformAgg[key]) {
        platformAgg[key] = { posts: 0, views: 0, likes: 0, comments: 0, shares: 0, lastPostAt: null, shorts: 0, long: 0 };
      }
      const m = (p.metrics ?? {}) as any;
      platformAgg[key].posts += 1;
      platformAgg[key].views += Number(m.views ?? 0);
      platformAgg[key].likes += Number(m.likes ?? 0);
      platformAgg[key].comments += Number(m.comments ?? 0);
      platformAgg[key].shares += Number(m.shares ?? 0);
      if (m.isShort === true) platformAgg[key].shorts += 1;
      if (m.isShort === false) platformAgg[key].long += 1;
      if (!platformAgg[key].lastPostAt || (p.posted_at && p.posted_at > platformAgg[key].lastPostAt!)) {
        platformAgg[key].lastPostAt = p.posted_at ?? platformAgg[key].lastPostAt;
      }
    }

    const dayVisitors = new Set<string>();
    const weekVisitors = new Set<string>();
    const monthVisitors = new Set<string>();
    let dayVisits = 0;
    let weekVisits = 0;
    let monthVisits = 0;

    const visitsByDay = new Map<string, { visits: number; visitors: Set<string> }>();
    for (let i = 0; i < 14; i += 1) {
      const d = new Date(chartStart);
      d.setDate(chartStart.getDate() + i);
      visitsByDay.set(dayKey(d), { visits: 0, visitors: new Set() });
    }

    for (const v of visits) {
      const t = new Date(v.visited_at);
      if (t >= monthStart) {
        monthVisits += 1;
        monthVisitors.add(v.visitor_id);
      }
      if (t >= weekStart) {
        weekVisits += 1;
        weekVisitors.add(v.visitor_id);
      }
      if (t >= dayStart) {
        dayVisits += 1;
        dayVisitors.add(v.visitor_id);
      }

      if (t >= chartStart) {
        const k = dayKey(t);
        const row = visitsByDay.get(k);
        if (row) {
          row.visits += 1;
          row.visitors.add(v.visitor_id);
        }
      }
    }

    const chart = Array.from(visitsByDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, row]) => ({ date, visits: row.visits, unique: row.visitors.size }));

    return NextResponse.json({
      ok: true,
      website: {
        day: { visits: dayVisits, unique: dayVisitors.size },
        week: { visits: weekVisits, unique: weekVisitors.size },
        month: { visits: monthVisits, unique: monthVisitors.size },
        chart14d: chart
      },
      platforms: platformAgg
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
