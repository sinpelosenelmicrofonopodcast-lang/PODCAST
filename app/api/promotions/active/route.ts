import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const revalidate = 0;

type Promotion = {
  id: string;
  title?: string | null;
  cta_url?: string | null;
  campaign_id?: string | null;
  creative_id?: string | null;
  display_order?: number | null;
  weight?: number | null;
  frequency_cap?: number | null;
  max_impressions?: number | null;
  daily_cap?: number | null;
  target_sections?: string[] | null;
  target_region?: string | null;
  device_target?: string | null;
  [key: string]: unknown;
};

type DeliveryCount = {
  promotion_id: string;
  lifetime_impressions: number | string | null;
  today_impressions: number | string | null;
  session_impressions: number | string | null;
};

function positiveWeight(value: unknown) {
  const parsed = Number(value ?? 100);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
}

function weightedShuffle<T extends Promotion>(input: T[]) {
  const pool = [...input];
  const result: T[] = [];
  while (pool.length) {
    const total = pool.reduce((sum, item) => sum + positiveWeight(item.weight), 0);
    let cursor = Math.random() * total;
    let selectedIndex = 0;
    for (let i = 0; i < pool.length; i += 1) {
      cursor -= positiveWeight(pool[i]?.weight);
      if (cursor <= 0) {
        selectedIndex = i;
        break;
      }
    }
    result.push(pool.splice(selectedIndex, 1)[0]);
  }
  return result;
}

function rotateByPriority<T extends Promotion>(items: T[], limit: number) {
  if (!items.length) return [];
  const priorities = Array.from(new Set(items.map((item) => Number(item?.display_order ?? 0)))).sort((a, b) => a - b);
  const ordered: T[] = [];
  for (const priority of priorities) {
    ordered.push(...weightedShuffle(items.filter((item) => Number(item?.display_order ?? 0) === priority)));
  }
  return ordered.slice(0, limit);
}

function normalizeTarget(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function slugToken(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function decorateCta(promo: Promotion, placement: string) {
  const raw = String(promo.cta_url ?? "").trim();
  if (!/^https?:\/\//i.test(raw)) return raw || null;
  try {
    const target = new URL(raw);
    if (!target.searchParams.has("utm_source")) target.searchParams.set("utm_source", "sinpelos");
    if (!target.searchParams.has("utm_medium")) target.searchParams.set("utm_medium", placement || "website");
    if (!target.searchParams.has("utm_campaign")) {
      target.searchParams.set("utm_campaign", slugToken(promo.campaign_id || promo.title || promo.id) || promo.id);
    }
    if (!target.searchParams.has("utm_content")) {
      target.searchParams.set("utm_content", slugToken(promo.creative_id || promo.id) || promo.id);
    }
    return target.toString();
  } catch {
    return raw;
  }
}

function requestDevice(request: NextRequest) {
  const mobileHint = request.headers.get("sec-ch-ua-mobile");
  if (mobileHint === "?1") return "mobile";
  if (mobileHint === "?0") return "desktop";
  const ua = request.headers.get("user-agent") ?? "";
  return /android|iphone|ipad|ipod|mobile/i.test(ua) ? "mobile" : "desktop";
}

function matchesDevice(promo: Promotion, device: string) {
  const target = normalizeTarget(promo.device_target);
  return !target || target === "all" || target === "any" || target === device;
}

function matchesRegion(promo: Promotion, region: string) {
  const target = normalizeTarget(promo.target_region);
  if (!target || target === "all" || target === "any") return true;
  if (!region) return true;
  return target
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .includes(region.toLowerCase());
}

function underCaps(promo: Promotion, counts: Map<string, DeliveryCount>) {
  const row = counts.get(promo.id);
  if (!row) return true;
  const lifetime = Number(row.lifetime_impressions ?? 0);
  const today = Number(row.today_impressions ?? 0);
  const session = Number(row.session_impressions ?? 0);
  const maxImpressions = Number(promo.max_impressions ?? 0);
  const dailyCap = Number(promo.daily_cap ?? 0);
  const frequencyCap = Number(promo.frequency_cap ?? 0);
  if (maxImpressions > 0 && lifetime >= maxImpressions) return false;
  if (dailyCap > 0 && today >= dailyCap) return false;
  if (frequencyCap > 0 && session >= frequencyCap) return false;
  return true;
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const placement = (url.searchParams.get("placement") ?? "toast").trim();
    const section = (url.searchParams.get("section") ?? "").trim();
    const sessionId = (url.searchParams.get("sid") ?? "").trim().slice(0, 160);
    const requestedRegion = (url.searchParams.get("region") ?? "").trim();
    const inferredRegion = request.headers.get("x-vercel-ip-country-region") ?? request.headers.get("x-vercel-ip-city") ?? "";
    const region = requestedRegion || inferredRegion;
    const device = requestDevice(request);
    const limit = Math.min(10, Math.max(1, Number(url.searchParams.get("limit") ?? 10)));
    const dbLimit = section ? Math.min(50, Math.max(limit * 12, 18)) : Math.min(50, Math.max(limit * 10, 16));
    const nowIso = new Date().toISOString();

    const supabase = supabaseServer();
    const selectCols = [
      "id",
      "title",
      "description",
      "image_url",
      "cta_label",
      "cta_url",
      "placement",
      "display_order",
      "starts_at",
      "ends_at",
      "promo_type",
      "target_sections",
      "campaign_id",
      "advertiser",
      "creative_id",
      "weight",
      "frequency_cap",
      "max_impressions",
      "daily_cap",
      "target_region",
      "device_target",
      "revenue_cents"
    ].join(", ");

    const { data, error } = await supabase
      .from("promotions")
      .select(selectCols)
      .eq("is_active", true)
      .eq("placement", placement)
      .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
      .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(dbLimit);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    let items = ((data ?? []) as unknown as Promotion[]).filter((promo) => matchesDevice(promo, device) && matchesRegion(promo, region));

    if (section && items.length) {
      const sec = section.toLowerCase();
      const targeted: Promotion[] = [];
      const global: Promotion[] = [];

      for (const promo of items) {
        const targets = promo?.target_sections;
        if (!targets || !Array.isArray(targets) || targets.length === 0) {
          global.push(promo);
          continue;
        }
        const normalized = targets.map((value: unknown) => normalizeTarget(value));
        if (normalized.includes(sec)) targeted.push(promo);
        else if (normalized.includes("all") || normalized.includes("global")) global.push(promo);
      }

      items = targeted.length ? targeted : global;
    }

    if (items.length) {
      const ids = items.map((item) => item.id);
      const delivery = await supabase.rpc("promotion_delivery_counts", {
        p_ids: ids,
        p_session_id: sessionId || null
      });
      if (!delivery.error && Array.isArray(delivery.data)) {
        const countMap = new Map<string, DeliveryCount>();
        for (const row of delivery.data as DeliveryCount[]) countMap.set(String(row.promotion_id), row);
        items = items.filter((promo) => underCaps(promo, countMap));
      }
    }

    const selected = rotateByPriority(items, limit).map((promo) => ({
      ...promo,
      cta_url: decorateCta(promo, placement)
    }));

    return NextResponse.json(
      { ok: true, items: selected },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          "X-Robots-Tag": "noindex, nofollow"
        }
      }
    );
  } catch (error: any) {
    console.error("active promotion selection failed", error?.message ?? error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
