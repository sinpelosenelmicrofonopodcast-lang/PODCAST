import { buildMetaError, isMetaAuthError, metaFetchJson, resolvePageAccessToken } from "@/lib/metaTokens";

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

type MetaErrorPayload = {
  message?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
};

function getConfig() {
  return {
    baseUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  };
}

function isPermissionLikeError(error?: MetaErrorPayload | null) {
  return isMetaAuthError({
    code: Number(error?.code ?? 0),
    subcode: Number(error?.error_subcode ?? 0),
    message: String(error?.message ?? "")
  });
}

export async function postToFacebookPageFeed(input: {
  message: string;
  link?: string | null;
  pageId?: string | null;
  pageAccessToken?: string | null;
  graphVersion?: string | null;
}) {
  const message = String(input.message ?? "").trim();
  const link = String(input.link ?? "").trim();
  if (!message) throw new Error("Mensaje vacío para Facebook.");

  const publishWithToken = async (token: string, pageId: string, graphVersion: string) => {
    const form = new URLSearchParams();
    form.set("message", message);
    if (link) form.set("link", link);
    form.set("access_token", token);

    return metaFetchJson<{ id?: string; error?: MetaErrorPayload }>(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(pageId)}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString()
    });
  };

  const resolved = await resolvePageAccessToken();
  let pageId = String(input.pageId ?? resolved.pageId).trim();
  let graphVersion = String(input.graphVersion ?? resolved.graphVersion).trim() || resolved.graphVersion;
  let pageAccessToken = String(input.pageAccessToken ?? resolved.accessToken).trim();
  if (!pageId || !pageAccessToken) {
    throw new Error("Faltan FACEBOOK_PAGE_ID/META_PAGE_ID o un token Meta válido.");
  }

  try {
    const publish = await publishWithToken(pageAccessToken, pageId, graphVersion);
    return {
      ok: true as const,
      postId: String(publish.json?.id ?? "")
    };
  } catch (error: any) {
    if (!isPermissionLikeError(error)) {
      throw error instanceof Error ? error : new Error(String(error ?? "Meta API error"));
    }

    const refreshed = await resolvePageAccessToken({ forceRefresh: true });
    pageId = String(input.pageId ?? refreshed.pageId).trim();
    graphVersion = String(input.graphVersion ?? refreshed.graphVersion).trim() || refreshed.graphVersion;
    pageAccessToken = String(input.pageAccessToken ?? refreshed.accessToken).trim();

    try {
      const publish = await publishWithToken(pageAccessToken, pageId, graphVersion);
      return {
        ok: true as const,
        postId: String(publish.json?.id ?? "")
      };
    } catch (retryError: any) {
      if (retryError instanceof Error) {
        throw retryError;
      }
      throw new Error(buildMetaError(retryError as MetaErrorPayload | null));
    }
  }
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
  const { baseUrl } = getConfig();

  const newsId = String(input.newsId ?? "").trim();
  if (!newsId) throw new Error("newsId requerido.");
  const newsSlug = String(input.newsSlug ?? "").trim();

  const title = String(input.title ?? "").trim();
  const summary = String(input.summary ?? "").trim();
  const linkKey = newsSlug || newsId;
  const link = `${baseUrl.replace(/\/$/, "")}/noticias/${encodeURIComponent(linkKey)}`;
  const message = summary ? `${title}\n\n${summary}` : title || "Nueva noticia";

  const posted = await postToFacebookPageFeed({
    message,
    link
  });

  return {
    ok: true as const,
    postId: posted.postId,
    link
  };
}

export async function postBlogToFacebook(input: FacebookPostBlogInput) {
  const { baseUrl } = getConfig();

  const blogId = String(input.blogId ?? "").trim();
  if (!blogId) throw new Error("blogId requerido.");
  const blogSlug = String(input.blogSlug ?? "").trim();

  const title = String(input.title ?? "").trim();
  const excerpt = shortText(String(input.excerpt ?? "").replace(/\s+/g, " "));
  const linkKey = blogSlug || blogId;
  const link = `${baseUrl.replace(/\/$/, "")}/blog/${encodeURIComponent(linkKey)}`;
  const message = excerpt ? `${title}\n\n${excerpt}\n\nLee el artículo completo:` : `${title}\n\nLee el artículo completo:`;

  const posted = await postToFacebookPageFeed({
    message,
    link
  });

  return {
    ok: true as const,
    postId: posted.postId,
    link
  };
}

export async function postEpisodeToFacebook(input: FacebookPostEpisodeInput) {
  const { baseUrl } = getConfig();

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

  const posted = await postToFacebookPageFeed({
    message,
    link
  });

  return {
    ok: true as const,
    postId: posted.postId,
    link,
    message
  };
}
