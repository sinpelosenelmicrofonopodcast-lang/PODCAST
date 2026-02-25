import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/adminAuth";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaffApi(request);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    return NextResponse.json({
      ok: true,
      userId: auth.userId,
      isAdmin: auth.isAdmin,
      isStaff: auth.isStaff,
      roles: auth.roles,
      permissions: auth.permissions
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
