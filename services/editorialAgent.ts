import { runJsonChat } from "@/lib/ai/client";

export type EditorialMode = "podcast" | "news";

export type PodcastEditorialInput = {
  mode: "podcast";
  episode?: string;
  title: string;
  guest?: string;
  sourceUrl?: string;
  metadata?: string;
  transcript: string;
};

export type NewsEditorialInput = {
  mode: "news";
  title: string;
  sourceUrl?: string;
  sourceName?: string;
  region?: string;
  sourceText: string;
  additionalSources?: string;
};

export type EditorialInput = PodcastEditorialInput | NewsEditorialInput;

export type EditorialEvidence = {
  label: string;
  detail: string;
  evidence: string;
  timestamp?: string | null;
};

export type EditorialArticleIdea = {
  title: string;
  angle: string;
  searchIntent: string;
  score: number;
};

export type EditorialDraft = {
  title: string;
  dek: string;
  excerpt: string;
  body: string;
  seoTitle: string;
  metaDescription: string;
  slug: string;
  keywords: string[];
  tags: string[];
  category: string;
};

export type EditorialResult = {
  mode: EditorialMode;
  score: number;
  scoreReason: string;
  summary: string;
  facts: string[];
  teachings: EditorialEvidence[];
  impacts: EditorialEvidence[];
  quotes: Array<{
    quote: string;
    timestamp: string | null;
    context: string;
    verified: boolean;
  }>;
  whyItMatters: string;
  plainLanguage: string;
  spmAngle: string;
  articleIdeas: EditorialArticleIdea[];
  draft: EditorialDraft;
  social: {
    facebook: string;
    youtubeCommunity: string;
    reelHooks: string[];
  };
  review: {
    claimsNeedingReview: string[];
    missingContext: string[];
    publicationRecommendation: "draft" | "review" | "ready";
  };
  model: string;
};

function text(value: unknown, max = 12000) {
  return String(value ?? "").trim().slice(0, max);
}

function list(value: unknown, max = 10) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => text(item, 800)).filter(Boolean).slice(0, max);
}

function score(value: unknown) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function normalizeEvidence(value: unknown): EditorialEvidence[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item: any) => ({
      label: text(item?.label ?? item?.title, 180),
      detail: text(item?.detail ?? item?.insight ?? item?.why, 900),
      evidence: text(item?.evidence ?? item?.source ?? item?.support, 900),
      timestamp: text(item?.timestamp, 40) || null
    }))
    .filter((item) => item.label && item.detail)
    .slice(0, 8);
}

function normalizeIdeas(value: unknown): EditorialArticleIdea[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item: any) => ({
      title: text(item?.title, 180),
      angle: text(item?.angle, 500),
      searchIntent: text(item?.search_intent ?? item?.searchIntent, 220),
      score: score(item?.score)
    }))
    .filter((item) => item.title)
    .slice(0, 8);
}

function normalizeQuotes(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item: any) => ({
      quote: text(item?.quote, 500),
      timestamp: text(item?.timestamp, 40) || null,
      context: text(item?.context, 600),
      verified: item?.verified === true
    }))
    .filter((item) => item.quote)
    .slice(0, 8);
}

function modelName() {
  return text(process.env.AI_GATEWAY_NEWS_MODEL ?? process.env.OPENAI_NEWS_MODEL ?? "openai/gpt-5-mini", 100);
}

