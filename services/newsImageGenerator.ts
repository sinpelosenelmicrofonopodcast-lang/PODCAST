import { escapeSvgText, svgToDataUrl } from "@/lib/images/utils";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { asString } from "@/lib/validations/common";
import { buildSpmCoverPrompt } from "@/lib/news/spmCoverPrompt";

export type GeneratedNewsImage = {
  imageUrl: string;
  prompt: string;
  fileName: string;
  headline: string;
  subtitle: string;
  visualBrief: string;
  width: number;
  height: number;
  usedOriginalImage: boolean;
};

function wrapText(raw: string, maxChars: number, maxLines: number) {
  const words = asString(raw, 180).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length === maxLines) break;
  }

  if (current && lines.length < maxLines) lines.push(current);
  const clipped = lines.slice(0, maxLines);
  if (words.join(" ").length > clipped.join(" ").length) {
    const last = clipped[clipped.length - 1] ?? "";
    clipped[clipped.length - 1] = last.length > 3 ? `${last.slice(0, Math.max(0, last.length - 3))}...` : last;
  }
  return clipped.map((line) => escapeSvgText(line));
}

export function generateSpmNewsImage(input: {
  title: string;
  summary?: string | null;
  category?: string | null;
  region?: string | null;
  sourceName?: string | null;
  originalImageUrl?: string | null;
}) {
  const spec = buildSpmCoverPrompt({
    title: input.title,
    summary: input.summary,
    category: input.category,
    region: input.region,
    sourceName: input.sourceName
  });
  const titleLines = wrapText(spec.headline, 18, 2);
  const subtitle = escapeSvgText(asString(spec.subtitle, 90));
  const originalImageUrl = normalizeImageUrl(input.originalImageUrl);
  const useOriginal = Boolean(originalImageUrl);

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#090909" />
      <stop offset="50%" stop-color="#1a1111" />
      <stop offset="100%" stop-color="#320909" />
    </linearGradient>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,0.12)" />
      <stop offset="100%" stop-color="rgba(0,0,0,0.78)" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="14" stdDeviation="12" flood-color="rgba(0,0,0,0.65)" />
    </filter>
    <pattern id="noise" width="140" height="140" patternUnits="userSpaceOnUse">
      <circle cx="12" cy="12" r="1" fill="rgba(255,255,255,0.08)" />
      <circle cx="86" cy="30" r="1" fill="rgba(255,255,255,0.05)" />
      <circle cx="54" cy="88" r="1" fill="rgba(255,255,255,0.05)" />
      <circle cx="114" cy="112" r="1" fill="rgba(255,255,255,0.06)" />
    </pattern>
  </defs>
  <rect width="1280" height="720" fill="url(#bg)" />
  ${useOriginal ? `<image href="${escapeSvgText(originalImageUrl ?? "")}" x="0" y="0" width="1280" height="720" preserveAspectRatio="xMidYMid slice" />` : ""}
  <rect width="1280" height="720" fill="url(#fade)" />
  <rect width="1280" height="720" fill="url(#noise)" opacity="0.45" />
  <rect x="0" y="0" width="1280" height="92" fill="#9b0d10" />
  <text x="78" y="58" fill="#ffffff" font-family="Arial Black, Arial" font-size="40" letter-spacing="2">SPM NOTICIAS</text>
  <rect x="62" y="140" width="1156" height="510" rx="28" fill="rgba(0,0,0,0.26)" stroke="rgba(255,255,255,0.08)" />
  <g filter="url(#shadow)">
    ${titleLines
      .map(
        (line, index) =>
          `<text x="640" y="${290 + index * 86}" text-anchor="middle" fill="#ffffff" font-family="Arial Black, Arial" font-size="72">${line}</text>`
      )
      .join("\n")}
  </g>
  <text x="640" y="560" text-anchor="middle" fill="#ffd54f" font-family="Arial Black, Arial" font-size="34">${subtitle}</text>
  <text x="1180" y="670" text-anchor="end" fill="#ffffff" font-family="Arial Black, Arial" font-size="26">sinpelosenelmicrofono</text>
</svg>`.trim();

  return {
    imageUrl: svgToDataUrl(svg),
    prompt: spec.prompt,
    fileName: spec.fileName,
    headline: spec.headline,
    subtitle: spec.subtitle,
    visualBrief: spec.visualBrief,
    width: 1280,
    height: 720,
    usedOriginalImage: useOriginal
  } satisfies GeneratedNewsImage;
}
