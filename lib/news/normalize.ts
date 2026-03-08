import type { NewsSourceRow, IngestedCandidate } from "@/types/viral";
import type { RssFeedItem } from "@/lib/news/fetch-rss";
import { inferCategories, inferTags } from "@/lib/newsAutomation";
import { asString, sanitizeText } from "@/lib/validations/common";

function normalizeRegion(source: NewsSourceRow) {
  const region = asString(source.region, 24);
  if (!region) return null;
  return region;
}

function normalizeCategory(source: NewsSourceRow, title: string, description: string) {
  const fromSource = asString(source.category, 60);
  if (fromSource) return fromSource;
  const inferred = inferCategories({
    region: source.region ?? null,
    title,
    description,
    defaults: source.default_categories ?? null
  });
  return inferred[0] ?? "Mundo";
}

export function normalizeFeedItemToCandidate(input: {
  source: NewsSourceRow;
  feedItem: RssFeedItem;
  hash: string;
}): IngestedCandidate {
  const title = asString(input.feedItem.title, 240);
  const summary = asString(input.feedItem.description, 400);
  const content = sanitizeText(input.feedItem.description || input.feedItem.title);
  const category = normalizeCategory(input.source, title, summary);
  const categories = inferCategories({
    region: input.source.region ?? null,
    title,
    description: summary,
    defaults: input.source.default_categories ?? null
  });

  const tags = inferTags(title, summary, categories);

  return {
    sourceId: input.source.id,
    sourceName: input.source.name,
    sourceUrl: input.feedItem.link,
    title,
    summary,
    content,
    publishedAt: input.feedItem.publishedAt,
    region: normalizeRegion(input.source),
    category,
    tags,
    featuredImageUrl: input.feedItem.imageUrl,
    trustScore: Number(input.source.trust_score ?? 50),
    priority: Number(input.source.priority ?? 0),
    hash: input.hash
  };
}
