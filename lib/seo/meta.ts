import type { Metadata } from "next";
import { CANONICAL_SITE_URL, DEFAULT_OG_IMAGE, SITE_NAME, canonicalUrl } from "@/lib/seo/constants";

function compactText(value: string) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncateTitle(value: string, max = 60) {
  const clean = compactText(value);
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function truncateDescription(value: string, max = 155) {
  const clean = compactText(value);
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

type BuildSeoInput = {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  type?: "website" | "article";
  noindex?: boolean;
};

export function buildSeoMetadata(input: BuildSeoInput): Metadata {
  const url = canonicalUrl(input.path);
  const title = truncateTitle(input.title);
  const description = truncateDescription(input.description);
  const image = input.image || DEFAULT_OG_IMAGE;
  const robots = input.noindex
    ? { index: false, follow: false, googleBot: { index: false, follow: false } }
    : { index: true, follow: true };

  return {
    metadataBase: new URL(CANONICAL_SITE_URL),
    title,
    description,
    alternates: { canonical: url },
    robots,
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: input.type || "website",
      images: [{ url: image }]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image]
    }
  };
}

export function newsSeoTemplate(title: string, excerpt?: string | null) {
  const safeTitle = truncateTitle(`${title} | SPM News`);
  const safeDescription = truncateDescription(
    `${compactText(excerpt || title)} — Sin Pelos en el Micrófono.`
  );
  return { title: safeTitle, description: safeDescription };
}

export function episodeSeoTemplate(title: string, description?: string | null) {
  const safeTitle = truncateTitle(`${title} | Sin Pelos en el Micrófono`);
  const safeDescription = truncateDescription(
    `${compactText(description || title)} — Episodio completo.`
  );
  return { title: safeTitle, description: safeDescription };
}

export function regionSeoTemplate(region: string) {
  const safeRegion = compactText(region || "General");
  return {
    title: truncateTitle(`Noticias ${safeRegion} | SPM News`),
    description: truncateDescription(`Lo más caliente de ${safeRegion}: noticias, análisis y debate.`)
  };
}

export function eventSeoTemplate(title: string, description?: string | null) {
  return {
    title: truncateTitle(`${title} | Eventos | Sin Pelos`),
    description: truncateDescription(
      `${compactText(description || title)} — fecha, lugar y detalles.`
    )
  };
}
