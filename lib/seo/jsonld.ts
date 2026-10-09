import { PUBLISHER_NAME, SITE_NAME, canonicalUrl } from "@/lib/seo/constants";

const publisherLogo = canonicalUrl("/logo.png");
const organizationId = canonicalUrl("/#organization");

type JsonLdObject = Record<string, any>;

export function jsonLdScript(data: JsonLdObject) {
  return JSON.stringify(data);
}

export function buildBreadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: canonicalUrl(item.path)
    }))
  };
}

function editorialAuthor(authorName?: string | null) {
  const raw = String(authorName ?? "").trim();
  const generic = !raw || /^(spm news|sin pelos en el micr[oó]fono|redacci[oó]n sin pelos)$/i.test(raw);
  if (generic) {
    return {
      "@type": "Organization",
      name: "Redacción Sin Pelos",
      url: canonicalUrl("/noticias")
    };
  }
  return {
    "@type": "Person",
    name: raw
  };
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
  const article = {
    "@type": input.isNews === false ? "Article" : "NewsArticle",
    "@id": `${canonical}#article`,
    headline: input.title,
    description: input.description || undefined,
    image: input.image ? [input.image] : undefined,
    datePublished: input.datePublished || undefined,
    dateModified: input.dateModified || input.datePublished || undefined,
    author: editorialAuthor(input.authorName),
    publisher: {
      "@type": "Organization",
      "@id": organizationId,
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

  const breadcrumbs = buildBreadcrumbJsonLd([
    { name: "Inicio", path: "/" },
    { name: "Noticias", path: "/noticias" },
    { name: input.title, path: input.canonicalPath }
  ]);

  return {
    "@context": "https://schema.org",
    "@graph": [article, breadcrumbs]
  };
}

export function buildPodcastSeriesJsonLd(input: {
  canonicalPath: string;
  name: string;
  description: string;
  image?: string | null;
}) {
  const series = {
    "@type": "PodcastSeries",
    "@id": `${canonicalUrl(input.canonicalPath)}#series`,
    name: input.name,
    description: input.description,
    url: canonicalUrl(input.canonicalPath),
    image: input.image || undefined,
    publisher: {
      "@type": "Organization",
      "@id": organizationId,
      name: SITE_NAME,
      url: canonicalUrl("/"),
      logo: { "@type": "ImageObject", url: publisherLogo }
    }
  };
  const breadcrumbs = buildBreadcrumbJsonLd([
    { name: "Inicio", path: "/" },
    { name: "Podcast", path: input.canonicalPath }
  ]);
  return { "@context": "https://schema.org", "@graph": [series, breadcrumbs] };
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
  const episode = {
    "@type": "PodcastEpisode",
    "@id": `${canonicalUrl(input.canonicalPath)}#episode`,
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
      "@id": `${canonicalUrl("/podcast")}#series`,
      name: "Sin Pelos en el Micrófono"
    }
  };
  const breadcrumbs = buildBreadcrumbJsonLd([
    { name: "Inicio", path: "/" },
    { name: "Podcast", path: "/podcast" },
    { name: input.title, path: input.canonicalPath }
  ]);
  return { "@context": "https://schema.org", "@graph": [episode, breadcrumbs] };
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
  const event = {
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
  const breadcrumbs = buildBreadcrumbJsonLd([
    { name: "Inicio", path: "/" },
    { name: "Eventos", path: "/eventos" },
    { name: input.title, path: input.canonicalPath }
  ]);
  return { "@context": "https://schema.org", "@graph": [event, breadcrumbs] };
}
