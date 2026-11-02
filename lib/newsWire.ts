export type NewsWireItem = {
  title: string;
  url: string;
  source: string;
  region: "Puerto Rico" | "Central Texas" | "Estados Unidos" | "Mundo";
  publishedAt: string;
};

const feeds: Array<{ url: string; region: NewsWireItem["region"]; source: string }> = [
  {
    url: "https://www.elnuevodia.com/arc/outboundfeeds/rss/category/noticias/?outputType=xml",
    region: "Puerto Rico",
    source: "El Nuevo Día"
  },
  {
    url: "https://www.elnuevodia.com/arc/outboundfeeds/rss/category/noticias/locales/?outputType=xml",
    region: "Puerto Rico",
    source: "El Nuevo Día"
  },
  {
    url: "https://www.kwtx.com/arc/outboundfeeds/rss/?outputType=xml",
    region: "Central Texas",
    source: "KWTX"
  },
  {
    url: "https://news.google.com/rss/search?q=Killeen%20OR%20Temple%20OR%20Waco%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen",
    region: "Central Texas",
    source: "Google Noticias"
  },
  {
    url: "https://news.google.com/rss/headlines/section/topic/NATION?hl=en-US&gl=US&ceid=US%3Aen",
    region: "Estados Unidos",
    source: "Google Noticias"
  },
  {
    url: "https://news.google.com/rss/headlines/section/topic/WORLD?hl=es-419&gl=US&ceid=US%3Aes-419",
    region: "Mundo",
    source: "Google Noticias"
  }
];

function decodeXml(raw: string): string {
  return raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (match, number: string) => {
      const code = number.toLowerCase().startsWith("x") ? parseInt(number.slice(1), 16) : parseInt(number, 10);
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : match;
    })
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function element(xml: string, tag: string): string {
  const safe = tag.replace(/[^a-z]/gi, "");
  return decodeXml(xml.match(new RegExp("<" + safe + "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/" + safe + ">", "i"))?.[1] ?? "");
}

function readFeed(xml: string, region: NewsWireItem["region"], defaultSource: string): NewsWireItem[] {
  const items = xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) ?? [];
  const now = Date.now();
  const output: NewsWireItem[] = [];
  for (const item of items.slice(0, 45)) {
    const rawTitle = element(item, "title");
    const rawLink = element(item, "link");
    const pubDate = element(item, "pubDate");
    const stamp = Date.parse(pubDate);
    if (!rawTitle || !rawLink || !Number.isFinite(stamp) || stamp > now + 10 * 60_000 || now - stamp > 48 * 3600_000) continue;
    let validUrl: URL;
    try {
      validUrl = new URL(rawLink);
    } catch {
      continue;
    }
    if (validUrl.protocol !== "https:" && validUrl.protocol !== "http:") continue;
    const publisher = element(item, "source") || defaultSource;
    const suffix = " - " + publisher;
    const title = rawTitle.endsWith(suffix) ? rawTitle.slice(0, -suffix.length).trim() : rawTitle;
    if (title.length < 18 || title.length > 260) continue;
    output.push({ title, url: validUrl.toString(), source: publisher.slice(0, 72), region, publishedAt: new Date(stamp).toISOString() });
  }
  return output;
}

export async function loadNewsWire(): Promise<NewsWireItem[]> {
  const responses = await Promise.allSettled(feeds.map(async ({ url, region, source }) => {
    const response = await fetch(url, {
      next: { revalidate: 600 },
      headers: { Accept: "application/rss+xml,application/xml,text/xml,*/*;q=0.8", "User-Agent": "SinPelosNewsReader/1.0 (+https://www.sinpelosenelmicrofono.com)" },
      signal: AbortSignal.timeout(5500)
    });
    if (!response.ok) return [] as NewsWireItem[];
    const xml = (await response.text()).slice(0, 950_000);
    if (!xml.includes("<rss") && !xml.includes("<item")) return [] as NewsWireItem[];
    return readFeed(xml, region, source);
  }));

  const unique = new Map<string, NewsWireItem>();
  for (const result of responses) {
    if (result.status !== "fulfilled") continue;
    for (const item of result.value) {
      const key = item.title.toLocaleLowerCase("es").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
      if (!unique.has(key)) unique.set(key, item);
    }
  }
  const order: NewsWireItem["region"][] = ["Puerto Rico", "Central Texas", "Estados Unidos", "Mundo"];
  const output: NewsWireItem[] = [];
  for (const region of order) {
    output.push(...[...unique.values()].filter((x) => x.region === region).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 4));
  }
  return output.slice(0, 12);
}
