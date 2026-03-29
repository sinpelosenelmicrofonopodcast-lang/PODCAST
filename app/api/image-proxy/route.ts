import { NextRequest, NextResponse } from "next/server";
import { buildImageFallbackSvg, normalizeImageUrl } from "@/lib/imageUrl";

function fallbackResponse(title?: string | null, status = 200) {
  return new NextResponse(buildImageFallbackSvg(title), {
    status,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400"
    }
  });
}

export async function GET(request: NextRequest) {
  const rawUrl = String(request.nextUrl.searchParams.get("url") ?? "").trim();
  const title = String(request.nextUrl.searchParams.get("title") ?? "").trim();
  if (!rawUrl) return fallbackResponse(title);

  const normalized = normalizeImageUrl(rawUrl);
  if (!normalized) return fallbackResponse(title);

  let target: URL;
  try {
    target = new URL(normalized);
  } catch {
    return fallbackResponse(title);
  }

  if (!["http:", "https:"].includes(target.protocol)) {
    return fallbackResponse(title, 400);
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (compatible; SPMImageProxy/1.0; +https://www.sinpelosenelmicrofono.com)"
      },
      redirect: "follow",
      cache: "no-store"
    });

    if (!upstream.ok) {
      return fallbackResponse(title);
    }

    const contentType = String(upstream.headers.get("content-type") ?? "").toLowerCase();
    if (!contentType.startsWith("image/")) {
      return fallbackResponse(title);
    }

    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400"
      }
    });
  } catch {
    return fallbackResponse(title);
  }
}
