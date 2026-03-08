import type { SupabaseClient } from "@supabase/supabase-js";
import type { TrendSnapshot } from "@/types/viral";

function extractKeywords(text: string) {
  const stop = new Set([
    "de",
    "la",
    "que",
    "el",
    "en",
    "y",
    "a",
    "los",
    "del",
    "se",
    "las",
    "por",
    "un",
    "para",
    "con",
    "no",
    "una",
    "su",
    "al"
  ]);

  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !stop.has(token));
}

export async function fetchYouTubeMomentum(service: SupabaseClient, region: string | null = null): Promise<TrendSnapshot[]> {
  const { data, error } = await service
    .from("external_posts")
    .select("title, caption, metrics, posted_at")
    .ilike("platform", "%youtube%")
    .order("posted_at", { ascending: false })
    .limit(150);

  if (error) throw new Error(error.message);

  const scoreByKeyword = new Map<string, number>();

  (data ?? []).forEach((row: any) => {
    const text = `${row?.title ?? ""} ${row?.caption ?? ""}`;
    const keywords = extractKeywords(text);
    const views = Number(row?.metrics?.views ?? 0);
    const comments = Number(row?.metrics?.comments ?? 0);
    const base = Math.max(1, views * 0.005 + comments * 0.5);
    keywords.slice(0, 10).forEach((keyword) => {
      scoreByKeyword.set(keyword, (scoreByKeyword.get(keyword) ?? 0) + base);
    });
  });

  return Array.from(scoreByKeyword.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([keyword, score]) => ({
      source: "youtube_velocity",
      keyword,
      region,
      score: Number(score.toFixed(4)),
      meta: {}
    }));
}
