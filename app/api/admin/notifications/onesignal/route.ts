import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/adminAuth";
import { sendOneSignalPush } from "@/lib/onesignalServer";

function jsonNoindex(payload: Record<string, unknown>, status = 200) {
  const response = NextResponse.json(payload, { status });
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaffApi(request, "manage_news");
    if (!auth.ok) {
      return jsonNoindex({ ok: false, error: auth.error }, auth.status);
    }

    const body = await request.json().catch(() => ({}));
    const title = String(body?.title ?? "").trim();
    const message = String(body?.message ?? "").trim();
    const url = String(body?.url ?? "").trim();
    const imageUrl = String(body?.imageUrl ?? "").trim();
    const category = String(body?.category ?? "").trim();
    const segment = String(body?.segment ?? "").trim();

    if (!title) return jsonNoindex({ ok: false, error: "title es requerido." }, 400);
    if (!message) return jsonNoindex({ ok: false, error: "message es requerido." }, 400);

    const result = await sendOneSignalPush({
      title,
      message,
      url: url || null,
      imageUrl: imageUrl || null,
      category: category || null,
      segment: segment || null,
      data: {
        sent_from: "admin",
        category: category || null,
        sent_at: new Date().toISOString()
      }
    });

    return jsonNoindex({
      ok: true,
      id: result.id,
      recipients: result.recipients,
      errors: result.errors
    });
  } catch (error: any) {
    return jsonNoindex({ ok: false, error: error?.message ?? "No se pudo enviar la notificación." }, 500);
  }
}
