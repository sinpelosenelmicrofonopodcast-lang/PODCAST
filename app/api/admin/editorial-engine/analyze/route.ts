import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/adminAuth";
import { runEditorialAgent, type EditorialInput } from "@/services/editorialAgent";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const auth = await requireStaffApi(request, "manage_news");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const body = (await request.json().catch(() => ({}))) as Partial<EditorialInput> & Record<string, unknown>;
    const mode = body.mode === "news" ? "news" : body.mode === "podcast" ? "podcast" : null;
    if (!mode) return NextResponse.json({ ok: false, error: "Modo inválido." }, { status: 400 });

    const input: EditorialInput =
      mode === "podcast"
        ? {
            mode,
            episode: String(body.episode ?? ""),
            title: String(body.title ?? ""),
            guest: String(body.guest ?? ""),
            sourceUrl: String(body.sourceUrl ?? ""),
            metadata: String(body.metadata ?? ""),
            transcript: String(body.transcript ?? "")
          }
        : {
            mode,
            title: String(body.title ?? ""),
            sourceUrl: String(body.sourceUrl ?? ""),
            sourceName: String(body.sourceName ?? ""),
            region: String(body.region ?? ""),
            sourceText: String(body.sourceText ?? ""),
            additionalSources: String(body.additionalSources ?? "")
          };

    const result = await runEditorialAgent(input);
    return NextResponse.json({ ok: true, result });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "No se pudo analizar el contenido." }, { status: 500 });
  }
}
