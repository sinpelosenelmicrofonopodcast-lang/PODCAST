import { canonicalUrl } from "@/lib/seo/constants";
import { asString } from "@/lib/validations/common";

function cleanText(value?: string | null) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function getConfessionShareImageUrl() {
  const configured = cleanText(process.env.NEXT_PUBLIC_CONFESIONES_SHARE_IMAGE_URL ?? process.env.NEXT_PUBLIC_CONFESIONARIO_BANNER_URL ?? "");
  if (configured.startsWith("http://") || configured.startsWith("https://")) return configured;
  return canonicalUrl(configured || "/confesionario-banner.png");
}

export function getConfessionBannerUrl() {
  const configured = cleanText(process.env.NEXT_PUBLIC_CONFESIONARIO_BANNER_URL ?? process.env.NEXT_PUBLIC_CONFESIONES_SHARE_IMAGE_URL ?? "");
  if (configured.startsWith("http://") || configured.startsWith("https://")) return configured;
  return configured || getConfessionShareImageUrl();
}

export function getConfessionLink(confessionId?: string | null) {
  const id = asString(confessionId, 120);
  return id ? canonicalUrl(`/confesiones/${encodeURIComponent(id)}`) : canonicalUrl("/confesiones");
}

export function buildConfessionHeadline(body?: string | null, title?: string | null) {
  const explicit = cleanText(title);
  if (explicit) return explicit.slice(0, 90);

  const source = cleanText(body);
  const words = source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 7)
    .join(" ");

  return words ? `${words}${words.length < source.length ? "..." : ""}`.slice(0, 90) : "Confesion anonima";
}

export function buildConfessionPreview(body?: string | null, max = 110) {
  const text = cleanText(body);
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}...`;
}

export function buildConfessionFacebookMessage(input: {
  body?: string | null;
  title?: string | null;
}) {
  const teaser = buildConfessionPreview(input.body, 95) || buildConfessionHeadline("", input.title);
  return [
    "Nueva confesion anonima en Sin Pelos.",
    "",
    `Soltaron esto: "${teaser}"`,
    "",
    "Lee la completa y tira la tuya completamente anonima para vacilar aqui:"
  ].join("\n");
}
