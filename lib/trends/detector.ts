import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseService } from "@/lib/supabaseService";
import type { TrendSnapshot } from "@/types/viral";
import { fetchGoogleTrends } from "@/lib/trends/google-trends";
import { fetchYouTubeMomentum } from "@/lib/trends/youtube";
import { fetchXVelocity } from "@/lib/trends/x";
import { fetchGdeltTrends } from "@/lib/trends/gdelt";

export type TrendProvider = {
  name: string;
  fetchTrends: (region: "PR" | "TX" | "USA" | "Mundo", service: SupabaseClient) => Promise<TrendSnapshot[]>;
  normalize: (items: TrendSnapshot[]) => TrendSnapshot[];
  score: (items: TrendSnapshot[]) => TrendSnapshot[];
  healthcheck: () => Promise<boolean>;
};

function normalizeSnapshots(items: TrendSnapshot[]) {
  return items
    .map((item) => ({
      source: String(item.source ?? "unknown").trim(),
      keyword: String(item.keyword ?? "").trim().slice(0, 180),
      region: item.region ? String(item.region).trim().slice(0, 32) : null,
      score: Number.isFinite(Number(item.score)) ? Number(item.score) : 0,
      meta: item.meta ?? {}
    }))
    .filter((item) => item.keyword);
}

function normalizeScore(items: TrendSnapshot[]) {
  const max = Math.max(1, ...items.map((item) => Number(item.score || 0)));
  return items.map((item) => ({
    ...item,
    score: Number(((Number(item.score || 0) / max) * 100).toFixed(4))
  }));
}

function providerHealth(): Promise<boolean> {
  return Promise.resolve(true);
}

const providers: TrendProvider[] = [
  {
    name: "GoogleTrendsProvider",
    fetchTrends: async (region) => fetchGoogleTrends(region),
    normalize: normalizeSnapshots,
    score: normalizeScore,
    healthcheck: providerHealth
  },
  {
    name: "XProvider",
    fetchTrends: async (region) => fetchXVelocity(region),
    normalize: normalizeSnapshots,
    score: normalizeScore,
    healthcheck: providerHealth
  },
  {
    name: "GDELTProvider",
    fetchTrends: async (region) => fetchGdeltTrends(region),
    normalize: normalizeSnapshots,
    score: normalizeScore,
    healthcheck: providerHealth
  },
  {
    name: "InternalAnalyticsProvider",
    fetchTrends: async (region, service) => fetchYouTubeMomentum(service, region),
    normalize: normalizeSnapshots,
    score: normalizeScore,
    healthcheck: providerHealth
  }
];

async function insertSnapshots(service: SupabaseClient, snapshots: TrendSnapshot[]) {
  if (!snapshots.length) return;
  const payload = snapshots.map((item) => ({
    source: item.source,
    keyword: item.keyword,
    region: item.region,
    score: item.score,
    meta: item.meta ?? {}
  }));

  const { error } = await service.from("trend_snapshots").insert(payload);
  if (error) throw new Error(error.message);
}

export async function runTrendDetector(serviceClient?: SupabaseClient) {
  const service = serviceClient ?? supabaseService();
  const regions: Array<"PR" | "TX" | "USA" | "Mundo"> = ["PR", "TX", "USA", "Mundo"];

  const summary = {
    regions: 0,
    providers: 0,
    snapshots: 0,
    errors: [] as Array<{ provider: string; region: string; message: string }>
  };

  for (const region of regions) {
    summary.regions += 1;

    for (const provider of providers) {
      summary.providers += 1;

      try {
        const healthy = await provider.healthcheck();
        if (!healthy) continue;

        const raw = await provider.fetchTrends(region, service);
        const normalized = provider.score(provider.normalize(raw));
        await insertSnapshots(service, normalized);
        summary.snapshots += normalized.length;
      } catch (error: any) {
        summary.errors.push({
          provider: provider.name,
          region,
          message: error?.message ?? "error"
        });
      }
    }
  }

  return summary;
}
