import { NextResponse } from "next/server";
import { SEO_SITEMAP_INDEX_PATHS, renderSitemapIndexXml } from "@/lib/seo/sitemaps";

export const revalidate = 300;

export async function GET() {
  const xml = renderSitemapIndexXml(SEO_SITEMAP_INDEX_PATHS);
  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "s-maxage=300, stale-while-revalidate=600"
    }
  });
}

