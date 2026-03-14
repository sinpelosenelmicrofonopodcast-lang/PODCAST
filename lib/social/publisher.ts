import type { SupabaseClient } from "@supabase/supabase-js";
import { publishFacebookLink } from "@/lib/social/facebook";
import { publishInstagramImage } from "@/lib/social/instagram";
import { publishXPost } from "@/lib/social/x";
import { publishTikTokPost } from "@/lib/social/tiktok";
import { asStringArray, isUuid } from "@/lib/validations/common";

type SocialPublicationRow = {
  id: string;
  article_id: string;
  platform: string;
  status: string;
  payload: Record<string, unknown> | null;
};

async function publishSocialRows(service: SupabaseClient, rows: SocialPublicationRow[]) {
  let done = 0;
  let failed = 0;

  for (const row of rows) {
    const payload = row.payload ?? {};

    try {
      const articleRes = await service
        .from("news_articles")
        .select("id, slug, title, summary, cover_image_url, reel_video_url, status")
        .eq("id", row.article_id)
        .limit(1)
        .maybeSingle();

      if (articleRes.error) throw new Error(articleRes.error.message);
      if (!articleRes.data) throw new Error("Artículo no encontrado para social queue.");

      const article = articleRes.data as {
        id: string;
        slug: string;
        title: string;
        summary: string | null;
        cover_image_url: string | null;
        reel_video_url: string | null;
        status: string | null;
      };

      if (String(article.status ?? "") !== "published") {
        throw new Error("Artículo no publicado: bloqueado para distribución social.");
      }

      const message = String(payload.message ?? article.summary ?? article.title).slice(0, 600);
      const link = String(payload.link ?? `/noticias/${article.slug}`);

      let result: any;
      const platform = String(row.platform ?? "").toLowerCase();
      if (platform === "facebook") {
        result = await publishFacebookLink({
          articleId: article.id,
          slug: article.slug,
          title: article.title,
          message
        });
      } else if (platform === "instagram") {
        if (!article.cover_image_url) throw new Error("Instagram requiere cover_image_url.");
        result = await publishInstagramImage({
          articleId: article.id,
          slug: article.slug,
          title: article.title,
          message,
          imageUrl: article.cover_image_url,
          publishAs: payload.publishAs === "story" ? "story" : "feed"
        });
      } else if (platform === "x") {
        result = await publishXPost({ message, link });
      } else if (platform === "tiktok") {
        result = await publishTikTokPost({ message, link, reelVideoUrl: article.reel_video_url });
      } else {
        throw new Error(`Plataforma no soportada: ${platform}`);
      }

      if (result?.ok) {
        await service
          .from("social_publications")
          .update({
            status: "published",
            external_id: String(result.externalId ?? ""),
            response: result,
            published_at: new Date().toISOString()
          })
          .eq("id", row.id);
        done += 1;
      } else {
        await service
          .from("social_publications")
          .update({
            status: "failed",
            response: result,
            published_at: null
          })
          .eq("id", row.id);
        failed += 1;
      }
    } catch (error: any) {
      await service
        .from("social_publications")
        .update({
          status: "failed",
          response: { error: error?.message ?? "error" }
        })
        .eq("id", row.id);
      failed += 1;
    }
  }

  return {
    queued: rows.length,
    done,
    failed
  };
}

export async function publishFromSocialQueue(service: SupabaseClient, limit = 20, ids: string[] = []) {
  const publicationIds = asStringArray(ids, 25, 80).filter((value) => isUuid(value));
  let query = service
    .from("social_publications")
    .select("id, article_id, platform, status, payload")
    .eq("status", "queued")
    .order("created_at", { ascending: true });

  if (publicationIds.length) {
    query = query.in("id", publicationIds).limit(publicationIds.length);
  } else {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return publishSocialRows(service, (data ?? []) as SocialPublicationRow[]);
}
