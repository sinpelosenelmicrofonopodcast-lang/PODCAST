import type { SupabaseClient } from "@supabase/supabase-js";
import { asString, asOptionalString } from "@/lib/validations/common";

export async function trackArticleEvent(
  service: SupabaseClient,
  input: {
    articleId: string;
    eventType: string;
    userId?: string | null;
    sessionId?: string | null;
    referrer?: string | null;
    meta?: Record<string, unknown>;
  }
) {
  const payload = {
    article_id: input.articleId,
    event_type: asString(input.eventType, 60),
    user_id: input.userId ?? null,
    session_id: asOptionalString(input.sessionId, 120),
    referrer: asOptionalString(input.referrer, 500),
    meta: input.meta ?? {}
  };

  const { error } = await service.from("article_events").insert(payload);
  if (error) throw new Error(error.message);
}
