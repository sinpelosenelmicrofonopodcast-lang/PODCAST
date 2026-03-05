export type InstagramPostNewsInput = {
  newsId: string;
  newsSlug?: string | null;
  title?: string | null;
  summary?: string | null;
  coverUrl?: string | null;
  publishAs?: "feed" | "story";
};

export type InstagramPostBlogInput = {
  blogId: string;
  blogSlug?: string | null;
  title?: string | null;
  excerpt?: string | null;
  coverUrl?: string | null;
  publishAs?: "feed" | "story";
};

function getConfig() {
  return {
    igUserId: process.env.IG_USER_ID ?? "",
    pageId: process.env.META_PAGE_ID ?? "",
    igAccessToken: process.env.IG_ACCESS_TOKEN ?? process.env.META_PAGE_ACCESS_TOKEN ?? "",
    graphVersion: process.env.META_GRAPH_VERSION ?? "v24.0",
    baseUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeCaption(input: string) {
  const maxChars = 2200;
  const clean = String(input ?? "").trim();
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, maxChars - 1).trimEnd()}…`;
}

function normalizePublishTarget(value?: string | null) {
  return String(value ?? "").toLowerCase() === "story" ? "story" : "feed";
}

async function graphPostWithRetry(url: string, form: URLSearchParams, attempts = 3) {
  let lastError = "Meta API error";

  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
        cache: "no-store"
      });
      const json = await res.json().catch(() => ({} as any));
      if (res.ok) return { ok: true as const, data: json };

      lastError = String(json?.error?.message ?? `Meta API HTTP ${res.status}`);
      const isRetryable = res.status >= 500 || res.status === 429;
      if (!isRetryable || i === attempts - 1) break;
    } catch (e: any) {
      lastError = String(e?.message ?? "Network error");
      if (i === attempts - 1) break;
    }
    await sleep(500 * (i + 1));
  }

  throw new Error(lastError);
}

async function resolveIgUserId(config: ReturnType<typeof getConfig>) {
  const direct = String(config.igUserId ?? "").trim();
  if (direct) return direct;

  const pageId = String(config.pageId ?? "").trim();
  const token = String(config.igAccessToken ?? "").trim();
  if (!pageId || !token) {
    throw new Error("Faltan IG_USER_ID y/o META_PAGE_ID junto con token de acceso para Instagram.");
  }

  const url = new URL(`https://graph.facebook.com/${config.graphVersion}/${encodeURIComponent(pageId)}`);
  url.searchParams.set("fields", "connected_instagram_account{id}");
  url.searchParams.set("access_token", token);

  const res = await fetch(url.toString(), { cache: "no-store" });
  const json = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    throw new Error(String(json?.error?.message ?? `Meta API HTTP ${res.status}`));
  }

  const connectedId = String(json?.connected_instagram_account?.id ?? "").trim();
  if (!connectedId) {
    throw new Error("La página de Facebook no tiene cuenta de Instagram conectada.");
  }
  return connectedId;
}

export async function postNewsToInstagram(input: InstagramPostNewsInput) {
  const config = getConfig();
  const { igAccessToken, graphVersion, baseUrl } = config;
  if (!igAccessToken) {
    throw new Error("Falta IG_ACCESS_TOKEN/META_PAGE_ACCESS_TOKEN.");
  }
  const igUserId = await resolveIgUserId(config);

  const newsId = String(input.newsId ?? "").trim();
  if (!newsId) throw new Error("newsId requerido.");

  const coverUrl = String(input.coverUrl ?? "").trim();
  if (!coverUrl) {
    throw new Error("Instagram requiere portada (cover_url) pública.");
  }

  const newsSlug = String(input.newsSlug ?? "").trim();
  const title = String(input.title ?? "").trim();
  const summary = String(input.summary ?? "").trim();
  const publishAs = normalizePublishTarget(input.publishAs);
  const linkKey = newsSlug || newsId;
  const articleUrl = `${baseUrl.replace(/\/$/, "")}/noticias/${encodeURIComponent(linkKey)}`;
  const caption = normalizeCaption(summary ? `${title}\n\n${summary}\n\n${articleUrl}` : `${title}\n\n${articleUrl}`);

  const createForm = new URLSearchParams();
  createForm.set("image_url", coverUrl);
  if (publishAs === "story") createForm.set("media_type", "STORIES");
  else createForm.set("caption", caption);
  createForm.set("access_token", igAccessToken);

  const createUrl = `https://graph.facebook.com/${graphVersion}/${igUserId}/media`;
  const createRes = await graphPostWithRetry(createUrl, createForm);
  const creationId = String(createRes.data?.id ?? "").trim();
  if (!creationId) throw new Error("Instagram no devolvió creation_id.");

  const publishForm = new URLSearchParams();
  publishForm.set("creation_id", creationId);
  publishForm.set("access_token", igAccessToken);

  const publishUrl = `https://graph.facebook.com/${graphVersion}/${igUserId}/media_publish`;
  const publishRes = await graphPostWithRetry(publishUrl, publishForm);
  const mediaId = String(publishRes.data?.id ?? "").trim();
  if (!mediaId) throw new Error("Instagram no devolvió media id.");

  return {
    ok: true as const,
    mediaId,
    articleUrl,
    publishAs
  };
}

export async function postBlogToInstagram(input: InstagramPostBlogInput) {
  const config = getConfig();
  const { igAccessToken, graphVersion, baseUrl } = config;
  if (!igAccessToken) {
    throw new Error("Falta IG_ACCESS_TOKEN/META_PAGE_ACCESS_TOKEN.");
  }
  const igUserId = await resolveIgUserId(config);

  const blogId = String(input.blogId ?? "").trim();
  if (!blogId) throw new Error("blogId requerido.");

  const coverUrl = String(input.coverUrl ?? "").trim();
  if (!coverUrl) {
    throw new Error("Instagram requiere portada (cover_url) pública.");
  }

  const blogSlug = String(input.blogSlug ?? "").trim();
  const title = String(input.title ?? "").trim();
  const excerpt = normalizeCaption(String(input.excerpt ?? "").replace(/\s+/g, " ").trim());
  const publishAs = normalizePublishTarget(input.publishAs);
  const linkKey = blogSlug || blogId;
  const articleUrl = `${baseUrl.replace(/\/$/, "")}/blog/${encodeURIComponent(linkKey)}`;
  const caption = normalizeCaption(excerpt ? `${title}\n\n${excerpt}\n\nLee completo: ${articleUrl}` : `${title}\n\nLee completo: ${articleUrl}`);

  const createForm = new URLSearchParams();
  createForm.set("image_url", coverUrl);
  if (publishAs === "story") createForm.set("media_type", "STORIES");
  else createForm.set("caption", caption);
  createForm.set("access_token", igAccessToken);

  const createUrl = `https://graph.facebook.com/${graphVersion}/${igUserId}/media`;
  const createRes = await graphPostWithRetry(createUrl, createForm);
  const creationId = String(createRes.data?.id ?? "").trim();
  if (!creationId) throw new Error("Instagram no devolvió creation_id.");

  const publishForm = new URLSearchParams();
  publishForm.set("creation_id", creationId);
  publishForm.set("access_token", igAccessToken);

  const publishUrl = `https://graph.facebook.com/${graphVersion}/${igUserId}/media_publish`;
  const publishRes = await graphPostWithRetry(publishUrl, publishForm);
  const mediaId = String(publishRes.data?.id ?? "").trim();
  if (!mediaId) throw new Error("Instagram no devolvió media id.");

  return {
    ok: true as const,
    mediaId,
    articleUrl,
    publishAs
  };
}
