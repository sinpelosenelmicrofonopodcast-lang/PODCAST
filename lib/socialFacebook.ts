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
    pageId: process.env.META_PAGE_ID ?? "",
    pageAccessToken: process.env.META_PAGE_ACCESS_TOKEN ?? "",
    graphVersion: process.env.META_GRAPH_VERSION ?? "v24.0",
    baseUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  };
}

function isPermissionLikeError(error?: MetaErrorPayload | null) {
  const message = String(error?.message ?? "").toLowerCase();
  return (
    Number(error?.code ?? 0) === 200 ||
    message.includes("page access token is required") ||
    message.includes("requires both pages_read_engagement and pages_manage_posts")
  );
}

function buildMetaError(error?: MetaErrorPayload | null, status?: number) {
  const base = String(error?.message ?? `Meta API HTTP ${status ?? 500}`);
  const code = Number(error?.code ?? 0);
  const subcode = Number(error?.error_subcode ?? 0);
  const trace = String(error?.fbtrace_id ?? "").trim();
  const suffix = [
    code ? `code ${code}` : "",
    subcode ? `subcode ${subcode}` : "",
    trace ? `trace ${trace}` : ""
  ]
    .filter(Boolean)
    .join(" · ");
  const withMeta = suffix ? `${base} (${suffix})` : base;
  if (!isPermissionLikeError(error)) return withMeta;
  return `${withMeta} | Verifica que el token final sea Page Access Token con pages_read_engagement + pages_manage_posts y rol admin en la página.`;
}

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { cache: "no-store", ...(init ?? {}) });
  const json = await res.json().catch(() => ({} as any));
  return { res, json };
}

async function resolvePageTokenFromUserToken(input: { userToken: string; pageId: string; graphVersion: string }) {
  const { userToken, pageId, graphVersion } = input;
  const url = new URL(`https://graph.facebook.com/${graphVersion}/me/accounts`);
  url.searchParams.set("access_token", userToken);
  url.searchParams.set("fields", "id,access_token,name");

  const { res, json } = await fetchJson(url.toString(), { method: "GET" });
  if (!res.ok) return null;
  const rows = Array.isArray(json?.data) ? json.data : [];
  const match = rows.find((row: any) => String(row?.id ?? "") === pageId);
  const token = String(match?.access_token ?? "").trim();
  return token || null;
}

export async function postToFacebookPageFeed(input: {
  message: string;
  link?: string | null;
  pageId?: string | null;
  pageAccessToken?: string | null;
  graphVersion?: string | null;
}) {
  const cfg = getConfig();
  const pageId = String(input.pageId ?? cfg.pageId).trim();
  const pageAccessToken = String(input.pageAccessToken ?? cfg.pageAccessToken).trim();
  const graphVersion = String(input.graphVersion ?? cfg.graphVersion).trim() || "v24.0";
  const message = String(input.message ?? "").trim();
  const link = String(input.link ?? "").trim();

  if (!pageId || !pageAccessToken) {
    throw new Error("Faltan META_PAGE_ID o META_PAGE_ACCESS_TOKEN.");
  }
  if (!message) throw new Error("Mensaje vacío para Facebook.");

  const publishWithToken = async (token: string) => {
    const form = new URLSearchParams();
    form.set("message", message);
    if (link) form.set("link", link);
    form.set("access_token", token);

    return fetchJson(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(pageId)}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString()
    });
  };

  let publish = await publishWithToken(pageAccessToken);
  if (!publish.res.ok) {
    const metaError = (publish.json?.error ?? null) as MetaErrorPayload | null;
    if (isPermissionLikeError(metaError)) {
      const resolvedToken = await resolvePageTokenFromUserToken({
        userToken: pageAccessToken,
        pageId,
        graphVersion
      });
      if (resolvedToken && resolvedToken !== pageAccessToken) {
        publish = await publishWithToken(resolvedToken);
      }
    }
  }

  if (!publish.res.ok) {
    const metaError = (publish.json?.error ?? null) as MetaErrorPayload | null;
    throw new Error(buildMetaError(metaError, publish.res.status));
  }

  return {
    ok: true as const,
    postId: String(publish.json?.id ?? "")
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

  const newsId = String(input.newsId ?? "").trim();
  if (!newsId) throw new Error("newsId requerido.");
  const newsSlug = String(input.newsSlug ?? "").trim();

  const title = String(input.title ?? "").trim();
  const summary = String(input.summary ?? "").trim();
  const linkKey = newsSlug || newsId;
  const link = `${baseUrl.replace(/\/$/, "")}/noticias/${encodeURIComponent(linkKey)}`;
  const message = summary ? `${title}\n\n${summary}` : title || "Nueva noticia";

  const posted = await postToFacebookPageFeed({
    pageId,
    pageAccessToken,
    graphVersion,
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
  const { pageId, pageAccessToken, graphVersion, baseUrl } = getConfig();

  const blogId = String(input.blogId ?? "").trim();
  if (!blogId) throw new Error("blogId requerido.");
  const blogSlug = String(input.blogSlug ?? "").trim();

  const title = String(input.title ?? "").trim();
  const excerpt = shortText(String(input.excerpt ?? "").replace(/\s+/g, " "));
  const linkKey = blogSlug || blogId;
  const link = `${baseUrl.replace(/\/$/, "")}/blog/${encodeURIComponent(linkKey)}`;
  const message = excerpt ? `${title}\n\n${excerpt}\n\nLee el artículo completo:` : `${title}\n\nLee el artículo completo:`;

  const posted = await postToFacebookPageFeed({
    pageId,
    pageAccessToken,
    graphVersion,
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
  const { pageId, pageAccessToken, graphVersion, baseUrl } = getConfig();

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
    pageId,
    pageAccessToken,
    graphVersion,
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
