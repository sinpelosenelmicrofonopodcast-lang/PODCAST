import { slugify } from "@/lib/blogSeo";

export type TocItem = { id: string; text: string; level: 2 | 3 };

export type BlogBlock =
  | { type: "h2"; id: string; text: string }
  | { type: "h3"; id: string; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "quote"; text: string };

function cleanLine(s: string) {
  return s.replace(/\s+/g, " ").trim();
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

  const flushParagraph = () => {
    const txt = cleanLine(buf.join(" "));
    buf = [];
    if (txt) blocks.push({ type: "p", text: txt });
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
      flushList();
      flushParagraph();
      continue;
    }

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

    // Quote (simple)
    if (trimmed.startsWith(">")) {
      flushList();
      flushParagraph();
      const text = cleanLine(trimmed.replace(/^>+\s?/, ""));
      blocks.push({ type: "quote", text });
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

