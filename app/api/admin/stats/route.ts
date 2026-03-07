import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffApi } from "@/lib/adminAuth";

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

type VisitRow = {
  visitor_id: string;
  visited_at: string;
  country_code?: string | null;
  country?: string | null;
  city?: string | null;
};

const VISITS_SELECT_GEO = "visitor_id, visited_at, country_code, country, city";
const VISITS_SELECT_FALLBACK = "visitor_id, visited_at";
const VISITS_BATCH = 1000;
const VISITS_MAX_ROWS = 250000;

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

function toCountryName(code?: string | null) {
  const normalized = String(code ?? "")
    .trim()
    .toUpperCase();
  if (!normalized) return null;
  try {
    const display = new Intl.DisplayNames(["es"], { type: "region" }).of(normalized);
    return display ?? normalized;
  } catch {
    return normalized;
  }
}

function isMissingGeoColumnsError(message?: string | null) {
  const text = String(message ?? "");
  return /country_code|country|city/i.test(text) && /column/i.test(text);
}

async function loadVisits(service: any, monthStartIso: string) {
  const fetchAll = async (selectCols: string) => {
    const rows: VisitRow[] = [];
    let offset = 0;

    while (rows.length < VISITS_MAX_ROWS) {
      const chunkResp = await service
        .from("page_visits")
        .select(selectCols)
        .gte("visited_at", monthStartIso)
        .order("visited_at", { ascending: false })
        .range(offset, offset + VISITS_BATCH - 1);

      if (chunkResp.error) return { error: chunkResp.error.message as string, rows: [] as VisitRow[] };

      const chunk = (chunkResp.data ?? []) as VisitRow[];
      rows.push(...chunk);
      if (chunk.length < VISITS_BATCH) break;
      offset += VISITS_BATCH;
    }

    return { error: null as string | null, rows };
  };

  const primaryResp = await fetchAll(VISITS_SELECT_GEO);
  if (!primaryResp.error) return primaryResp;
  if (!isMissingGeoColumnsError(primaryResp.error)) return primaryResp;
  return fetchAll(VISITS_SELECT_FALLBACK);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaffApi(request, "view_stats");
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

    const [postsResp, visitsLoaded] = await Promise.all([
      service.from("external_posts").select("id, platform, posted_at, metrics").order("posted_at", { ascending: false }).limit(2000),
      loadVisits(service, monthStart.toISOString())
    ]);

    if (postsResp.error) return NextResponse.json({ ok: false, error: postsResp.error.message }, { status: 400 });
    if (visitsLoaded.error) return NextResponse.json({ ok: false, error: visitsLoaded.error }, { status: 400 });

    const posts = (postsResp.data ?? []) as ExternalPost[];
    const visits = visitsLoaded.rows;

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
    const countries = new Map<string, { label: string; visits: number; visitors: Set<string> }>();
    const cities = new Map<string, { city: string; country: string; visits: number; visitors: Set<string> }>();
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

      const countryCode = String(v.country_code ?? "").trim().toUpperCase();
      const countryName = String(v.country ?? "").trim() || toCountryName(countryCode) || "Desconocido";
      const countryKey = countryCode || countryName.toLowerCase();
      if (!countries.has(countryKey)) countries.set(countryKey, { label: countryName, visits: 0, visitors: new Set() });
      const countryAgg = countries.get(countryKey)!;
      countryAgg.visits += 1;
      countryAgg.visitors.add(v.visitor_id);

      const city = String(v.city ?? "").trim();
      if (city) {
        const cityKey = `${city.toLowerCase()}::${countryKey}`;
        if (!cities.has(cityKey)) cities.set(cityKey, { city, country: countryName, visits: 0, visitors: new Set() });
        const cityAgg = cities.get(cityKey)!;
        cityAgg.visits += 1;
        cityAgg.visitors.add(v.visitor_id);
      }
    }

    const chart = Array.from(visitsByDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, row]) => ({ date, visits: row.visits, unique: row.visitors.size }));
    const topCountries = Array.from(countries.values())
      .map((row) => ({ country: row.label, visits: row.visits, unique: row.visitors.size }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 25);
    const topCities = Array.from(cities.values())
      .map((row) => ({ city: row.city, country: row.country, visits: row.visits, unique: row.visitors.size }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 25);

    return NextResponse.json({
      ok: true,
      website: {
        day: { visits: dayVisits, unique: dayVisitors.size },
        week: { visits: weekVisits, unique: weekVisitors.size },
        month: { visits: monthVisits, unique: monthVisitors.size },
        chart14d: chart,
        countries: topCountries,
        cities: topCities
      },
      platforms: platformAgg
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
