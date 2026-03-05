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

export async function postNewsToInstagram(input: InstagramPostNewsInput) {
  const { igUserId, igAccessToken, graphVersion, baseUrl } = getConfig();
  if (!igUserId || !igAccessToken) {
    throw new Error("Faltan IG_USER_ID o IG_ACCESS_TOKEN/META_PAGE_ACCESS_TOKEN.");
  }

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
  const { igUserId, igAccessToken, graphVersion, baseUrl } = getConfig();
  if (!igUserId || !igAccessToken) {
    throw new Error("Faltan IG_USER_ID o IG_ACCESS_TOKEN/META_PAGE_ACCESS_TOKEN.");
  }

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
