import { NextRequest, NextResponse } from "next/server";
import { processSeoQueue } from "@/lib/seo/queue";

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
  const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "80");
  const limit = Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, Math.floor(limitRaw))) : 80;
  try {
    const result = await processSeoQueue(limit);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? "SEO cron failed.") }, { status: 500 });
  }
}

export const GET = POST;
