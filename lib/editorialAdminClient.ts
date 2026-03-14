import { authApiRequest } from "@/lib/clientApi";

type EditorialKind = "news" | "blog";

type EditorialPublishInput = {
  kind: EditorialKind;
  id: string;
  slug?: string | null;
  title: string;
  text: string;
  coverUrl?: string | null;
  scheduleFor?: string | null;
  story?: boolean;
};

const EDITORIAL_CONFIG = {
  news: {
    facebookEndpoint: "/api/social/meta/facebook/post-news",
    instagramEndpoint: "/api/social/meta/instagram/post-news",
    idKey: "newsId",
    slugKey: "newsSlug",
    textKey: "summary"
  },
  blog: {
    facebookEndpoint: "/api/social/meta/facebook/post-blog",
    instagramEndpoint: "/api/social/meta/instagram/post-blog",
    idKey: "blogId",
    slugKey: "blogSlug",
    textKey: "excerpt"
  }
} as const;

function createBody(input: EditorialPublishInput) {
  const config = EDITORIAL_CONFIG[input.kind];

  return {
    [config.idKey]: input.id,
    [config.slugKey]: input.slug ?? null,
    title: input.title,
    [config.textKey]: input.text,
    ...(input.coverUrl !== undefined ? { coverUrl: input.coverUrl } : {}),
    ...(input.scheduleFor ? { scheduleFor: input.scheduleFor } : {}),
    ...(input.story ? { story: true } : {})
  };
}

export async function enqueueSeoPost(url: string) {
  return authApiRequest("/api/seo/enqueue", {
    method: "POST",
    jsonBody: { url, type: "post" }
  });
}

export async function sendEditorialPush(input: {
  title: string;
  message: string;
  url: string;
  imageUrl?: string | null;
  category: string;
}) {
  const result = await authApiRequest<{ ok?: boolean; error?: string }>("/api/admin/notifications/onesignal", {
    method: "POST",
    jsonBody: {
      title: input.title,
      message: input.message,
      url: input.url,
      imageUrl: input.imageUrl ?? null,
      category: input.category
    }
  });

  if (!result.ok) {
    throw new Error(result.json?.error ?? "No se pudo enviar push.");
  }

  return result;
}

export async function publishEditorialToFacebook(input: EditorialPublishInput) {
  const config = EDITORIAL_CONFIG[input.kind];
  return authApiRequest(config.facebookEndpoint, {
    method: "POST",
    jsonBody: createBody(input)
  });
}

export async function publishEditorialToInstagram(input: EditorialPublishInput) {
  const config = EDITORIAL_CONFIG[input.kind];
  return authApiRequest(config.instagramEndpoint, {
    method: "POST",
    jsonBody: createBody(input)
  });
}
