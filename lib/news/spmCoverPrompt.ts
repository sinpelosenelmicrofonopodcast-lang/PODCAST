import { asString, slugify } from "@/lib/validations/common";

const STOPWORDS = new Set([
  "a",
  "al",
  "ante",
  "con",
  "contra",
  "de",
  "del",
  "desde",
  "el",
  "en",
  "entre",
  "hacia",
  "la",
  "las",
  "lo",
  "los",
  "para",
  "por",
  "que",
  "se",
  "sin",
  "sobre",
  "tras",
  "un",
  "una",
  "unos",
  "unas",
  "y"
]);

export type SpmCoverPromptInput = {
  title: string;
  summary?: string | null;
  category?: string | null;
  region?: string | null;
  sourceName?: string | null;
};

export type SpmCoverPromptSpec = {
  prompt: string;
  fileName: string;
  headline: string;
  subtitle: string;
  visualBrief: string;
  topic: string;
  keyword: string;
};

function normalizeWords(value: string) {
  return asString(value, 240)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function trimWords(value: string, maxWords: number, maxChars: number) {
  const words = asString(value, maxChars * 2)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords);
  const text = words.join(" ").slice(0, maxChars).trim();
  return text.replace(/[,:;.!?]+$/g, "");
}

function buildHeadline(title: string) {
  return trimWords(title, 7, 72) || "SPM Noticias";
}

function buildSubtitle(input: SpmCoverPromptInput) {
  const summary = trimWords(input.summary ?? "", 10, 90);
  if (summary) return summary;

  const fallback = [asString(input.category ?? "", 36), asString(input.region ?? "", 24)].filter(Boolean).join(" · ");
  return fallback || "Sin Pelos en el Microfono";
}

function extractKeywords(input: SpmCoverPromptInput) {
  const words = [
    ...normalizeWords(input.title),
    ...normalizeWords(input.category ?? ""),
    ...normalizeWords(input.region ?? "")
  ].filter((word) => !STOPWORDS.has(word));

  const topic = slugify(words[0] ?? "noticia");
  const keyword = slugify(words[1] ?? words[0] ?? "principal");
  return { topic, keyword };
}

function buildFileName(input: SpmCoverPromptInput) {
  const { topic, keyword } = extractKeywords(input);
  return `spm_${topic}_${keyword}.png`;
}

function inferVisualBrief(input: SpmCoverPromptInput) {
  const haystack = `${input.title} ${input.summary ?? ""} ${input.category ?? ""} ${input.region ?? ""}`.toLowerCase();
  const cues = new Set<string>();

  if (/(sub-?\d+|futbol|soccer|liga|seleccion|baloncesto|nba|mlb|boxeo|deporte|sports?)/i.test(haystack)) {
    cues.add("athletes in action");
    cues.add("stadium lights");
  }
  if (/(puerto rico|boricua|pr\b)/i.test(haystack)) {
    cues.add("Puerto Rico flag");
  }
  if (/(ee\.?uu|estados unidos|usa\b|u\.s\.|united states)/i.test(haystack)) {
    cues.add("United States flag");
  }
  if (/(presidente|gobierno|congreso|senado|alcalde|politic|eleccion|ley)/i.test(haystack)) {
    cues.add("press conference setting");
    cues.add("leaders and podiums");
  }
  if (/(asesin|crimen|fbi|tiroteo|arrest|policia|violencia|cartel|muerte)/i.test(haystack)) {
    cues.add("police lights");
    cues.add("crime scene tension");
  }
  if (/(huracan|tormenta|lluvia|clima|inundacion|viento|incendio)/i.test(haystack)) {
    cues.add("dramatic weather");
    cues.add("urgent atmosphere");
  }
  if (/(protesta|manifestacion|marcha|huelga)/i.test(haystack)) {
    cues.add("crowd protest scene");
    cues.add("signs and raised hands");
  }
  if (/(economia|mercado|bolsa|tarifa|inflacion|negocio|finanzas)/i.test(haystack)) {
    cues.add("financial district");
    cues.add("economic screens");
  }
  if (/(musica|cantante|artista|concierto|album|show)/i.test(haystack)) {
    cues.add("concert lighting");
    cues.add("artist on stage");
  }

  if (!cues.size) {
    cues.add("realistic people");
    cues.add("newsworthy setting");
    cues.add("intense expressions");
  }

  return Array.from(cues).slice(0, 4).join(", ");
}

export function buildSpmCoverPrompt(input: SpmCoverPromptInput): SpmCoverPromptSpec {
  const headline = buildHeadline(input.title);
  const subtitle = buildSubtitle(input);
  const { topic, keyword } = extractKeywords(input);
  const fileName = buildFileName(input);
  const visualBrief = inferVisualBrief(input);

  const prompt = [
    'Portada oficial estilo SPM News para "Sin Pelos en el Microfono", formato 16:9, diseno fijo y consistente.',
    'Fondo oscuro con textura, cinematic lighting, high contrast, dramatic shadows, ultra sharp, professional news design.',
    'Barra roja arriba con texto exacto "SPM NOTICIAS" en blanco bold.',
    `Titular grande centrado en blanco con maximo 5-7 palabras: "${headline}".`,
    `Subtitulo en amarillo debajo: "${subtitle}".`,
    `Imagen principal realista relacionada a la noticia con estos elementos clave: ${visualBrief}.`,
    "La imagen debe representar visualmente la noticia con personas, banderas, deportes, politica o accion segun aplique.",
    'Logo "SPM News" en la esquina inferior derecha sin distorsion.',
    "No caricaturas, no estilos artisticos raros, no deformar caras, no texto ilegible, no cambiar layout, no improvisar estilos nuevos."
  ].join(" ");

  return {
    prompt,
    fileName,
    headline,
    subtitle,
    visualBrief,
    topic,
    keyword
  };
}
