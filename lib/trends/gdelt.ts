import type { TrendSnapshot } from "@/types/viral";

export async function fetchGdeltTrends(region: string | null = null): Promise<TrendSnapshot[]> {
  const endpoint = String(process.env.GDELT_API_BASE ?? "https://api.gdeltproject.org/api/v2/doc/doc").trim();
  const query = String(process.env.GDELT_QUERY ?? "(puerto rico OR texas OR usa OR mundo)").trim();

  if (!endpoint) return [];

  const url = `${endpoint}?query=${encodeURIComponent(query)}&mode=ArtList&maxrecords=30&format=json`;
  const response = await fetch(url, { cache: "no-store" }).catch(() => null);
  if (!response?.ok) return [];

  const json = (await response.json().catch(() => ({}))) as { articles?: Array<{ title?: string; socialimage?: string }> };

  const scoreByKeyword = new Map<string, number>();
  (json.articles ?? []).forEach((row) => {
    const words = String(row.title ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 5)
      .slice(0, 5);

    words.forEach((word) => scoreByKeyword.set(word, (scoreByKeyword.get(word) ?? 0) + 1));
  });

  return Array.from(scoreByKeyword.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([keyword, score]) => ({
      source: "gdelt",
      keyword,
      region,
      score,
      meta: {}
    }));
}
