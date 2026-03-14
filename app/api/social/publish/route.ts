import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/adminAuth";
import { publishFromSocialQueue } from "@/lib/social/publisher";
import { asStringArray, isUuid } from "@/lib/validations/common";

export async function POST(request: NextRequest) {
  const auth = await requireStaffApi(request, "manage_news");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const body = await request.json().catch(() => ({}));
    const limitRaw = Number(body?.limit ?? 20);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, Math.floor(limitRaw))) : 20;
    const ids = asStringArray(body?.ids, 25, 80).filter((value) => isUuid(value));

    const result = await publishFromSocialQueue(auth.service, limit, ids);
    return NextResponse.json({ ok: true, result });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unknown error" }, { status: 500 });
  }
}
