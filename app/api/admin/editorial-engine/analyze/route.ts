import { gunzipSync } from "node:zlib";
import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/adminAuth";
import { runEditorialAgent, type EditorialInput } from "@/services/editorialAgent";

export const runtime = "nodejs";
export const maxDuration = 60;

function decodeStoredTranscript(value: unknown, metadata: unknown) {
  const raw = String(value ?? "");
  const encoding = String((metadata as any)?.encoding ?? "");
  if (raw.startsWith("gzip64:") || encoding === "gzip64") {
    const payload = raw.startsWith("gzip64:") ? raw.slice(7) : raw;
    try {
      return gunzipSync(Buffer.from(payload, "base64")).toString("utf8");
    } catch {
      throw new Error("La fuente guardada está comprimida pero no se pudo decodificar.");
    }
  }
  return raw;
}

export async function POST(request: NextRequest) {
  const auth = await requireStaffApi(request, "manage_news");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const body = (await request.json().catch(() => ({}))) as Partial<EditorialInput> & Record<string, unknown>;
    const mode = body.mode === "news" ? "news" : body.mode === "podcast" ? "podcast" : null;
    if (!mode) return NextResponse.json({ ok: false, error: "Modo inválido." }, { status: 400 });

    let episodeSourceId: string | null = null;
    let sourceKey = "manual";
    let input: EditorialInput;

    if (mode === "podcast") {
      episodeSourceId = String(body.episodeSourceId ?? "").trim() || null;
      if (episodeSourceId) {
        const { data: source, error } = await auth.service
          .from("editorial_episode_sources")
          .select("id,episode_code,title,guest,source_url,metadata,transcript,transcript_char_count")
          .eq("id", episodeSourceId)
          .eq("active", true)
          .maybeSingle();
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
        if (!source) return NextResponse.json({ ok: false, error: "Fuente del episodio no encontrada." }, { status: 404 });

        const transcript = decodeStoredTranscript(source.transcript, source.metadata);
        if (transcript.trim().length < 120) {
          return NextResponse.json({ ok: false, error: "El episodio todavía no tiene transcript suficiente cargado." }, { status: 409 });
        }

        sourceKey = String(source.episode_code ?? source.id);
        input = {
          mode,
          episode: String(source.episode_code ?? ""),
          title: String(source.title ?? ""),
          guest: String(source.guest ?? ""),
          sourceUrl: String(source.source_url ?? ""),
          metadata: JSON.stringify(source.metadata ?? {}),
          transcript
        };
      } else {
        input = {
          mode,
          episode: String(body.episode ?? ""),
          title: String(body.title ?? ""),
          guest: String(body.guest ?? ""),
          sourceUrl: String(body.sourceUrl ?? ""),
          metadata: String(body.metadata ?? ""),
          transcript: String(body.transcript ?? "")
        };
      }
    } else {
      sourceKey = String(body.sourceUrl ?? body.title ?? "manual-news").slice(0, 500);
      input = {
        mode,
        title: String(body.title ?? ""),
        sourceUrl: String(body.sourceUrl ?? ""),
        sourceName: String(body.sourceName ?? ""),
        region: String(body.region ?? ""),
        sourceText: String(body.sourceText ?? ""),
        additionalSources: String(body.additionalSources ?? "")
      };
    }

    const result = await runEditorialAgent(input);
    const inputSnapshot = mode === "podcast"
      ? {
          mode,
          episodeSourceId,
          episode: input.episode,
          title: input.title,
          guest: input.guest,
          sourceUrl: input.sourceUrl,
          transcriptChars: input.transcript.length
        }
      : {
          mode,
          title: input.title,
          sourceUrl: input.sourceUrl,
          sourceName: input.sourceName,
          region: input.region,
          sourceChars: input.sourceText.length + input.additionalSources.length
        };

    const { data: saved, error: saveError } = await auth.service
      .from("editorial_runs")
      .insert({
        mode,
        episode_source_id: episodeSourceId,
        source_key: sourceKey,
        input_snapshot: inputSnapshot,
        result,
        score: result.score,
        publication_recommendation: result.review.publicationRecommendation,
        status: "draft",
        model: result.model,
        created_by: auth.userId
      })
      .select("id,created_at,status")
      .single();

    if (saveError) return NextResponse.json({ ok: false, error: `Análisis completado pero no se pudo guardar: ${saveError.message}` }, { status: 500 });
    return NextResponse.json({ ok: true, result, run: saved });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "No se pudo analizar el contenido." }, { status: 500 });
  }
}
