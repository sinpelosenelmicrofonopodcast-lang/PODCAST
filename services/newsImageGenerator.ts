import type { SupabaseClient } from "@supabase/supabase-js";
import { generateImage } from "ai";
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

function generateFallbackSpmNewsImage(input: {
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


function buildAiCoverPrompt(spec: ReturnType<typeof buildSpmCoverPrompt>) {
  return [
    "Create a professional 16:9 breaking-news cover for a Puerto Rican and Latino media brand.",
    "The newsworthy photorealistic editorial scene must fill the frame and be the dominant visual.",
    `Visual subject: ${spec.visualBrief}.`,
    "Use cinematic documentary lighting, natural skin and realistic environments.",
    "Do not depict a specific real person unless a source photo was supplied. Do not invent evidence, logos, badges, documents, injuries, weapons or identifiable victims.",
    'Add a slim red masthead with the exact words "SPM NOTICIAS".',
    `Add one short, large, highly legible Spanish headline: "${spec.headline}".`,
    'Add a small label "IMAGEN ILUSTRATIVA" in the lower left.',
    "Keep text inside safe margins. No paragraph text, no tiny subtitle, no clutter, no watermark, no distorted faces, no misspelled words.",
    "Color grade: deep blacks, restrained red accents, crisp white typography, premium television-news look."
  ].join(" ");
}

async function generateAiCover(
  spec: ReturnType<typeof buildSpmCoverPrompt>,
  service: SupabaseClient
): Promise<string | null> {
  const result = await generateImage({
    model: process.env.AI_GATEWAY_IMAGE_MODEL ?? "openai/gpt-image-2",
    prompt: buildAiCoverPrompt(spec),
    size: "1536x1024",
    providerOptions: {
      openai: {
        outputFormat: "webp",
        outputCompression: 65,
        moderation: "auto"
      }
    },
    abortSignal: AbortSignal.timeout(115000)
  });

  const generated = result.image;
  const bytes = generated.uint8Array;
  if (!bytes?.byteLength) throw new Error("Image generation returned no image.");
  if (bytes.byteLength > 1024 * 1024) {
    throw new Error("Generated image exceeds the 1 MB news-cover limit.");
  }

  const now = new Date();
  const folder = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const baseName = spec.fileName.replace(/\.png$/i, "").replace(/[^a-z0-9_-]+/gi, "-").slice(0, 90);
  const path = `ai/${folder}/${baseName}-${crypto.randomUUID()}.webp`;
  const bucket = process.env.NEWS_COVERS_BUCKET?.trim() || "news-covers";
  const upload = await service.storage.from(bucket).upload(path, bytes, {
    contentType: generated.mediaType || "image/webp",
    cacheControl: "31536000",
    upsert: false
  });
  if (upload.error) throw new Error(upload.error.message);

  const publicUrl = service.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  return normalizeImageUrl(publicUrl);
}

export async function generateSpmNewsImage(
  input: {
    title: string;
    summary?: string | null;
    category?: string | null;
    region?: string | null;
    sourceName?: string | null;
    originalImageUrl?: string | null;
  },
  service?: SupabaseClient
): Promise<GeneratedNewsImage & { generatedWithAI: boolean }> {
  const fallback = generateFallbackSpmNewsImage(input);
  const originalImageUrl = normalizeImageUrl(input.originalImageUrl);

  if (originalImageUrl || !service) {
    return { ...fallback, generatedWithAI: false };
  }

  try {
    const spec = buildSpmCoverPrompt(input);
    const imageUrl = await generateAiCover(spec, service);
    if (!imageUrl) return { ...fallback, generatedWithAI: false };
    return {
      ...fallback,
      imageUrl,
      fileName: spec.fileName.replace(/\.png$/i, ".webp"),
      generatedWithAI: true
    };
  } catch (error) {
    console.error("SPM AI cover generation failed", {
      message: error instanceof Error ? error.message : "Unknown error"
    });
    return { ...fallback, generatedWithAI: false };
  }
}
