import { cleanNewsCategories } from "@/lib/newsCategories";

type RewriteInput = {
  sourceName: string;
  sourceUrl: string;
  originalTitle: string;
  originalSummary: string;
  originalBody: string;
  currentCategories?: string[] | null;
  currentTags?: string[] | null;
};

type RewriteOutput = {
  title: string;
  summary: string;
  analysis: string;
  categories: string[];
  tags: string[];
  needsReview: boolean;
  model: string;
};

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

function safeText(v: unknown, fallback = "") {
  const value = String(v ?? "").trim();
  return value || fallback;
}

function asStringArray(v: unknown) {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
    .slice(0, 12);
}

function parseJsonObject(text: string) {
  const raw = String(text ?? "").trim();
  if (!raw) throw new Error("Respuesta vacía del modelo.");

  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("La respuesta no devolvió JSON válido.");
    return JSON.parse(match[0]);
  }
}

export async function rewriteNewsWithAI(input: RewriteInput): Promise<RewriteOutput> {
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  if (!apiKey) throw new Error("Falta OPENAI_API_KEY en servidor.");

  const model = process.env.OPENAI_NEWS_MODEL ?? "gpt-4o-mini";
  const endpoint = process.env.OPENAI_API_BASE_URL ?? "https://api.openai.com/v1";

  const systemPrompt = [
    "Eres editor senior de 'Sin Pelos en el Microfono'.",
    "Tu trabajo es mejorar la redacción dentro del formato existente, sin cambiar estructura ni campos.",
    "Debes entregar una noticia más premium, clara, entretenida y periodística, sin inventar hechos.",
    "",
    "Reglas obligatorias:",
    "1) Mantén precisión factual estricta. Nunca inventes datos, cifras, nombres, citas o fechas.",
    "2) Si falta confirmación, dilo explícitamente con frases como 'hasta el momento', 'según reportes iniciales', 'de acuerdo con información preliminar' o 'esto sigue en desarrollo'.",
    "3) Título con gancho periodístico y claridad (sin clickbait engañoso).",
    "4) Summary (max 280) debe explicar qué pasó, dónde, quién y por qué importa.",
    "5) Analysis en 2-4 párrafos: contexto, impacto, posibles consecuencias y qué sigue.",
    "6) Tono Sin Pelos: directo, con personalidad y ritmo; no robótico, no Wikipedia, no nota de prensa.",
    "7) No copies literal bloques largos de la fuente.",
    "8) Si el contenido fuente es insuficiente o ambiguo, marca needs_review=true.",
    "9) Responde SOLO json válido con: title, summary, analysis, categories, tags, needs_review."
  ].join("\n");

  const userPayload = {
    source_name: safeText(input.sourceName, "RSS"),
    source_url: safeText(input.sourceUrl),
    original_title: safeText(input.originalTitle),
    original_summary: safeText(input.originalSummary),
    original_body: safeText(input.originalBody),
    current_categories: input.currentCategories ?? [],
    current_tags: input.currentTags ?? [],
    editorial_target: {
      title: "más fuerte y periodístico",
      summary: "más claro, completo y escaneable",
      analysis: "más contexto, mejor flujo y cierre fuerte"
    }
  };

  const res = await fetch(`${endpoint.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(userPayload) }
      ]
    }),
    cache: "no-store"
  });

  const json = (await res.json().catch(() => ({}))) as OpenAIChatResponse & { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(json?.error?.message ?? `OpenAI error HTTP ${res.status}`);
  }

  const content = safeText(json?.choices?.[0]?.message?.content);
  const parsed = parseJsonObject(content) as Record<string, unknown>;

  const title = safeText(parsed.title, input.originalTitle);
  const summary = safeText(parsed.summary, input.originalSummary).slice(0, 280);
  const analysis = safeText(parsed.analysis, input.originalSummary || input.originalTitle);
  const parsedCategories = cleanNewsCategories(asStringArray(parsed.categories));
  const currentCategories = cleanNewsCategories(input.currentCategories ?? []);
  const categories = parsedCategories.length > 0 ? parsedCategories : currentCategories;
  const tags = asStringArray(parsed.tags);
  const needsReview = Boolean(parsed.needs_review);

  return {
    title,
    summary,
    analysis,
    categories,
    tags,
    needsReview,
    model
  };
}
