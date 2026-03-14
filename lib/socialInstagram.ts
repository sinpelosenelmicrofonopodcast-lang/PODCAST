import { MetaGraphError, isMetaAuthError, metaFetchJson, resolveInstagramAccessToken } from "@/lib/metaTokens";

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
    pageId: process.env.FACEBOOK_PAGE_ID ?? process.env.META_PAGE_ID ?? "",
    graphVersion: process.env.FACEBOOK_GRAPH_VERSION ?? process.env.META_GRAPH_VERSION ?? "v24.0",
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
  let lastError: unknown = new Error("Meta API error");

  for (let i = 0; i < attempts; i += 1) {
    try {
      const { json } = await metaFetchJson(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
        cache: "no-store"
      });
      return { ok: true as const, data: json };
    } catch (e: any) {
      lastError = e;
      const isRetryable = isRetryableMetaError(
        Number(e?.status ?? 0),
        String(e?.message ?? "Network error"),
        Number(e?.code ?? 0) || undefined,
        Number(e?.subcode ?? 0) || undefined
      );
      if (!isRetryable || i === attempts - 1) break;
    }
    await sleep(500 * (i + 1));
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error(String(lastError ?? "Meta API error"));
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

    try {
      const { json } = await metaFetchJson<{ status_code?: string }>(statusUrl.toString(), { method: "GET" });
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
    } catch (e: any) {
      const isRetryable = isRetryableMetaError(
        Number(e?.status ?? 0),
        String(e?.message ?? "Meta API error"),
        Number(e?.code ?? 0) || undefined,
        Number(e?.subcode ?? 0) || undefined
      );
      if (!isRetryable || i === maxAttempts - 1) {
        if (e instanceof MetaGraphError) {
          throw new Error(`No se pudo validar estado de Instagram media: ${e.message}`);
        }
        throw e instanceof Error ? e : new Error(String(e ?? "Meta API error"));
      }
      await sleep(1000 * (i + 1));
    }
  }

  throw new Error(`Instagram aún procesa la media (status=${lastStatus}). Reintenta en 1-2 minutos.`);
}

async function resolveIgUserId(config: ReturnType<typeof getConfig>, accessToken: string) {
  const direct = String(config.igUserId ?? "").trim();
  const pageId = String(config.pageId ?? "").trim();

  let directError = "";
  if (direct) {
    const directUrl = new URL(`https://graph.facebook.com/${config.graphVersion}/${encodeURIComponent(direct)}`);
    directUrl.searchParams.set("fields", "id,username,account_type");
    directUrl.searchParams.set("access_token", accessToken);

    try {
      const { json } = await metaFetchJson<{ id?: string }>(directUrl.toString(), { method: "GET" });
      const directId = String(json?.id ?? "").trim();
      if (directId) return directId;
    } catch (error: any) {
      directError = String(error?.message ?? "Meta API error");
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
  url.searchParams.set("access_token", accessToken);

  const { json } = await metaFetchJson<{ connected_instagram_account?: { id?: string } }>(url.toString(), { method: "GET" });

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

async function publishInstagramImage(input: {
  igUserId: string;
  igAccessToken: string;
  graphVersion: string;
  coverUrl: string;
  caption: string;
  publishAs: "feed" | "story";
}) {
  const createForm = new URLSearchParams();
  createForm.set("image_url", input.coverUrl);
  if (input.publishAs === "story") createForm.set("media_type", "STORIES");
  else createForm.set("caption", input.caption);
  createForm.set("access_token", input.igAccessToken);

  const createUrl = `https://graph.facebook.com/${input.graphVersion}/${input.igUserId}/media`;
  const createRes = await graphPostWithRetry(createUrl, createForm);
  const creationId = String(createRes.data?.id ?? "").trim();
  if (!creationId) throw new Error("Instagram no devolvió creation_id.");
  await waitForContainerReady(input.graphVersion, creationId, input.igAccessToken);

  const publishForm = new URLSearchParams();
  publishForm.set("creation_id", creationId);
  publishForm.set("access_token", input.igAccessToken);

  const publishUrl = `https://graph.facebook.com/${input.graphVersion}/${input.igUserId}/media_publish`;
  const publishRes = await graphPostWithRetry(publishUrl, publishForm);
  const mediaId = String(publishRes.data?.id ?? "").trim();
  if (!mediaId) throw new Error("Instagram no devolvió media id.");
  return mediaId;
}

export async function postGenericImageToInstagram(input: {
  imageUrl: string;
  caption?: string | null;
  publishAs?: "feed" | "story";
}) {
  const config = getConfig();
  const { graphVersion } = config;
  const imageUrl = String(input.imageUrl ?? "").trim();
  if (!imageUrl) {
    throw new Error("Instagram requiere una imagen publica.");
  }

  const caption = normalizeCaption(String(input.caption ?? "").trim());
  const publishAs = normalizePublishTarget(input.publishAs);

  const publishOnce = async (forceRefresh = false) => {
    const tokenState = await resolveInstagramAccessToken({ forceRefresh });
    const igUserId = await resolveIgUserId(config, tokenState.accessToken);
    return publishInstagramImage({
      igUserId,
      igAccessToken: tokenState.accessToken,
      graphVersion,
      coverUrl: imageUrl,
      caption,
      publishAs
    });
  };

  let mediaId = "";
  try {
    mediaId = await publishOnce(false);
  } catch (error: any) {
    if (!isMetaAuthError(error)) {
      throw error instanceof Error ? error : new Error(String(error ?? "Meta API error"));
    }
    mediaId = await publishOnce(true);
  }

  return {
    ok: true as const,
    mediaId,
    publishAs
  };
}

export async function postNewsToInstagram(input: InstagramPostNewsInput) {
  const config = getConfig();
  const { graphVersion, baseUrl } = config;

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

  const publishOnce = async (forceRefresh = false) => {
    const tokenState = await resolveInstagramAccessToken({ forceRefresh });
    const igUserId = await resolveIgUserId(config, tokenState.accessToken);
    return publishInstagramImage({
      igUserId,
      igAccessToken: tokenState.accessToken,
      graphVersion,
      coverUrl,
      caption,
      publishAs
    });
  };

  let mediaId = "";
  try {
    mediaId = await publishOnce(false);
  } catch (error: any) {
    if (!isMetaAuthError(error)) {
      throw error instanceof Error ? error : new Error(String(error ?? "Meta API error"));
    }
    mediaId = await publishOnce(true);
  }

  return {
    ok: true as const,
    mediaId,
    articleUrl,
    publishAs
  };
}

export async function postBlogToInstagram(input: InstagramPostBlogInput) {
  const config = getConfig();
  const { graphVersion, baseUrl } = config;

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

  const publishOnce = async (forceRefresh = false) => {
    const tokenState = await resolveInstagramAccessToken({ forceRefresh });
    const igUserId = await resolveIgUserId(config, tokenState.accessToken);
    return publishInstagramImage({
      igUserId,
      igAccessToken: tokenState.accessToken,
      graphVersion,
      coverUrl,
      caption,
      publishAs
    });
  };

  let mediaId = "";
  try {
    mediaId = await publishOnce(false);
  } catch (error: any) {
    if (!isMetaAuthError(error)) {
      throw error instanceof Error ? error : new Error(String(error ?? "Meta API error"));
    }
    mediaId = await publishOnce(true);
  }

  return {
    ok: true as const,
    mediaId,
    articleUrl,
    publishAs
  };
}
