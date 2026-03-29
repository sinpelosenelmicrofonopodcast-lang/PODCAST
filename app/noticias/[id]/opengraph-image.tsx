import { ImageResponse } from "next/og";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { isUuid, normalizeNewsKey } from "@/lib/newsRoute";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const alt = "Vista previa de noticia de Sin Pelos en el Micrófono";
export const size = {
  width: 1200,
  height: 630
};
export const contentType = "image/png";

type OgNewsItem = {
  id: string;
  slug?: string | null;
  title: string;
  summary: string | null;
  cover_url: string | null;
};

const MAX_INLINE_IMAGE_BYTES = 6 * 1024 * 1024;

function trimText(value: string | null | undefined, max: number) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

async function loadOgItem(id: string) {
  const key = normalizeNewsKey(id);
  if (!key) return null;

  const supabase = supabaseServer();
  const candidates: Array<"id" | "slug"> = isUuid(key) ? ["id", "slug"] : ["slug", "id"];

  for (const column of candidates) {
    if (column === "id" && !isUuid(key)) continue;

    for (const withPublicationState of [true, false]) {
      let query = supabase
        .from("news_items")
        .select("id, slug, title, summary, cover_url")
        .order("published_at", { ascending: false })
        .limit(1);

      if (withPublicationState) query = query.eq("publication_state", "published");
      query = column === "slug" ? query.ilike("slug", key) : query.eq("id", key);

      const result = await query;
      const rows = (result.data as OgNewsItem[] | null) ?? [];
      if (!result.error && rows.length > 0) return rows[0];
      if (result.error && !/slug|publication_state/i.test(result.error.message)) break;
    }
  }

  return null;
}

async function inlineOgImage(rawUrl: string | null | undefined) {
  const normalizedUrl = normalizeImageUrl(rawUrl);
  if (!normalizedUrl) return null;
  if (/^data:image\//i.test(normalizedUrl)) return normalizedUrl;

  try {
    const response = await fetch(normalizedUrl, {
      headers: {
        accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "user-agent": "Mozilla/5.0 (compatible; SPM-og-image/1.0; +https://www.sinpelosenelmicrofono.com)"
      },
      cache: "force-cache",
      next: { revalidate: 60 * 60 * 24 }
    });

    if (!response.ok) return null;

    const contentType = String(response.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (!contentType.startsWith("image/")) return null;

    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_INLINE_IMAGE_BYTES) return null;

    const bytes = await response.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > MAX_INLINE_IMAGE_BYTES) return null;

    return `data:${contentType};base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function OgImage({ params }: { params: { id: string } }) {
  const item = await loadOgItem(params.id);
  const coverImage = await inlineOgImage(item?.cover_url);
  const hasCoverImage = Boolean(coverImage);
  const title = trimText(item?.title ?? "Sin Pelos en el Micrófono", 110);
  const summary = trimText(item?.summary ?? "Noticias y conversaciones sin libreto.", 180);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#050505"
        }}
      >
        {hasCoverImage ? (
          <>
            <img
              src={coverImage ?? undefined}
              alt={title}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover"
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                background: "linear-gradient(180deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.08) 56%, rgba(0,0,0,0.34) 100%)"
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 28,
                bottom: 28,
                display: "flex",
                padding: "12px 18px",
                borderRadius: 999,
                background: "rgba(8,8,8,0.72)",
                color: "#ffffff",
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: 0.2
              }}
            >
              sinpelosenelmicrofono.com
            </div>
          </>
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 32,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: 40,
              borderRadius: 28,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(12,12,12,0.72)"
            }}
          >
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                padding: "10px 18px",
                borderRadius: 999,
                background: "#9b0d10",
                color: "#ffffff",
                fontSize: 28,
                fontWeight: 800,
                letterSpacing: 1
              }}
            >
              SPM NOTICIAS
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 18
              }}
            >
              <div
                style={{
                  color: "#ffffff",
                  fontSize: 58,
                  lineHeight: 1.08,
                  fontWeight: 800
                }}
              >
                {title}
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.82)",
                  fontSize: 28,
                  lineHeight: 1.35
                }}
              >
                {summary}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                color: "#ffd54f",
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: 0.4
              }}
            >
              sinpelosenelmicrofono.com
            </div>
          </div>
        )}
      </div>
    ),
    size
  );
}