function buildPodcastPrompt(input: PodcastEditorialInput) {
  return {
    role: "user" as const,
    content: JSON.stringify({
      task: "Analiza este episodio completo como Editor-in-Chief de Sin Pelos. Extrae valor editorial real, no un resumen genérico.",
      episode: input.episode ?? "",
      title: input.title,
      guest: input.guest ?? "",
      source_url: input.sourceUrl ?? "",
      metadata: input.metadata ?? "",
      transcript: input.transcript.slice(0, 85000),
      required_work: [
        "Identifica de 3 a 7 ENSEÑANZAS que realmente deja la conversación.",
        "Identifica de 3 a 7 cosas que MÁS NOS IMPACTARON y explica por qué.",
        "Extrae frases fuertes SOLO si aparecen literalmente en el transcript. Incluye timestamp solo si está visible en la fuente.",
        "Propón de 4 a 8 artículos independientes que puedan vivir años en Google sin depender del título del episodio.",
        "Escoge el mejor ángulo y redacta un artículo completo útil, humano, con voz Sin Pelos y sin convertirlo en una transcripción.",
        "Genera SEO y un mini paquete social derivado del análisis.",
        "Marca cualquier afirmación que necesite revisión humana. Nunca inventes una cita, timestamp, hecho, intención o biografía."
      ]
    })
  };
}

function buildNewsPrompt(input: NewsEditorialInput) {
  return {
    role: "user" as const,
    content: JSON.stringify({
      task: "Trabaja esta historia como newsroom de Sin Pelos, separando hechos, contexto y opinión editorial.",
      title: input.title,
      source_name: input.sourceName ?? "",
      source_url: input.sourceUrl ?? "",
      region_hint: input.region ?? "",
      source_text: input.sourceText.slice(0, 65000),
      additional_sources: (input.additionalSources ?? "").slice(0, 25000),
      required_work: [
        "Extrae solo hechos sostenidos por el material suministrado.",
        "Señala lo no confirmado o contradictorio.",
        "Puntúa relevancia 0-100 considerando actualidad, impacto Puerto Rico/Texas/latinos, conversación y utilidad.",
        "Explica por qué importa y luego explícalo en arroz y habichuelas.",
        "Crea un ángulo Sin Pelos fuerte pero claramente separado de los hechos.",
        "Propón artículos/seguimientos y redacta un draft completo.",
        "Nunca acuses, diagnostiques, atribuyas intención ni completes huecos con imaginación."
      ]
    })
  };
}

const SYSTEM_PROMPT = [
  "Eres SPM Editorial Engine, el cerebro editorial de Sin Pelos en el Micrófono.",
  "Tu voz es puertorriqueña, directa, humana y sin relleno. Puedes ser intensa, pero los hechos mandan.",
  "Tu trabajo NO es publicar. Estás en MODO MANUAL: producir análisis y drafts para revisión humana.",
  "Nunca inventes citas, timestamps, personas, cifras, contexto, enlaces, fuentes ni sucesos.",
  "Una enseñanza debe estar sostenida por lo que realmente se dijo; no conviertas una opinión en un hecho.",
  "En podcast, distingue entre lo que dijo el invitado/host y la interpretación editorial.",
  "En noticias, separa HECHOS / POR QUÉ IMPORTA / EN ARROZ Y HABICHUELAS / ÁNGULO SIN PELOS.",
  "Evita copiar párrafos largos de la fuente. Resume y transforma.",
  "No uses signos de apertura españoles ¿ ni ¡ en copy social generado.",
  "Devuelve SOLO JSON válido con exactamente estas claves raíz: mode, score, score_reason, summary, facts, teachings, impacts, quotes, why_it_matters, plain_language, spm_angle, article_ideas, draft, social, review.",
  "teachings e impacts: array de {label, detail, evidence, timestamp|null}.",
  "quotes: array de {quote, timestamp|null, context, verified}; verified=true solo cuando la cita literal aparece en el material.",
  "article_ideas: array de {title, angle, search_intent, score}.",
  "draft: {title, dek, excerpt, body, seo_title, meta_description, slug, keywords, tags, category}.",
  "social: {facebook, youtube_community, reel_hooks}.",
  "review: {claims_needing_review, missing_context, publication_recommendation}; recommendation solo draft|review|ready.",
  "El body del artículo debe tener estructura legible con subtítulos Markdown y normalmente 700-1400 palabras cuando hay suficiente material."
].join("\n");

