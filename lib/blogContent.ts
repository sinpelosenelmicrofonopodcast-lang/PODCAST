import { slugify } from "@/lib/blogSeo";

export type TocItem = { id: string; text: string; level: 2 | 3 };

export type BlogBlock =
  | { type: "h2"; id: string; text: string }
  | { type: "h3"; id: string; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "quote"; text: string }
  | { type: "image"; url: string; alt?: string }
  | { type: "video"; url: string; title?: string }
  | { type: "divider" };

function cleanLine(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function splitLongParagraph(text: string) {
  const clean = cleanLine(text);
  if (!clean) return [] as string[];
  if (clean.length <= 280) return [clean];

  const sentences = clean
    .split(/(?<=[.!?])\s+/)
    .map((s) => cleanLine(s))
    .filter(Boolean);

  if (sentences.length <= 1) return [clean];

  const out: string[] = [];
  let chunk = "";
  let sentenceCount = 0;

  for (const sentence of sentences) {
    const next = chunk ? `${chunk} ${sentence}` : sentence;
    const shouldFlush = chunk && (next.length > 230 || sentenceCount >= 2);
    if (shouldFlush) {
      out.push(chunk);
      chunk = sentence;
      sentenceCount = 1;
      continue;
    }
    chunk = next;
    sentenceCount += 1;
  }

  if (chunk) out.push(chunk);
  return out;
}

export function parseBlogBlocks(body: string): { blocks: BlogBlock[]; toc: TocItem[] } {
  const lines = String(body ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n");

  const blocks: BlogBlock[] = [];
  const toc: TocItem[] = [];
  let buf: string[] = [];
  let listMode: null | "ul" | "ol" = null;
  let listItems: string[] = [];
  let headingCount = 0;
  let prevNormalized = "";
  let prevWasBlank = false;

  const pushParagraph = (txt: string) => {
    const parts = splitLongParagraph(txt);
    for (const part of parts) {
      if (!part) continue;
      blocks.push({ type: "p", text: part });
    }
  };

  const flushParagraph = () => {
    const txt = cleanLine(buf.join(" "));
    buf = [];
    pushParagraph(txt);
  };

  const flushList = () => {
    if (!listMode) return;
    const items = listItems.map(cleanLine).filter(Boolean);
    if (items.length) blocks.push({ type: listMode, items } as any);
    listMode = null;
    listItems = [];
  };

  for (const raw of lines) {
    const line = String(raw ?? "");
    const trimmed = line.trim();

    if (!trimmed) {
      if (prevWasBlank) continue;
      prevWasBlank = true;
      flushList();
      flushParagraph();
      continue;
    }
    prevWasBlank = false;

    const normalized = cleanLine(trimmed);
    if (normalized && normalized === prevNormalized) continue;
    prevNormalized = normalized;

    // Headings (markdown-ish)
    if (trimmed.startsWith("## ")) {
      flushList();
      flushParagraph();
      const text = cleanLine(trimmed.slice(3));
      headingCount += 1;
      const id = `${slugify(text)}-${headingCount}`;
      blocks.push({ type: "h2", id, text });
      toc.push({ id, text, level: 2 });
      continue;
    }
    if (trimmed.startsWith("### ")) {
      flushList();
      flushParagraph();
      const text = cleanLine(trimmed.slice(4));
      headingCount += 1;
      const id = `${slugify(text)}-${headingCount}`;
      blocks.push({ type: "h3", id, text });
      toc.push({ id, text, level: 3 });
      continue;
    }

    // Friendly "title:" lines become small subheadings.
    if (trimmed.length <= 90 && /:$/.test(trimmed) && !/[.!?]$/.test(trimmed)) {
      flushList();
      flushParagraph();
      const text = cleanLine(trimmed.replace(/:$/, ""));
      headingCount += 1;
      const id = `${slugify(text)}-${headingCount}`;
      blocks.push({ type: "h3", id, text });
      toc.push({ id, text, level: 3 });
      continue;
    }

    // Quote (simple)
    if (trimmed.startsWith(">")) {
      flushList();
      flushParagraph();
      const text = cleanLine(trimmed.replace(/^>+\s?/, ""));
      blocks.push({ type: "quote", text });
      continue;
    }

    // Horizontal divider
    if (/^-{3,}$/.test(trimmed)) {
      flushList();
      flushParagraph();
      blocks.push({ type: "divider" });
      continue;
    }

    // Image embed: ![alt](https://...)
    const imageMatch = trimmed.match(/^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)$/i);
    if (imageMatch) {
      flushList();
      flushParagraph();
      blocks.push({
        type: "image",
        alt: cleanLine(imageMatch[1] ?? ""),
        url: cleanLine(imageMatch[2] ?? "")
      });
      continue;
    }

    // Video embed: [video](https://...) OR ::video https://... | optional title
    const markdownVideoMatch = trimmed.match(/^\[video\]\((https?:\/\/[^\s)]+)\)$/i);
    const commandVideoMatch = trimmed.match(/^::video\s+(https?:\/\/\S+?)(?:\s*\|\s*(.+))?$/i);
    if (markdownVideoMatch || commandVideoMatch) {
      flushList();
      flushParagraph();
      const url = cleanLine(markdownVideoMatch?.[1] ?? commandVideoMatch?.[1] ?? "");
      const title = cleanLine(commandVideoMatch?.[2] ?? "");
      if (url) {
        blocks.push({
          type: "video",
          url,
          title: title || undefined
        });
      }
      continue;
    }

    // Lists
    const ulMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (ulMatch) {
      flushParagraph();
      if (listMode && listMode !== "ul") flushList();
      listMode = "ul";
      listItems.push(ulMatch[1]);
      continue;
    }

    const olMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      flushParagraph();
      if (listMode && listMode !== "ol") flushList();
      listMode = "ol";
      listItems.push(olMatch[1]);
      continue;
    }

    // Default: paragraph buffer
    flushList();
    buf.push(trimmed);
  }

  flushList();
  flushParagraph();
  return { blocks, toc };
}
