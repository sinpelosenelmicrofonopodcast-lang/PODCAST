import type { IngestedCandidate } from "@/types/viral";
import { runJsonChat } from "@/lib/ai/client";
import { asOptionalString, asString, asStringArray } from "@/lib/validations/common";
import { cleanNewsCategories } from "@/lib/newsCategories";

export type GeneratedNewsDraft = {
  title: string;
  summary: string;
  analysis: string;
  tags: string[];
  hashtags: string[];
  category: string;
  region: string;
  seoTitle: string;
  subtitle: string;
  model: string;
};

const SAFE_HASHTAG_MAP: Record<string, string> = {
  pr: "PuertoRico",
  tx: "Texas",
  usa: "USA",
  mundo: "Noticias",
  crimen: "Crimen",
  politica: "Politica",
  "última hora": "UltimaHora",
  ultima: "UltimaHora",
  viral: "Viral",
  latino: "Latino",
  breaking: "BreakingNews"
};

function normalizeRegion(article: IngestedCandidate) {
  const region = String(article.region ?? article.category ?? "USA").trim();
  if (!region) return "USA";
  if (/^puerto rico$/i.test(region)) return "PR";
  if (/^texas$/i.test(region)) return "TX";
  if (/^(estados unidos|u\.?s\.?a?|us)$/i.test(region)) return "USA";
  return region;
}

function normalizeCategory(article: IngestedCandidate) {
  const categories = cleanNewsCategories([article.category, ...(article.categories ?? [])]);
  if (categories.length === 0) return "USA";

  const mapped = categories.find((item) => ["PR", "TX", "USA", "Mundo", "Crimen", "Politica"].includes(item));
  if (mapped) return mapped;

  const lower = categories.join(" ").toLowerCase();
  if (lower.includes("crimen")) return "Crimen";
  if (lower.includes("polit")) return "Politica";
  return categories[0] ?? "USA";
}

