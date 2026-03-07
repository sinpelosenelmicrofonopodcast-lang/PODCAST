import { NextRequest, NextResponse } from "next/server";
import { runSeoAudit } from "@/lib/seo/audit";
import { submitGscSitemap } from "@/lib/seo/gsc";
import { canonicalSitemapUrl } from "@/lib/seo/sitemaps";

function isCronAuthorized(request: NextRequest) {
  const secret = String(process.env.CRON_SECRET ?? "").trim();
  if (!secret) return false;
  const auth = String(request.headers.get("authorization") ?? "").trim();
  if (auth && auth === secret) return true;
  const bearerMatch = auth.match(/^bearer\s+(.+)$/i);
  const bearer = String(bearerMatch?.[1] ?? "").trim();
  if (bearer && bearer === secret) return true;
  if (String(request.headers.get("x-cron-secret") ?? "").trim() === secret) return true;
  if (String(request.nextUrl.searchParams.get("secret") ?? "").trim() === secret) return true;
  return false;
}

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized cron call." }, { status: 401 });
  }

  const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "200");
  const limit = Number.isFinite(limitRaw) ? Math.min(400, Math.max(1, Math.floor(limitRaw))) : 200;
  try {
    const audit = await runSeoAudit(limit);
    const day = new Date().getUTCDay();
    let sitemapSubmit: { ok: boolean; message: string } = { ok: true, message: "Skipped (not weekly run)." };
    if (day === 1) {
      await submitGscSitemap(canonicalSitemapUrl("/sitemap.xml"));
      sitemapSubmit = { ok: true, message: "Weekly sitemap submit completed." };
    }

    return NextResponse.json({
      ok: true,
      audit,
      sitemapSubmit
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? "SEO daily cron failed.") }, { status: 500 });
  }
}

export const GET = POST;
