type QualityInput = {
  title: string;
  summary: string;
  content: string;
  hasImage: boolean;
};

const SPANISH_HINTS = [
  " de ",
  " la ",
  " el ",
  " que ",
  " en ",
  " con ",
  " para ",
  " por ",
  " los ",
  " las ",
  " del ",
  " una ",
  " un "
];

const ENGLISH_HINTS = [
  " the ",
  " and ",
  " of ",
  " to ",
  " in ",
  " for ",
  " with ",
  " is ",
  " are ",
  " on ",
  "from "
];

function normalizeText(value: string) {
  return ` ${String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim()} `;
}

export function isLikelySpanish(value: string) {
  const text = normalizeText(value);
  if (!text.trim()) return false;

  const spanishHits = SPANISH_HINTS.reduce((acc, token) => acc + (text.includes(token) ? 1 : 0), 0);
  const englishHits = ENGLISH_HINTS.reduce((acc, token) => acc + (text.includes(token) ? 1 : 0), 0);
  const accentHits = (text.match(/[áéíóúñ]/g) ?? []).length;

  if (spanishHits >= 3 && englishHits <= 2) return true;
  if (accentHits >= 2 && spanishHits >= 1) return true;
  if (englishHits >= spanishHits + 2) return false;
  return spanishHits >= englishHits;
}

export function assessNewsCandidateQuality(input: QualityInput) {
  const title = String(input.title ?? "").trim();
  const summary = String(input.summary ?? "").trim();
  const content = String(input.content ?? "").trim();
  const joined = `${title} ${summary} ${content}`.slice(0, 2200);

  const reviewReasons: string[] = [];
  if (!title) reviewReasons.push("missing_title");
  else if (title.length < 18) reviewReasons.push("thin_title");

  if (!summary) reviewReasons.push("missing_summary");
  else if (summary.length < 90) reviewReasons.push("thin_summary");

  if (!content || content.length < 220) reviewReasons.push("thin_content");
  if (!input.hasImage) reviewReasons.push("missing_image");

  const spanish = isLikelySpanish(joined);
  if (!spanish) reviewReasons.push("non_spanish");

  let score = 100;
  if (reviewReasons.includes("missing_title")) score -= 30;
  if (reviewReasons.includes("thin_title")) score -= 10;
  if (reviewReasons.includes("missing_summary")) score -= 25;
  if (reviewReasons.includes("thin_summary")) score -= 15;
  if (reviewReasons.includes("thin_content")) score -= 20;
  if (reviewReasons.includes("missing_image")) score -= 10;
  if (reviewReasons.includes("non_spanish")) score -= 25;

  return {
    isLikelySpanish: spanish,
    reviewReasons,
    qualityScore: Math.max(0, score),
    readyForAutoPublish: reviewReasons.length === 0
  };
}

