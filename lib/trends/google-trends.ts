import type { TrendSnapshot } from "@/types/viral";

function parseItems(xml: string) {
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  return blocks
    .map((block) => {
      const title = block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "";
      const traffic = block.match(/<ht:approx_traffic>([\s\S]*?)<\/ht:approx_traffic>/i)?.[1] ?? "";
      return {
        title: title.replace(/<!\[CDATA\[|\]\]>/g, "").trim(),
        traffic: traffic.replace(/<!\[CDATA\[|\]\]>/g, "").trim()
      };
    })
    .filter((row) => row.title);
}

function toScore(traffic: string) {
  const numeric = Number(String(traffic).replace(/[^0-9]/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return 1;
  return Math.min(100, Math.log10(numeric + 10) * 20);
}

const REGION_MAP: Record<string, string> = {
  PR: "PR",
  TX: "US-TX",
  USA: "US",
  Mundo: "US"
};

export async function fetchGoogleTrends(region: "PR" | "TX" | "USA" | "Mundo"): Promise<TrendSnapshot[]> {
  const geo = REGION_MAP[region] ?? "US";
  const url = `https://trends.google.com/trending/rss?geo=${encodeURIComponent(geo)}`;
  const response = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "SPMTrendsBot/1.0" }
  });
  if (!response.ok) throw new Error(`Google Trends RSS HTTP ${response.status}`);

  const xml = await response.text();
  const items = parseItems(xml);

  return items.slice(0, 25).map((item) => ({
    source: "google_trends",
    keyword: item.title,
    region,
    score: toScore(item.traffic),
    meta: {
      approxTraffic: item.traffic
    }
  }));
}
