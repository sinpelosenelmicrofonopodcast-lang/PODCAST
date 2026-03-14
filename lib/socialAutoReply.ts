import { timingSafeEqual, createHmac } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMetaRuntimeConfig, metaFetchJson, resolveInstagramAccessToken, resolvePageAccessToken } from "@/lib/metaTokens";

export type SocialAutoReplyPlatform = "facebook" | "instagram";

export type SocialAutoReplyRule = {
  id: string;
  label: string;
  enabled: boolean;
  platforms: SocialAutoReplyPlatform[];
  keywords: string[];
  replyTemplate: string;
};

export type SocialAutoReplySettings = {
  enabled: boolean;
  facebookEnabled: boolean;
  instagramEnabled: boolean;
  authorCooldownHours: number;
  maxCommentLength: number;
  blockedKeywords: string[];
  youtubeUrl: string;
  rules: SocialAutoReplyRule[];
};

export type NormalizedCommentEvent = {
  platform: SocialAutoReplyPlatform;
  eventKey: string;
  commentId: string;
  parentCommentId: string | null;
  postId: string | null;
  mediaId: string | null;
  senderId: string | null;
  senderName: string | null;
  message: string;
  raw: Record<string, any>;
};

const SETTINGS_KEY = "social_auto_reply";

export const DEFAULT_SOCIAL_AUTO_REPLY_SETTINGS: SocialAutoReplySettings = {
  enabled: false,
  facebookEnabled: true,
  instagramEnabled: false,
  authorCooldownHours: 24,
  maxCommentLength: 280,
  blockedKeywords: ["odio", "mierda", "basura", "estafa", "fraude", "cabron", "pendej", "fuck", "scam"],
  youtubeUrl: "https://www.youtube.com/@SinPelosEnElMicrofono",
  rules: [
    {
      id: "youtube_follow",
      label: "Seguir en YouTube",
      enabled: true,
      platforms: ["facebook", "instagram"],
      keywords: ["youtube", "canal", "suscrib", "subscribe", "follow", "seguir"],
      replyTemplate: "Te dejamos el canal por aqui: {youtubeUrl} Si no nos sigues todavia, date la vuelta."
    },
    {
      id: "watch_link",
      label: "Donde verlo",
      enabled: true,
      platforms: ["facebook", "instagram"],
      keywords: ["link", "donde", "ver", "veo", "episodio", "capitulo"],
      replyTemplate: "Puedes ver los episodios y seguirnos por aqui: {youtubeUrl}"
    }
  ]
};

function normalizeText(value?: string | null) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForMatch(value?: string | null) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function uniqueStrings(input: unknown) {
  if (!Array.isArray(input)) return [] as string[];
  return Array.from(new Set(input.map((value) => normalizeText(String(value ?? ""))).filter(Boolean)));
}

function normalizeRule(input: any, fallbackIndex: number): SocialAutoReplyRule | null {
  const id = normalizeText(input?.id) || `rule_${fallbackIndex + 1}`;
  const replyTemplate = normalizeText(input?.replyTemplate);
  const keywords = uniqueStrings(input?.keywords);
  const platforms = uniqueStrings(input?.platforms).filter((value): value is SocialAutoReplyPlatform => value === "facebook" || value === "instagram");
  if (!replyTemplate || keywords.length === 0 || platforms.length === 0) return null;
  return {
    id,
    label: normalizeText(input?.label) || id,
    enabled: input?.enabled !== false,
    platforms,
    keywords,
    replyTemplate
  };
}

