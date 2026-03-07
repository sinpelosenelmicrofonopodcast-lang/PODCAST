import { PUBLISHER_NAME, canonicalUrl } from "@/lib/seo/constants";

const publisherLogo = canonicalUrl("/logo.png");

type JsonLdObject = Record<string, any>;

export function jsonLdScript(data: JsonLdObject) {
  return JSON.stringify(data);
}

export function buildNewsArticleJsonLd(input: {
  canonicalPath: string;
  title: string;
  description?: string | null;
  image?: string | null;
  datePublished?: string | null;
  dateModified?: string | null;
  authorName?: string | null;
  tags?: string[] | null;
  category?: string | null;
  isNews?: boolean;
}) {
  const canonical = canonicalUrl(input.canonicalPath);
  return {
    "@context": "https://schema.org",
    "@type": input.isNews === false ? "Article" : "NewsArticle",
    headline: input.title,
    description: input.description || undefined,
    image: input.image ? [input.image] : undefined,
    datePublished: input.datePublished || undefined,
    dateModified: input.dateModified || input.datePublished || undefined,
    author: {
      "@type": "Person",
      name: input.authorName || PUBLISHER_NAME
    },
    publisher: {
      "@type": "Organization",
      name: PUBLISHER_NAME,
      logo: {
        "@type": "ImageObject",
        url: publisherLogo
      }
    },
    mainEntityOfPage: canonical,
    articleSection: input.category || undefined,
    keywords: (input.tags ?? []).filter(Boolean).join(", ") || undefined,
    isAccessibleForFree: true
  };
}

export function buildPodcastSeriesJsonLd(input: {
  canonicalPath: string;
  name: string;
  description: string;
  image?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "PodcastSeries",
    name: input.name,
    description: input.description,
    url: canonicalUrl(input.canonicalPath),
    image: input.image || undefined,
    publisher: {
      "@type": "Organization",
      name: PUBLISHER_NAME
    }
  };
}

export function buildPodcastEpisodeJsonLd(input: {
  canonicalPath: string;
  title: string;
  description?: string | null;
  datePublished?: string | null;
  audioUrl?: string | null;
  youtubeUrl?: string | null;
  thumbnailUrl?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "PodcastEpisode",
    name: input.title,
    description: input.description || undefined,
    datePublished: input.datePublished || undefined,
    url: canonicalUrl(input.canonicalPath),
    thumbnailUrl: input.thumbnailUrl || undefined,
    embedUrl: input.youtubeUrl || undefined,
    associatedMedia: input.audioUrl
      ? {
          "@type": "AudioObject",
          contentUrl: input.audioUrl
        }
      : undefined,
    partOfSeries: {
      "@type": "PodcastSeries",
      name: "Sin Pelos en el Micrófono"
    }
  };
}

export function buildVideoJsonLd(input: {
  canonicalPath: string;
  title: string;
  description?: string | null;
  uploadDate?: string | null;
  thumbnailUrl?: string | null;
  embedUrl?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: input.title,
    description: input.description || undefined,
    uploadDate: input.uploadDate || undefined,
    thumbnailUrl: input.thumbnailUrl || undefined,
    embedUrl: input.embedUrl || undefined,
    url: canonicalUrl(input.canonicalPath)
  };
}

export function buildEventJsonLd(input: {
  canonicalPath: string;
  title: string;
  description?: string | null;
  startDate: string;
  endDate?: string | null;
  image?: string | null;
  locationName?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  organizerName?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: input.title,
    description: input.description || undefined,
    startDate: input.startDate,
    endDate: input.endDate || undefined,
    image: input.image ? [input.image] : undefined,
    url: canonicalUrl(input.canonicalPath),
    organizer: input.organizerName
      ? {
          "@type": "Organization",
          name: input.organizerName
        }
      : undefined,
    location: {
      "@type": "Place",
      name: input.locationName || input.city || "Sin Pelos",
      address: {
        "@type": "PostalAddress",
        streetAddress: input.address || undefined,
        addressLocality: input.city || undefined,
        addressRegion: input.state || undefined,
        addressCountry: "US"
      }
    }
  };
}
