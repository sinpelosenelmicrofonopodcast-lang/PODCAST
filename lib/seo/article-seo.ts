import type { Metadata } from "next";
import { canonicalUrl, DEFAULT_OG_IMAGE, SITE_NAME } from "@/lib/seo/constants";
import type { NewsArticleRow } from "@/types/viral";

function trim(value: string, max: number) {
  const text = String(value ?? "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export function buildArticleSeo(article: Pick<NewsArticleRow, "slug" | "title" | "summary" | "excerpt" | "cover_image_url">): Metadata {
  const title = trim(`${article.title} | SPM News`, 60);
  const description = trim(article.summary || article.excerpt || "Sin Pelos en el Micrófono", 155);
  const path = `/noticias/${encodeURIComponent(article.slug)}`;
  const url = canonicalUrl(path);
  const image = article.cover_image_url || DEFAULT_OG_IMAGE;

  return {
    title,
    description,
    alternates: {
      canonical: url
    },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: "article",
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: article.title
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image]
    }
  };
}