export function normalizeSocialAutoReplySettings(value: unknown): SocialAutoReplySettings {
  const input = (value && typeof value === "object" ? value : {}) as Record<string, any>;
  const rules = Array.isArray(input.rules)
    ? input.rules.map((row, index) => normalizeRule(row, index)).filter(Boolean) as SocialAutoReplyRule[]
    : DEFAULT_SOCIAL_AUTO_REPLY_SETTINGS.rules;

  return {
    enabled: input.enabled === true,
    facebookEnabled: input.facebookEnabled !== false,
    instagramEnabled: input.instagramEnabled === true,
    authorCooldownHours: Math.min(168, Math.max(1, Math.floor(Number(input.authorCooldownHours ?? 24) || 24))),
    maxCommentLength: Math.min(1000, Math.max(20, Math.floor(Number(input.maxCommentLength ?? 280) || 280))),
    blockedKeywords: uniqueStrings(input.blockedKeywords ?? DEFAULT_SOCIAL_AUTO_REPLY_SETTINGS.blockedKeywords),
    youtubeUrl: normalizeText(input.youtubeUrl) || DEFAULT_SOCIAL_AUTO_REPLY_SETTINGS.youtubeUrl,
    rules: rules.length > 0 ? rules : DEFAULT_SOCIAL_AUTO_REPLY_SETTINGS.rules
  };
}

export async function getSocialAutoReplySettings(service: SupabaseClient) {
  const { data, error } = await service.from("admin_settings").select("value").eq("key", SETTINGS_KEY).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return normalizeSocialAutoReplySettings((data as any)?.value ?? DEFAULT_SOCIAL_AUTO_REPLY_SETTINGS);
}

export async function upsertSocialAutoReplySettings(service: SupabaseClient, settings: SocialAutoReplySettings) {
  const payload = normalizeSocialAutoReplySettings(settings);
  const { error } = await service.from("admin_settings").upsert(
    {
      key: SETTINGS_KEY,
      value: payload
    },
    { onConflict: "key" }
  );
  if (error) throw new Error(error.message);
  return payload;
}

function renderTemplate(template: string, settings: SocialAutoReplySettings) {
  return normalizeText(template.replace(/\{youtubeUrl\}/g, settings.youtubeUrl));
}

function findMatchingRule(
  message: string,
  platform: SocialAutoReplyPlatform,
  settings: SocialAutoReplySettings
): SocialAutoReplyRule | null {
  const normalized = normalizeForMatch(message);
  if (!normalized) return null;

  const hasBlocked = settings.blockedKeywords.some((keyword) => {
    const clean = normalizeForMatch(keyword);
    return clean.length > 0 && normalized.includes(clean);
  });
  if (hasBlocked) return null;

  return (
    settings.rules.find((rule) => {
      if (!rule.enabled) return false;
      if (!rule.platforms.includes(platform)) return false;
      return rule.keywords.some((keyword) => {
        const clean = normalizeForMatch(keyword);
        return clean.length > 0 && normalized.includes(clean);
      });
    }) ?? null
  );
}

export function verifyMetaWebhookSignature(rawBody: string, signatureHeader: string | null, appSecret?: string | null) {
  const secret = normalizeText(appSecret);
  if (!secret) return true;
  const header = normalizeText(signatureHeader);
  if (!header.startsWith("sha256=")) return false;
  const expected = Buffer.from(header.slice(7), "hex");
  const actual = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export function parseMetaCommentWebhook(payload: any): NormalizedCommentEvent[] {
  const out: NormalizedCommentEvent[] = [];
  const object = normalizeText(payload?.object).toLowerCase();
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const field = normalizeText(change?.field).toLowerCase();
      const value = (change?.value ?? {}) as Record<string, any>;

      if (object === "page" && field === "feed" && normalizeText(value?.item).toLowerCase() === "comment") {
        const commentId = normalizeText(value?.comment_id ?? value?.id);
        const message = normalizeText(value?.message);
        if (!commentId || !message) continue;
        out.push({
          platform: "facebook",
          eventKey: `facebook:${commentId}`,
          commentId,
          parentCommentId: normalizeText(value?.parent_id) || null,
          postId: normalizeText(value?.post_id) || null,
          mediaId: null,
          senderId: normalizeText(value?.from?.id ?? value?.sender_id) || null,
          senderName: normalizeText(value?.from?.name ?? value?.sender_name) || null,
          message,
          raw: { object, entry, change }
        });
        continue;
      }

      if ((object === "instagram" || object === "page") && field === "comments") {
        const commentId = normalizeText(value?.id ?? value?.comment_id);
        const message = normalizeText(value?.text ?? value?.message);
        if (!commentId || !message) continue;
        out.push({
          platform: "instagram",
          eventKey: `instagram:${commentId}`,
          commentId,
          parentCommentId: normalizeText(value?.parent_id) || null,
          postId: normalizeText(value?.post_id) || null,
          mediaId: normalizeText(value?.media?.id ?? value?.media_id) || null,
          senderId: normalizeText(value?.from?.id) || null,
          senderName: normalizeText(value?.from?.username ?? value?.from?.name) || null,
          message,
          raw: { object, entry, change }
        });
      }
    }
  }

  return out;
}

