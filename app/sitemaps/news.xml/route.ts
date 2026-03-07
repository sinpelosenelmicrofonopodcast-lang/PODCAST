import { NextResponse } from "next/server";
import { newsSitemapEntries, renderNewsSitemapXml } from "@/lib/seo/sitemaps";

export const revalidate = 300;

export async function GET() {
  const xml = renderNewsSitemapXml(await newsSitemapEntries());
  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "s-maxage=300, stale-while-revalidate=600"
    }
  });
}

