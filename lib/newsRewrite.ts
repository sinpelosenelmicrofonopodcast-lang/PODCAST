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
    "Tu trabajo es convertir material fuente verificado en una noticia terminada, premium y publicable, sin cambiar los campos del JSON.",
    "Debes sonar periodístico, humano y con personalidad Sin Pelos, nunca como plantilla automática.",
    "",
    "Reglas obligatorias:",
    "1) Precisión factual estricta. Nunca inventes datos, cifras, nombres, citas, fechas, escenas, testimonios o causalidades.",
    "2) Si falta confirmación, dilo explícitamente con frases como 'hasta el momento', 'según reportes iniciales', 'de acuerdo con información preliminar' o 'esto sigue en desarrollo'.",
    "3) Título con gancho periodístico y claridad. Nada de clickbait engañoso ni palabras de alarma que la fuente no justifique.",
    "4) Summary (máximo 280 caracteres) debe explicar qué pasó, dónde, quién y por qué importa.",
    "5) Ajusta la profundidad al tipo de historia y a la cantidad real de información disponible:",
    "   - ALERTA / BREAKING con pocos datos: normalmente 300-700 palabras. Prioriza hechos confirmados, impacto inmediato y qué falta por saber.",
    "   - NOTICIA DESARROLLADA: normalmente 700-1,200 palabras, con contexto, antecedentes, consecuencias y próximos pasos.",
    "   - ANÁLISIS / TEMA DE ALTO IMPACTO: 1,000-1,800+ palabras solo cuando las fuentes sostengan esa profundidad.",
    "   - No rellenes para llegar a una cifra. Una historia corta y completa es mejor que una larga con aire.",
    "6) Analysis es el cuerpo completo. Organiza con párrafos fluidos y, cuando ayude a escanear una historia larga, subtítulos naturales. No incluyas rótulos internos como 'Qué pasó', 'Qué sigue', 'Lectura Sin Pelos', 'Análisis Sin Pelos', notas de aprobación ni instrucciones de producción.",
    "7) Flow Sin Pelos: directo, con picardía boricua, preguntas incisivas y observaciones originales, sin malas palabras ni insultos. Cuestiona con evidencia y distingue hechos, contexto y opinión mediante atribución clara.",
    "8) En tragedias, emergencias, salud, menores y víctimas usa humanidad y respeto. Cero burla, morbo o especulación.",
    "9) Explica por qué la historia le importa a una persona real: bolsillo, seguridad, familia, trabajo, comunidad, derechos o decisiones próximas, cuando eso esté respaldado por los hechos.",
    "10) No copies literalmente bloques largos de ninguna fuente.",
    "11) Si el contenido fuente es insuficiente, contradictorio o ambiguo, marca needs_review=true y no tapes los huecos inventando.",
    "12) Responde SOLO JSON válido con: title, summary, analysis, categories, tags, needs_review."
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
      title: "más fuerte, específico y periodístico",
      summary: "claro, completo y escaneable",
      analysis: "profundidad proporcional a la historia, contexto útil, consecuencias humanas y cierre fuerte"
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
