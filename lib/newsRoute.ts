export const NEWS_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type NewsRouteRef = {
  id: string;
  slug?: string | null;
};

export function isUuid(value: string | null | undefined) {
  return NEWS_UUID_RE.test(String(value ?? "").trim());
}

export function normalizeNewsKey(value: string | null | undefined) {
  return decodeURIComponent(String(value ?? "").trim()).replace(/\/+$/, "");
}

export function newsPathKey(input: Pick<NewsRouteRef, "id" | "slug">) {
  const slug = String(input.slug ?? "").trim();
  return slug || String(input.id ?? "").trim();
}

export function newsHref(input: Pick<NewsRouteRef, "id" | "slug">) {
  return `/noticias/${encodeURIComponent(newsPathKey(input))}` as `/noticias/${string}`;
}

export function extractNewsPathSegment(path: string | null | undefined): string | null {
  const raw = String(path ?? "").trim();
  if (!raw) return null;
  const clean = raw.split("?")[0].split("#")[0];
  const m = clean.match(/^\/noticias\/([^/]+)$/i);
  if (!m?.[1]) return null;
  const segment = decodeURIComponent(m[1]).trim();
  return segment || null;
}

export function extractNewsPathSegmentFromUrl(urlValue: string | null | undefined): string | null {
  const raw = String(urlValue ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return extractNewsPathSegment(url.pathname);
  } catch {
    const idx = raw.indexOf("/noticias/");
    if (idx < 0) return null;
    return extractNewsPathSegment(raw.slice(idx));
  }
}
