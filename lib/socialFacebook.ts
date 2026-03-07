export type FacebookPostNewsInput = {
  newsId: string;
  newsSlug?: string | null;
  title?: string | null;
  summary?: string | null;
};

export type FacebookPostBlogInput = {
  blogId: string;
  blogSlug?: string | null;
  title?: string | null;
  excerpt?: string | null;
};

export type FacebookPostEpisodeInput = {
  episodeId: string;
  episodeSlug?: string | null;
  title?: string | null;
  description?: string | null;
  sourceUrl?: string | null;
  customText?: string | null;
};

function getConfig() {
  return {
    pageId: process.env.META_PAGE_ID ?? "",
    pageAccessToken: process.env.META_PAGE_ACCESS_TOKEN ?? "",
    graphVersion: process.env.META_GRAPH_VERSION ?? "v24.0",
    baseUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  };
}

function shortText(value: string, max = 320) {
  const clean = String(value ?? "").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

function cleanInlineText(value?: string | null) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function postNewsToFacebook(input: FacebookPostNewsInput) {
  const { pageId, pageAccessToken, graphVersion, baseUrl } = getConfig();
  if (!pageId || !pageAccessToken) {
    throw new Error("Faltan META_PAGE_ID o META_PAGE_ACCESS_TOKEN.");
  }

  const newsId = String(input.newsId ?? "").trim();
  if (!newsId) throw new Error("newsId requerido.");
  const newsSlug = String(input.newsSlug ?? "").trim();

  const title = String(input.title ?? "").trim();
  const summary = String(input.summary ?? "").trim();
  const linkKey = newsSlug || newsId;
  const link = `${baseUrl.replace(/\/$/, "")}/noticias/${encodeURIComponent(linkKey)}`;
  const message = summary ? `${title}\n\n${summary}` : title || "Nueva noticia";

  const form = new URLSearchParams();
  form.set("message", message);
  form.set("link", link);
  form.set("access_token", pageAccessToken);

  const res = await fetch(`https://graph.facebook.com/${graphVersion}/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString()
  });
  const json = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    const message = json?.error?.message ?? "Meta API error";
    throw new Error(message);
  }

  return {
    ok: true as const,
    postId: String(json?.id ?? ""),
    link
  };
}

export async function postBlogToFacebook(input: FacebookPostBlogInput) {
  const { pageId, pageAccessToken, graphVersion, baseUrl } = getConfig();
  if (!pageId || !pageAccessToken) {
    throw new Error("Faltan META_PAGE_ID o META_PAGE_ACCESS_TOKEN.");
  }

  const blogId = String(input.blogId ?? "").trim();
  if (!blogId) throw new Error("blogId requerido.");
  const blogSlug = String(input.blogSlug ?? "").trim();

  const title = String(input.title ?? "").trim();
  const excerpt = shortText(String(input.excerpt ?? "").replace(/\s+/g, " "));
  const linkKey = blogSlug || blogId;
  const link = `${baseUrl.replace(/\/$/, "")}/blog/${encodeURIComponent(linkKey)}`;
  const message = excerpt ? `${title}\n\n${excerpt}\n\nLee el artículo completo:` : `${title}\n\nLee el artículo completo:`;

  const form = new URLSearchParams();
  form.set("message", message);
  form.set("link", link);
  form.set("access_token", pageAccessToken);

  const res = await fetch(`https://graph.facebook.com/${graphVersion}/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString()
  });
  const json = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    const message = json?.error?.message ?? "Meta API error";
    throw new Error(message);
  }

  return {
    ok: true as const,
    postId: String(json?.id ?? ""),
    link
  };
}

export async function postEpisodeToFacebook(input: FacebookPostEpisodeInput) {
  const { pageId, pageAccessToken, graphVersion, baseUrl } = getConfig();
  if (!pageId || !pageAccessToken) {
    throw new Error("Faltan META_PAGE_ID o META_PAGE_ACCESS_TOKEN.");
  }

  const episodeId = String(input.episodeId ?? "").trim();
  if (!episodeId) throw new Error("episodeId requerido.");

  const episodeSlug = String(input.episodeSlug ?? "").trim() || episodeId;
  const title = cleanInlineText(input.title) || "Nuevo episodio";
  const description = cleanInlineText(input.description);
  const customText = cleanInlineText(input.customText);
  const sourceUrl = cleanInlineText(input.sourceUrl);
  let link = `${baseUrl.replace(/\/$/, "")}/podcast/${encodeURIComponent(episodeSlug)}`;
  if (sourceUrl) {
    try {
      const parsed = new URL(sourceUrl);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        link = parsed.toString();
      }
    } catch {
      // fallback to internal episode URL if sourceUrl is not a valid absolute URL.
    }
  }

  const fallbackMessage = description
    ? `${title}\n\n${shortText(description, 260)}\n\nEscúchalo aquí:`
    : `${title}\n\nEscúchalo aquí:`;
  const message = shortText(customText || fallbackMessage, 700);

  const form = new URLSearchParams();
  form.set("message", message);
  form.set("link", link);
  form.set("access_token", pageAccessToken);

  const res = await fetch(`https://graph.facebook.com/${graphVersion}/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString()
  });
  const json = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    const errorMessage = json?.error?.message ?? "Meta API error";
    throw new Error(errorMessage);
  }

  return {
    ok: true as const,
    postId: String(json?.id ?? ""),
    link,
    message
  };
}
