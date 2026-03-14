import type { SupabaseClient } from "@supabase/supabase-js";
import { SPM_AUTOPOST_TIMEZONE, type ScheduledPostPlatform, chicagoDateInputFromNow, chicagoLocalToUtcIso } from "@/lib/autoPosts";

const YOUTUBE_URL = "https://www.youtube.com/@SinPelosEnElMicrofono";
const YOUTUBE_CAMPAIGN_KEY = "youtube_daily_follow";
const RANDOM_GRANULARITY_MINUTES = 5;
const DAILY_WINDOW_START_MINUTE = 10 * 60;
const DAILY_WINDOW_END_MINUTE = 20 * 60 + 30;
const MINIMUM_LEAD_MINUTES = 20;

type CampaignRowInput = {
  campaignKey?: string | null;
  campaignLabel?: string | null;
  startDate: string;
  dailyTime: string;
  platforms: ScheduledPostPlatform[];
  messages: string[];
  mediaUrl?: string | null;
  linkUrl?: string | null;
  createdBy?: string | null;
};

function normalizeText(value?: string | null) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function addDays(localDate: string, days: number) {
  const [year, month, day] = localDate.split("-").map((value) => Number(value));
  const baseUtc = Date.UTC(year, month - 1, day);
  const next = new Date(baseUtc + days * 24 * 60 * 60 * 1000);
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

function seededInt(seed: string) {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function fromMinutes(value: number) {
  const hh = Math.floor(value / 60);
  const mm = value % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function localMinuteOfDay(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit"
  });
  const parts: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  return Number(parts.hour ?? "0") * 60 + Number(parts.minute ?? "0");
}

function pickRandomMinute(localDate: string, minMinute: number, maxMinute: number) {
  const safeMin = Math.max(0, minMinute);
  const safeMax = Math.max(safeMin, maxMinute);
  const steps = Math.max(0, Math.floor((safeMax - safeMin) / RANDOM_GRANULARITY_MINUTES));
  const offset = seededInt(`${localDate}:youtube-follow-minute`) % (steps + 1);
  return safeMin + offset * RANDOM_GRANULARITY_MINUTES;
}

export function buildYoutubeReminderMessages(count = 30) {
  const intros = [
    "Si todavia no te has suscrito",
    "Si aun no te has dado la vuelta",
    "Si no nos sigues todavia",
    "Si te estas perdiendo los episodios"
  ];
  const hooks = [
    "en YouTube, hazlo hoy.",
    "en el canal, este es el momento.",
    "date la vuelta por el canal.",
    "suscribete para no perderte lo proximo."
  ];
  const ctas = [
    "Ve a verlo aqui:",
    "Pasa por el canal:",
    "Mira los episodios aqui:",
    "Dale subscribe aqui:"
  ];

  return Array.from({ length: count }, (_, index) => {
    const intro = intros[index % intros.length];
    const hook = hooks[(index + 1) % hooks.length];
    const cta = ctas[(index + 2) % ctas.length];
    return `${intro} ${hook} ${cta} ${YOUTUBE_URL}`;
  });
}

export function buildCampaignRows(input: CampaignRowInput) {
  const messages = input.messages.map((value) => normalizeText(value)).filter(Boolean);
  const platforms = Array.from(new Set(input.platforms));
  const campaignKey = normalizeText(input.campaignKey) || null;
  const campaignLabel = normalizeText(input.campaignLabel) || null;
  const mediaUrl = normalizeText(input.mediaUrl) || null;
  const linkUrl = normalizeText(input.linkUrl) || null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) {
    throw new Error("Fecha inicial invalida. Usa YYYY-MM-DD.");
  }
  if (!/^\d{2}:\d{2}$/.test(input.dailyTime)) {
    throw new Error("Hora diaria invalida. Usa HH:mm.");
  }
  if (messages.length === 0) throw new Error("Debes incluir al menos un mensaje.");
  if (platforms.length === 0) throw new Error("Selecciona al menos una plataforma.");
  if (platforms.some((platform) => platform.startsWith("instagram")) && !mediaUrl) {
    throw new Error("Instagram requiere image URL publica.");
  }

  const rows: Array<Record<string, any>> = [];
  messages.forEach((message, index) => {
    const localDate = addDays(input.startDate, index);
    const scheduledForUtc = chicagoLocalToUtcIso(localDate, input.dailyTime);
    platforms.forEach((platform) => {
      rows.push({
        platform,
        message,
        media_url: mediaUrl,
        link_url: linkUrl,
        campaign_key: campaignKey,
        campaign_label: campaignLabel,
        publish_as: platform === "instagram_story" ? "story" : "feed",
        scheduled_for: scheduledForUtc,
        status: "queued",
        created_by: input.createdBy ?? null
      });
    });
  });

  return rows;
}

function resolveYoutubeTargetDate(now: Date, scheduledDates: Set<string>) {
  const today = chicagoDateInputFromNow(now);
  const nowMinute = localMinuteOfDay(now, SPM_AUTOPOST_TIMEZONE);
  const candidates = [today, addDays(today, 1)];

  for (const localDate of candidates) {
    if (scheduledDates.has(localDate)) continue;
    const minMinute =
      localDate === today ? Math.max(DAILY_WINDOW_START_MINUTE, nowMinute + MINIMUM_LEAD_MINUTES) : DAILY_WINDOW_START_MINUTE;
    if (minMinute > DAILY_WINDOW_END_MINUTE) continue;
    return { localDate, minMinute };
  }

  return null;
}

export async function scheduleDailyYoutubeFollowReminder(service: SupabaseClient, now = new Date()) {
  const existing = await service
    .from("scheduled_posts")
    .select("scheduled_for")
    .eq("campaign_key", YOUTUBE_CAMPAIGN_KEY)
    .in("status", ["queued", "publishing", "posted"])
    .order("scheduled_for", { ascending: false })
    .limit(120);

  if (existing.error) throw new Error(existing.error.message);

  const scheduledDates = new Set<string>();
  for (const row of existing.data ?? []) {
    const scheduledFor = normalizeText((row as any)?.scheduled_for);
    if (!scheduledFor) continue;
    const parsed = new Date(scheduledFor);
    if (Number.isNaN(parsed.getTime())) continue;
    scheduledDates.add(chicagoDateInputFromNow(parsed));
  }

  const target = resolveYoutubeTargetDate(now, scheduledDates);
  if (!target) {
    return { ok: true as const, scheduled: false as const, reason: "already_scheduled" as const };
  }

  const localTime = fromMinutes(pickRandomMinute(target.localDate, target.minMinute, DAILY_WINDOW_END_MINUTE));
  const scheduledFor = chicagoLocalToUtcIso(target.localDate, localTime);
  const message = buildYoutubeReminderMessages(1)[0];

  const insert = await service
    .from("scheduled_posts")
    .insert({
      platform: "facebook_page",
      message,
      media_url: null,
      link_url: YOUTUBE_URL,
      campaign_key: YOUTUBE_CAMPAIGN_KEY,
      campaign_label: "YouTube diario",
      publish_as: "feed",
      scheduled_for: scheduledFor,
      status: "queued"
    })
    .select("id")
    .limit(1)
    .maybeSingle();

  if (insert.error) throw new Error(insert.error.message);

  return {
    ok: true as const,
    scheduled: true as const,
    id: String(insert.data?.id ?? ""),
    localDate: target.localDate,
    localTime,
    scheduledFor
  };
}
