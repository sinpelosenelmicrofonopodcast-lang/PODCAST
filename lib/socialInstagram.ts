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

function isRetryableMetaError(status: number, message: string, code?: number, subcode?: number) {
  if (status >= 500 || status === 429) return true;
  if (code === 4 || code === 17 || code === 32) return true;
  if (subcode === 2207008 || subcode === 2207027) return true;

  const msg = message.toLowerCase();
  return (
    msg.includes("media id is not available") ||
    msg.includes("is still processing") ||
    msg.includes("try again") ||
    msg.includes("temporarily unavailable")
  );
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

      const errorMessage = String(json?.error?.message ?? `Meta API HTTP ${res.status}`);
      const errorCode = Number(json?.error?.code ?? 0) || undefined;
      const errorSubcode = Number(json?.error?.error_subcode ?? 0) || undefined;
      lastError = errorMessage;
      const isRetryable = isRetryableMetaError(res.status, errorMessage, errorCode, errorSubcode);
      if (!isRetryable || i === attempts - 1) break;
    } catch (e: any) {
      lastError = String(e?.message ?? "Network error");
      if (i === attempts - 1) break;
    }
    await sleep(500 * (i + 1));
  }

  throw new Error(lastError);
}

async function waitForContainerReady(
  graphVersion: string,
  creationId: string,
  accessToken: string,
  maxAttempts = 15
) {
  let lastStatus = "UNKNOWN";
  for (let i = 0; i < maxAttempts; i += 1) {
    const statusUrl = new URL(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(creationId)}`);
    statusUrl.searchParams.set("fields", "status_code");
    statusUrl.searchParams.set("access_token", accessToken);

    const res = await fetch(statusUrl.toString(), { cache: "no-store" });
    const json = await res.json().catch(() => ({} as any));

    if (!res.ok) {
      const message = String(json?.error?.message ?? `Meta API HTTP ${res.status}`);
      const code = Number(json?.error?.code ?? 0) || undefined;
      const subcode = Number(json?.error?.error_subcode ?? 0) || undefined;
      if (!isRetryableMetaError(res.status, message, code, subcode) || i === maxAttempts - 1) {
        throw new Error(`No se pudo validar estado de Instagram media: ${message}`);
      }
      await sleep(1000 * (i + 1));
      continue;
    }

    const status = String(json?.status_code ?? "")
      .trim()
      .toUpperCase();
    if (!status || status === "FINISHED" || status === "PUBLISHED") return;

    lastStatus = status;
    if (status === "ERROR" || status === "EXPIRED" || status === "ERROR_INVALID_MEDIA") {
      throw new Error(`Instagram no pudo procesar la media (status=${status}).`);
    }

    if (i < maxAttempts - 1) {
      await sleep(1500);
    }
  }

  throw new Error(`Instagram aún procesa la media (status=${lastStatus}). Reintenta en 1-2 minutos.`);
}

async function resolveIgUserId(config: ReturnType<typeof getConfig>) {
  const direct = String(config.igUserId ?? "").trim();
  const pageId = String(config.pageId ?? "").trim();
  const token = String(config.igAccessToken ?? "").trim();
  if (!token) {
    throw new Error("Falta IG_ACCESS_TOKEN/META_PAGE_ACCESS_TOKEN.");
  }

  let directError = "";
  if (direct) {
    const directUrl = new URL(`https://graph.facebook.com/${config.graphVersion}/${encodeURIComponent(direct)}`);
    directUrl.searchParams.set("fields", "id,username,account_type");
    directUrl.searchParams.set("access_token", token);

    const directRes = await fetch(directUrl.toString(), { cache: "no-store" });
    const directJson = await directRes.json().catch(() => ({} as any));
    if (directRes.ok) {
      const directId = String(directJson?.id ?? "").trim();
      if (directId) return directId;
    } else {
      directError = String(directJson?.error?.message ?? `Meta API HTTP ${directRes.status}`);
    }
  }

  if (!pageId) {
    if (directError) {
      throw new Error(`IG_USER_ID inválido o sin permisos: ${directError}`);
    }
    throw new Error("Faltan IG_USER_ID o META_PAGE_ID para resolver la cuenta de Instagram.");
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
    if (directError) {
      throw new Error(
        `No se pudo usar IG_USER_ID y la página no tiene Instagram conectada. IG_USER_ID error: ${directError}`
      );
    }
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
  await waitForContainerReady(graphVersion, creationId, igAccessToken);

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
  await waitForContainerReady(graphVersion, creationId, igAccessToken);

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