function fallback(input: EditorialInput, reason: string): EditorialResult {
  const title = text(input.title, 180) || "Sin título";
  return {
    mode: input.mode,
    score: 0,
    scoreReason: reason,
    summary: "No se pudo completar el análisis editorial con IA. El material permanece intacto para volver a intentarlo.",
    facts: [],
    teachings: [],
    impacts: [],
    quotes: [],
    whyItMatters: "",
    plainLanguage: "",
    spmAngle: "",
    articleIdeas: [],
    draft: {
      title,
      dek: "",
      excerpt: "",
      body: "",
      seoTitle: title,
      metaDescription: "",
      slug: slugify(title),
      keywords: [],
      tags: [],
      category: input.mode === "podcast" ? "Desde el Micrófono" : "Noticias"
    },
    social: { facebook: "", youtubeCommunity: "", reelHooks: [] },
    review: { claimsNeedingReview: [], missingContext: [reason], publicationRecommendation: "draft" },
    model: "fallback"
  };
}

export async function runEditorialAgent(input: EditorialInput): Promise<EditorialResult> {
  if (!text(input.title, 180)) throw new Error("Falta título.");
  if (input.mode === "podcast" && text(input.transcript, 1000).length < 120) {
    throw new Error("El transcript está demasiado corto para analizar el episodio.");
  }
  if (input.mode === "news" && text(input.sourceText, 1000).length < 80) {
    throw new Error("La fuente está demasiado corta para verificar la historia.");
  }

  try {
    const raw = await runJsonChat([
      { role: "system", content: SYSTEM_PROMPT },
      input.mode === "podcast" ? buildPodcastPrompt(input) : buildNewsPrompt(input)
    ]);

    const draftRaw: any = raw.draft ?? {};
    const socialRaw: any = raw.social ?? {};
    const reviewRaw: any = raw.review ?? {};
    const title = text(draftRaw.title ?? input.title, 180) || input.title;
    const publicationRecommendation = String(reviewRaw.publication_recommendation ?? "review");

    return {
      mode: input.mode,
      score: score(raw.score),
      scoreReason: text(raw.score_reason, 700),
      summary: text(raw.summary, 1800),
      facts: list(raw.facts, 12),
      teachings: normalizeEvidence(raw.teachings),
      impacts: normalizeEvidence(raw.impacts),
      quotes: normalizeQuotes(raw.quotes),
      whyItMatters: text(raw.why_it_matters, 1800),
      plainLanguage: text(raw.plain_language, 1800),
      spmAngle: text(raw.spm_angle, 1800),
      articleIdeas: normalizeIdeas(raw.article_ideas),
      draft: {
        title,
        dek: text(draftRaw.dek, 360),
        excerpt: text(draftRaw.excerpt, 500),
        body: text(draftRaw.body, 18000),
        seoTitle: text(draftRaw.seo_title ?? title, 120) || title,
        metaDescription: text(draftRaw.meta_description, 180),
        slug: slugify(text(draftRaw.slug ?? title, 160)),
        keywords: list(draftRaw.keywords, 12).map((item) => item.slice(0, 80)),
        tags: list(draftRaw.tags, 12).map((item) => item.slice(0, 60)),
        category: text(draftRaw.category, 80) || (input.mode === "podcast" ? "Desde el Micrófono" : "Noticias")
      },
      social: {
        facebook: text(socialRaw.facebook, 1800),
        youtubeCommunity: text(socialRaw.youtube_community, 1800),
        reelHooks: list(socialRaw.reel_hooks, 8)
      },
      review: {
        claimsNeedingReview: list(reviewRaw.claims_needing_review, 12),
        missingContext: list(reviewRaw.missing_context, 12),
        publicationRecommendation:
          publicationRecommendation === "ready" || publicationRecommendation === "draft" ? publicationRecommendation : "review"
      },
      model: modelName()
    };
  } catch (error: any) {
    return fallback(input, text(error?.message ?? "No se pudo ejecutar el modelo.", 500));
  }
}