async function replyToFacebookComment(commentId: string, message: string) {
  const resolved = await resolvePageAccessToken();
  const form = new URLSearchParams();
  form.set("message", message);
  form.set("access_token", resolved.accessToken);
  const { json } = await metaFetchJson<{ id?: string }>(
    `https://graph.facebook.com/${resolved.graphVersion}/${encodeURIComponent(commentId)}/comments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString()
    }
  );
  return normalizeText(json?.id);
}

async function replyToInstagramComment(commentId: string, message: string) {
  const token = await resolveInstagramAccessToken();
  const { graphVersion } = getMetaRuntimeConfig();
  const form = new URLSearchParams();
  form.set("message", message);
  form.set("access_token", token.accessToken);
  const { json } = await metaFetchJson<{ id?: string }>(
    `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(commentId)}/replies`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString()
    }
  );
  return normalizeText(json?.id);
}

async function markEvent(
  service: SupabaseClient,
  eventKey: string,
  patch: Partial<{
    decision: string;
    matchedRule: string | null;
    replyAttempted: boolean;
    replySent: boolean;
    replyCommentId: string | null;
    replyMessage: string | null;
    error: string | null;
    processedAt: string | null;
  }>
) {
  const update: Record<string, any> = {};
  if (patch.decision !== undefined) update.decision = patch.decision;
  if (patch.matchedRule !== undefined) update.matched_rule = patch.matchedRule;
  if (patch.replyAttempted !== undefined) update.reply_attempted = patch.replyAttempted;
  if (patch.replySent !== undefined) update.reply_sent = patch.replySent;
  if (patch.replyCommentId !== undefined) update.reply_comment_id = patch.replyCommentId;
  if (patch.replyMessage !== undefined) update.reply_message = patch.replyMessage;
  if (patch.error !== undefined) update.error = patch.error;
  if (patch.processedAt !== undefined) update.processed_at = patch.processedAt;
  if (Object.keys(update).length === 0) return;
  const { error } = await service.from("social_comment_events").update(update).eq("event_key", eventKey);
  if (error) throw new Error(error.message);
}

export async function processSocialCommentEvent(service: SupabaseClient, event: NormalizedCommentEvent) {
  const nowIso = new Date().toISOString();
  const insert = await service
    .from("social_comment_events")
    .upsert(
      {
        event_key: event.eventKey,
        platform: event.platform,
        comment_id: event.commentId,
        parent_comment_id: event.parentCommentId,
        post_id: event.postId,
        media_id: event.mediaId,
        sender_id: event.senderId,
        sender_name: event.senderName,
        message: event.message,
        raw: event.raw,
        decision: "received"
      },
      { onConflict: "event_key", ignoreDuplicates: false }
    )
    .select("id, reply_sent, decision")
    .limit(1)
    .maybeSingle();

  if (insert.error) throw new Error(insert.error.message);
  if ((insert.data as any)?.reply_sent === true) {
    return { ok: true as const, decision: "already_replied" as const };
  }

  const settings = await getSocialAutoReplySettings(service);
  if (!settings.enabled) {
    await markEvent(service, event.eventKey, { decision: "disabled", processedAt: nowIso });
    return { ok: true as const, decision: "disabled" as const };
  }

  if (event.platform === "facebook" && !settings.facebookEnabled) {
    await markEvent(service, event.eventKey, { decision: "facebook_disabled", processedAt: nowIso });
    return { ok: true as const, decision: "facebook_disabled" as const };
  }

  if (event.platform === "instagram" && !settings.instagramEnabled) {
    await markEvent(service, event.eventKey, { decision: "instagram_disabled", processedAt: nowIso });
    return { ok: true as const, decision: "instagram_disabled" as const };
  }

  if (event.parentCommentId) {
    await markEvent(service, event.eventKey, { decision: "skip_nested", processedAt: nowIso });
    return { ok: true as const, decision: "skip_nested" as const };
  }

  if (event.message.length > settings.maxCommentLength) {
    await markEvent(service, event.eventKey, { decision: "skip_too_long", processedAt: nowIso });
    return { ok: true as const, decision: "skip_too_long" as const };
  }

  const ownFacebookId = normalizeText(process.env.FACEBOOK_PAGE_ID ?? process.env.META_PAGE_ID);
  const ownInstagramId = normalizeText(process.env.IG_USER_ID);
  if ((event.platform === "facebook" && event.senderId === ownFacebookId) || (event.platform === "instagram" && event.senderId === ownInstagramId)) {
    await markEvent(service, event.eventKey, { decision: "skip_own_comment", processedAt: nowIso });
    return { ok: true as const, decision: "skip_own_comment" as const };
  }

  if (event.senderId) {
    const cooldownSince = new Date(Date.now() - settings.authorCooldownHours * 60 * 60 * 1000).toISOString();
    const recent = await service
      .from("social_comment_events")
      .select("id")
      .eq("platform", event.platform)
      .eq("sender_id", event.senderId)
      .eq("reply_sent", true)
      .gte("created_at", cooldownSince)
      .limit(1)
      .maybeSingle();
    if (recent.error) throw new Error(recent.error.message);
    if (recent.data) {
      await markEvent(service, event.eventKey, { decision: "skip_author_cooldown", processedAt: nowIso });
      return { ok: true as const, decision: "skip_author_cooldown" as const };
    }
  }

  const existingReply = await service
    .from("social_comment_events")
    .select("id")
    .eq("platform", event.platform)
    .eq("comment_id", event.commentId)
    .eq("reply_sent", true)
    .limit(1)
    .maybeSingle();
  if (existingReply.error) throw new Error(existingReply.error.message);
  if (existingReply.data) {
    await markEvent(service, event.eventKey, { decision: "already_replied", processedAt: nowIso });
    return { ok: true as const, decision: "already_replied" as const };
  }

  const rule = findMatchingRule(event.message, event.platform, settings);
  if (!rule) {
    await markEvent(service, event.eventKey, { decision: "no_rule_match", processedAt: nowIso });
    return { ok: true as const, decision: "no_rule_match" as const };
  }

  const replyMessage = renderTemplate(rule.replyTemplate, settings);
  if (!replyMessage) {
    await markEvent(service, event.eventKey, { decision: "empty_reply", matchedRule: rule.id, processedAt: nowIso });
    return { ok: true as const, decision: "empty_reply" as const };
  }

  await markEvent(service, event.eventKey, {
    decision: "replying",
    matchedRule: rule.id,
    replyAttempted: true,
    replyMessage,
    processedAt: nowIso
  });

  try {
    const replyCommentId =
      event.platform === "facebook"
        ? await replyToFacebookComment(event.commentId, replyMessage)
        : await replyToInstagramComment(event.commentId, replyMessage);

    await markEvent(service, event.eventKey, {
      decision: "replied",
      matchedRule: rule.id,
      replyAttempted: true,
      replySent: true,
      replyCommentId: replyCommentId || null,
      replyMessage,
      error: null,
      processedAt: new Date().toISOString()
    });

    return { ok: true as const, decision: "replied" as const, replyCommentId };
  } catch (error: any) {
    await markEvent(service, event.eventKey, {
      decision: "reply_failed",
      matchedRule: rule.id,
      replyAttempted: true,
      replySent: false,
      replyMessage,
      error: String(error?.message ?? "Reply failed"),
      processedAt: new Date().toISOString()
    });
    return { ok: false as const, decision: "reply_failed" as const, error: String(error?.message ?? "Reply failed") };
  }
}
