import { NextResponse } from "next/server";
import { postsSitemapEntries, renderSitemapXml } from "@/lib/seo/sitemaps";

export const revalidate = 300;

export async function GET() {
  const xml = renderSitemapXml(await postsSitemapEntries());
  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "s-maxage=300, stale-while-revalidate=600"
    }
  });
}

