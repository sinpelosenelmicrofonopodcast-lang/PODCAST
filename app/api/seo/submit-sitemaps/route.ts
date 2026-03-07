import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/adminAuth";
import { submitGscSitemap } from "@/lib/seo/gsc";
import { canonicalSitemapUrl, SEO_SITEMAP_INDEX_PATHS } from "@/lib/seo/sitemaps";

export async function POST(request: NextRequest) {
  const auth = await requireStaffApi(request, "view_stats");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const targets = [canonicalSitemapUrl("/sitemap.xml"), ...SEO_SITEMAP_INDEX_PATHS.map((path) => canonicalSitemapUrl(path))];
    const results: Array<{ sitemap: string; ok: boolean; error?: string }> = [];

    for (const sitemap of targets) {
      try {
        await submitGscSitemap(sitemap);
        results.push({ sitemap, ok: true });
      } catch (e: any) {
        results.push({ sitemap, ok: false, error: String(e?.message ?? "Error enviando sitemap.") });
      }
    }

    const okCount = results.filter((row) => row.ok).length;
    return NextResponse.json({
      ok: okCount > 0,
      submitted: okCount,
      failed: results.length - okCount,
      results
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? "No se pudieron enviar sitemaps.") }, { status: 500 });
  }
}

