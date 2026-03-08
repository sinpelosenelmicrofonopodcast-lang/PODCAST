import { postNewsToFacebook } from "@/lib/socialFacebook";

export async function publishFacebookLink(input: {
  articleId: string;
  slug: string;
  title: string;
  message: string;
}) {
  const result = await postNewsToFacebook({
    newsId: input.articleId,
    newsSlug: input.slug,
    title: input.title,
    summary: input.message
  });

  return {
    platform: "facebook" as const,
    ok: true,
    externalId: result.postId,
    link: result.link,
    raw: result
  };
}
