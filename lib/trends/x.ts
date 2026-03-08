import type { TrendSnapshot } from "@/types/viral";

export async function fetchXVelocity(region: string | null = null): Promise<TrendSnapshot[]> {
  const bearer = String(process.env.X_BEARER_TOKEN ?? "").trim();
  const query = String(process.env.X_TRENDS_QUERY ?? "puerto rico OR texas OR usa OR mundo").trim();

  if (!bearer) {
    return [];
  }

  // NOTE: kept intentionally simple. Requires elevated X API access for production volume.
  const endpoint = `https://api.twitter.com/2/tweets/search/recent?max_results=25&tweet.fields=created_at,public_metrics&query=${encodeURIComponent(
    query
  )}`;

  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${bearer}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    return [];
  }

  const json = (await response.json().catch(() => ({}))) as {
    data?: Array<{ text?: string; public_metrics?: { retweet_count?: number; reply_count?: number; like_count?: number } }>;
  };

  const keywordScores = new Map<string, number>();

  (json.data ?? []).forEach((tweet) => {
    const words = String(tweet.text ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9\s#]/g, " ")
      .split(/\s+/)
      .map((word) => word.trim())
      .filter((word) => word.startsWith("#") && word.length > 3)
      .slice(0, 6);

    const metrics = tweet.public_metrics ?? {};
    const score = Number(metrics.retweet_count ?? 0) * 2 + Number(metrics.reply_count ?? 0) * 2 + Number(metrics.like_count ?? 0);
    words.forEach((word) => keywordScores.set(word, (keywordScores.get(word) ?? 0) + Math.max(1, score)));
  });

  return Array.from(keywordScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([keyword, score]) => ({
      source: "x_velocity",
      keyword,
      region,
      score: Number(score.toFixed(4)),
      meta: {}
    }));
}
