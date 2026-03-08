import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/adminAuth";
import { asString } from "@/lib/validations/common";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireStaffApi(request, "moderate_confessions");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const id = asString(params.id, 80);
    const body = await request.json().catch(() => ({}));
    const status = asString(body?.status, 20);
    if (!["pending", "approved", "rejected", "published"].includes(status)) {
      return NextResponse.json({ ok: false, error: "Estado inválido." }, { status: 400 });
    }

    const patch: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString()
    };

    if (status === "published") {
      patch.published_at = new Date().toISOString();
      patch.approved_by = auth.userId;
    }

    if (status === "approved") {
      patch.approved_by = auth.userId;
    }

    const { data, error } = await auth.service
      .from("confessions")
      .update(patch)
      .eq("id", id)
      .select("id,status,published_at")
      .limit(1)
      .maybeSingle();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, confession: data });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unknown error" }, { status: 500 });
  }
}
