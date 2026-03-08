import { parseFeedXml, summarizeDescription } from "@/lib/newsAutomation";
import { sanitizeText } from "@/lib/validations/common";

export type RssFeedItem = {
  title: string;
  link: string;
  description: string;
  publishedAt: string | null;
  imageUrl: string | null;
};

function parseImageFromXmlBlock(block: string) {
  const enclosure = block.match(/<enclosure[^>]*url="([^"]+)"[^>]*>/i);
  if (enclosure?.[1]) return enclosure[1];
  const mediaContent = block.match(/<media:content[^>]*url="([^"]+)"[^>]*>/i);
  if (mediaContent?.[1]) return mediaContent[1];
  const imgTag = block.match(/<img[^>]*src="([^"]+)"/i);
  if (imgTag?.[1]) return imgTag[1];
  return null;
}

export async function fetchRssFeed(url: string, timeoutMs = 12000): Promise<RssFeedItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "User-Agent": "SPMNewsBot/1.0 (+https://www.sinpelosenelmicrofono.com)"
      }
    });

    if (!response.ok) {
      throw new Error(`RSS ${url} respondió ${response.status}`);
    }

    const xml = await response.text();
    const base = parseFeedXml(xml);

    const itemBlocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
    const imageMap = new Map<string, string | null>();
    itemBlocks.forEach((block) => {
      const linkMatch = block.match(/<link(?:\s[^>]*)?>([\s\S]*?)<\/link>/i);
      const link = linkMatch?.[1]?.trim() ?? "";
      if (!link) return;
      imageMap.set(link, parseImageFromXmlBlock(block));
    });

    return base
      .map((item) => {
        const title = sanitizeText(item.title);
        const description = summarizeDescription(sanitizeText(item.description));
        return {
          title,
          link: item.link,
          description,
          publishedAt: item.publishedAt,
          imageUrl: imageMap.get(item.link) ?? null
        };
      })
      .filter((item) => item.title && item.link);
  } catch (error: any) {
    throw new Error(error?.message ?? "Error leyendo feed RSS.");
  } finally {
    clearTimeout(timer);
  }
}
