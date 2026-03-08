import type { IngestedCandidate, NewsArticleRow } from "@/types/viral";

type RankableNewsItem = Pick<NewsArticleRow, "id" | "created_at" | "trending_score" | "discover_score">;

export type ViralWeights = {
  sharesWeight: number;
  commentsWeight: number;
  viewsWeight: number;
  avgReadWeight: number;
  clickRateWeight: number;
  discoverWeight: number;
  controversyWeight: number;
};

export const DEFAULT_VIRAL_WEIGHTS: ViralWeights = {
  sharesWeight: 3,
  commentsWeight: 2,
  viewsWeight: 0.5,
  avgReadWeight: 1.2,
  clickRateWeight: 2,
  discoverWeight: 1.5,
  controversyWeight: 1.2
};

export function computeInitialDiscoverScore(candidate: IngestedCandidate) {
  const trust = Math.max(0, Math.min(100, Number(candidate.trustScore || 0))) / 100;
  const regionalBoost = ["PR", "TX"].includes(String(candidate.region ?? "").toUpperCase()) ? 1.2 : 1;
  const recencyBoost = candidate.publishedAt
    ? Math.max(0.2, 1 - (Date.now() - new Date(candidate.publishedAt).getTime()) / (1000 * 60 * 60 * 24 * 4))
    : 0.65;

  return Number((trust * 45 * regionalBoost + recencyBoost * 35 + Math.max(0, candidate.priority) * 2).toFixed(4));
}

export function computeControversyScore(text: string) {
  const hay = String(text ?? "").toLowerCase();
  const hotWords = [
    "escándalo",
    "demanda",
    "corrup",
    "explota",
    "polém",
    "acus",
    "fiscal",
    "violencia",
    "fraude"
  ];
  const count = hotWords.reduce((acc, word) => acc + (hay.includes(word) ? 1 : 0), 0);
  return Math.min(100, count * 12);
}

export function computeFeedScore(input: {
  shares: number;
  comments: number;
  views: number;
  avgReadTime: number;
  clickRate: number;
  discoverScore: number;
  controversyScore: number;
  weights?: Partial<ViralWeights>;
}) {
  const w = { ...DEFAULT_VIRAL_WEIGHTS, ...(input.weights ?? {}) };
  return (
    input.shares * w.sharesWeight +
    input.comments * w.commentsWeight +
    input.views * w.viewsWeight +
    input.avgReadTime * w.avgReadWeight +
    input.clickRate * w.clickRateWeight +
    input.discoverScore * w.discoverWeight +
    input.controversyScore * w.controversyWeight
  );
}

export function byViralScoreDesc<T extends RankableNewsItem>(a: T, b: T) {
  return Number(b.trending_score ?? 0) - Number(a.trending_score ?? 0);
}

export function mixForYouFeed<T extends RankableNewsItem>(items: T[]) {
  const sorted = [...items].sort(byViralScoreDesc);
  const top = sorted.slice(0, Math.max(1, Math.floor(sorted.length * 0.7)));
  const fresh = sorted
    .slice(0)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, Math.max(1, Math.floor(sorted.length * 0.2)));

  const exploration = sorted
    .slice()
    .sort((a, b) => Number(b.discover_score ?? 0) - Number(a.discover_score ?? 0))
    .slice(0, Math.max(1, Math.floor(sorted.length * 0.1)));

  const out: T[] = [];
  const seen = new Set<string>();

  const pushMany = (list: T[]) => {
    for (const row of list) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      out.push(row);
    }
  };

  pushMany(top);
  pushMany(fresh);
  pushMany(exploration);
  return out;
}
