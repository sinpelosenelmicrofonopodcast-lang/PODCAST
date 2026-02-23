export type FacebookPostNewsInput = {
  newsId: string;
  title?: string | null;
  summary?: string | null;
};

function getConfig() {
  return {
    pageId: process.env.META_PAGE_ID ?? "",
    pageAccessToken: process.env.META_PAGE_ACCESS_TOKEN ?? "",
    graphVersion: process.env.META_GRAPH_VERSION ?? "v24.0",
    baseUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  };
}

export async function postNewsToFacebook(input: FacebookPostNewsInput) {
  const { pageId, pageAccessToken, graphVersion, baseUrl } = getConfig();
  if (!pageId || !pageAccessToken) {
    throw new Error("Faltan META_PAGE_ID o META_PAGE_ACCESS_TOKEN.");
  }

  const newsId = String(input.newsId ?? "").trim();
  if (!newsId) throw new Error("newsId requerido.");

  const title = String(input.title ?? "").trim();
  const summary = String(input.summary ?? "").trim();
  const link = `${baseUrl.replace(/\/$/, "")}/noticias/${encodeURIComponent(newsId)}`;
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
