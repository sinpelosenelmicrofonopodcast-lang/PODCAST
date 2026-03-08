import { postNewsToInstagram } from "@/lib/socialInstagram";

export async function publishInstagramImage(input: {
  articleId: string;
  slug: string;
  title: string;
  message: string;
  imageUrl: string;
  publishAs?: "feed" | "story";
}) {
  const result = await postNewsToInstagram({
    newsId: input.articleId,
    newsSlug: input.slug,
    title: input.title,
    summary: input.message,
    coverUrl: input.imageUrl,
    publishAs: input.publishAs ?? "feed"
  });

  return {
    platform: "instagram" as const,
    ok: true,
    externalId: result.mediaId,
    link: result.articleUrl,
    raw: result
  };
}