function sentenceCase(input: string) {
  const clean = asString(input, 220);
  if (!clean) return "";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function trimTitle(raw: string) {
  const clean = asString(raw, 110)
    .replace(/\s*[-|:]\s*(cnn|bbc|fox news|ap news|telemundo|univision|nytimes|new york times)$/i, "")
    .trim();
  return clean || "Última hora";
}

function buildFallbackTitle(article: IngestedCandidate) {
  const prefix =
    (article.impactReasons ?? []).some((reason) => /crimen|muerte|violencia/i.test(reason)) ? "URGENTE" : normalizeRegion(article);
  return asString(`${prefix}: ${trimTitle(article.title)}`, 88);
}

function buildFallbackSubtitle(article: IngestedCandidate) {
  const reasons = article.impactReasons?.slice(0, 2).join(" · ");
  return asString(reasons || `${article.sourceName} · ${normalizeCategory(article)}`, 90);
}

function buildFallbackSummary(article: IngestedCandidate) {
  const sourceSummary = asString(article.summary || article.content || article.title, 210);
  const region = normalizeRegion(article);
  return asString(`${sourceSummary} En SPM esto pega duro por su impacto en ${region}.`, 220);
}

function buildFallbackAnalysis(article: IngestedCandidate) {
  const trendLine = article.trendMatches?.length
    ? `El tema ya conecta con la conversación caliente alrededor de ${article.trendMatches.slice(0, 3).join(", ")}.`
    : "Esto tiene ingredientes claros para prender conversación y reacción.";
  const region = normalizeRegion(article);
  const impactLine =
    article.impactReasons?.length
      ? `Lo que dispara el interés aquí es ${article.impactReasons.slice(0, 3).join(", ")}.`
      : "Hay elementos de alto impacto, contexto sensible y potencial de viralidad.";

  return asString(
    [
      `Lo confirmado hasta ahora: ${asString(article.summary || article.content || article.title, 420)}.`,
      `En clave SPM: ${impactLine} ${trendLine} Si esto sigue escalando, la conversación en ${region} no va a bajar sola.`,
      `Fuente base: ${article.sourceName}. Hay que vigilar actualizaciones y confirmar cualquier cambio antes de publicar definitivo.`
    ].join("\n\n"),
    2400
  );
}

function toHashtagToken(value: string) {
  const cleaned = String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .replace(/^#+/, "");
  if (!cleaned) return "";
  const direct = SAFE_HASHTAG_MAP[cleaned.toLowerCase()];
  return direct || cleaned.slice(0, 22);
}

function buildFallbackHashtags(article: IngestedCandidate, category: string, region: string) {
  const tokens = new Set<string>();
  tokens.add("SPMNoticias");
  tokens.add(toHashtagToken(region));
  tokens.add(toHashtagToken(category));
  (article.tags ?? []).slice(0, 4).forEach((tag) => tokens.add(toHashtagToken(tag)));
  (article.trendMatches ?? []).slice(0, 2).forEach((tag) => tokens.add(toHashtagToken(tag)));
  return Array.from(tokens)
    .filter(Boolean)
    .map((tag) => `#${tag}`)
    .slice(0, 8);
}

function buildFallbackTags(article: IngestedCandidate, category: string, region: string) {
  const tags = new Set<string>();
  tags.add(category.toLowerCase());
  tags.add(region.toLowerCase());
  (article.tags ?? []).forEach((tag) => tags.add(asString(tag, 32).toLowerCase()));
  (article.trendMatches ?? []).slice(0, 3).forEach((tag) => tags.add(asString(tag, 32).toLowerCase()));
  return Array.from(tags).filter(Boolean).slice(0, 10);
}

function normalizeHashtags(value: unknown, fallback: string[]) {
  const raw = Array.isArray(value) ? value : [];
  const tags = raw
    .map((item) => {
      const text = asString(item, 32).replace(/\s+/g, "");
      if (!text) return "";
      return text.startsWith("#") ? text : `#${text}`;
    })
    .filter(Boolean);
  return tags.length > 0 ? tags.slice(0, 8) : fallback;
}

function normalizeModelName() {
  return asString(process.env.OPENAI_NEWS_MODEL ?? "gpt-4o-mini", 80) || "fallback";
}

async function generateWithAI(article: IngestedCandidate) {
  const result = await runJsonChat([
    {
      role: "system",
      content: [
        "Eres editor de Sin Pelos en el Micrófono para breaking news.",
        "Redacta en español con tono directo, callejero y fuerte, pero sin inventar hechos.",
        "Separa hechos del análisis editorial. Si algo no está confirmado, dilo.",
        "Optimiza para CTR, claridad móvil y reacción social.",
        "No uses lenguaje difamatorio ni vulgaridades explícitas.",
        "Devuelve SOLO JSON válido con: title, seo_title, subtitle, summary, analysis, tags, hashtags, category, region."
      ].join("\n")
    },
    {
      role: "user",
      content: JSON.stringify({
        source_name: article.sourceName,
        source_url: article.sourceUrl,
        title: article.title,
        summary: article.summary,
        body: article.content,
        region_hint: normalizeRegion(article),
        category_hint: normalizeCategory(article),
        impact_score: Number(article.impactScore ?? 0),
        viral_score: Number(article.viralScore ?? 0),
        trend_matches: article.trendMatches ?? [],
        impact_reasons: article.impactReasons ?? [],
        desired_output: {
          title: "titular corto, agresivo, directo, <= 88 caracteres",
          seo_title: "titular seo <= 110 caracteres",
          subtitle: "subtitulo amarillo <= 90 caracteres",
          summary: "1 parrafo contundente <= 220 caracteres",
          analysis: "2-3 parrafos, estilo SPM, sin inventar datos, 500-1800 caracteres",
          tags: ["lista", "tags"],
          hashtags: ["#tag1", "#tag2"],
          category: "PR|TX|USA|Mundo|Crimen|Politica",
          region: "PR|TX|USA|Mundo"
        }
      })
    }
  ]);

  return {
    title: asString(result.title ?? "", 88),
    seoTitle: asString(result.seo_title ?? "", 110),
    subtitle: asString(result.subtitle ?? "", 90),
    summary: asString(result.summary ?? "", 220),
    analysis: asString(result.analysis ?? "", 2600),
    tags: asStringArray(result.tags, 10, 32),
    hashtags: normalizeHashtags(result.hashtags, []),
    category: asString(result.category ?? "", 40),
    region: asString(result.region ?? "", 20)
  };
}

export async function generateNewsDraftContent(article: IngestedCandidate): Promise<GeneratedNewsDraft> {
  const fallbackCategory = normalizeCategory(article);
  const fallbackRegion = normalizeRegion(article);
  const fallbackTags = buildFallbackTags(article, fallbackCategory, fallbackRegion);
  const fallbackHashtags = buildFallbackHashtags(article, fallbackCategory, fallbackRegion);
  const fallback: GeneratedNewsDraft = {
    title: buildFallbackTitle(article),
    summary: buildFallbackSummary(article),
    analysis: buildFallbackAnalysis(article),
    tags: fallbackTags,
    hashtags: fallbackHashtags,
    category: fallbackCategory,
    region: fallbackRegion,
    seoTitle: asString(trimTitle(article.title), 110),
    subtitle: buildFallbackSubtitle(article),
    model: "fallback"
  };

  if (!process.env.OPENAI_API_KEY) return fallback;

  try {
    const generated = await generateWithAI(article);
    const category = generated.category || fallbackCategory;
    const region = generated.region || fallbackRegion;
    return {
      title: generated.title || fallback.title,
      summary: generated.summary || fallback.summary,
      analysis: generated.analysis || fallback.analysis,
      tags: generated.tags.length > 0 ? generated.tags : fallbackTags,
      hashtags: generated.hashtags.length > 0 ? generated.hashtags : fallbackHashtags,
      category: sentenceCase(category) || fallbackCategory,
      region: region || fallbackRegion,
      seoTitle: generated.seoTitle || fallback.seoTitle,
      subtitle: generated.subtitle || fallback.subtitle,
      model: normalizeModelName()
    };
  } catch {
    return fallback;
  }
}
