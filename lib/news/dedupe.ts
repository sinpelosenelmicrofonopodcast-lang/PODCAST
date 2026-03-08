import { createHash } from "crypto";
import type { RssFeedItem } from "@/lib/news/fetch-rss";

function normalize(input: string) {
  return String(input ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/https?:\/\//g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildItemHash(input: { title: string; description: string; link: string }) {
  const raw = [normalize(input.title), normalize(input.description).slice(0, 240), normalize(input.link)].join("|");
  return createHash("sha256").update(raw).digest("hex");
}

export function similarity(a: string, b: string) {
  const aa = new Set(normalize(a).split(" ").filter(Boolean));
  const bb = new Set(normalize(b).split(" ").filter(Boolean));
  if (!aa.size || !bb.size) return 0;

  let inter = 0;
  aa.forEach((token) => {
    if (bb.has(token)) inter += 1;
  });

  return inter / Math.max(aa.size, bb.size);
}

export function dedupeFeedItems(items: RssFeedItem[], threshold = 0.82) {
  const out: Array<RssFeedItem & { hash: string }> = [];
  const seenLinks = new Set<string>();

  for (const item of items) {
    const link = String(item.link ?? "").trim().toLowerCase();
    if (!link || seenLinks.has(link)) continue;
    seenLinks.add(link);

    const hash = buildItemHash({
      title: item.title,
      description: item.description,
      link: item.link
    });

    const isNearDup = out.some((existing) => {
      const titleScore = similarity(existing.title, item.title);
      const bodyScore = similarity(existing.description, item.description);
      return titleScore >= threshold || bodyScore >= threshold;
    });

    if (isNearDup) continue;
    out.push({ ...item, hash });
  }

  return out;
}
