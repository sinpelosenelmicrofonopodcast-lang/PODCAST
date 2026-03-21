import type { SupabaseClient } from "@supabase/supabase-js";
import { SPM_AUTOPOST_TIMEZONE, chicagoDateInputFromNow, chicagoLocalToUtcIso } from "@/lib/autoPosts";
import { createAutomationJob, logPipelineEvent } from "@/lib/pipelineOps";
import { getPublishedEpisodes } from "@/lib/seo/content";
import { getYouTubeVideoId, isShorts } from "@/lib/youtube";

const RESURFACER_SOURCE = "facebook_episode_resurface";
const DAILY_WINDOW_START_MINUTE = 10 * 60;
const DAILY_WINDOW_END_MINUTE = 21 * 60;
const MINIMUM_LEAD_MINUTES = 15;
const RANDOM_GRANULARITY_MINUTES = 5;
const CANDIDATE_POOL_SIZE = 12;
const DAILY_POSTS_PER_DAY = 2;

type EpisodeCandidate = {
  id: string;
  slug: string;
  title: string;
  description: string;
  sourceUrl: string | null;
  publishedAt: string | null;
};

type HistoryRow = {
  content_id: string | null;
  scheduled_for: string | null;
};

type ExternalEpisodeRow = {
  id: string | null;
  title: string | null;
  caption: string | null;
  source_url: string | null;
  posted_at: string | null;
  metrics?: {
    durationSeconds?: number | null;
    isShort?: boolean | null;
  } | null;
};

export type EpisodeResurfacerResult =
  | {
      ok: true;
      scheduled: true;
      created: Array<{
        jobId: string;
        episodeId: string;
        episodeTitle: string;
        scheduledFor: string;
        localDate: string;
        localTime: string;
      }>;
      scheduledCount: number;
      missingToday: number;
      missingTomorrow: number;
    }
  | {
      ok: true;
      scheduled: false;
      reason: "no_candidates" | "already_scheduled";
    };

function normalizeText(value?: string | null) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function shortText(value?: string | null, max = 220) {
  const clean = normalizeText(value);
  if (!clean) return "";
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
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

function buildAvailableMinuteSlots(localDate: string, minMinute: number, maxMinute: number) {
  const safeMin = Math.max(0, minMinute);
  const safeMax = Math.max(safeMin, maxMinute);
  const slots: number[] = [];
  for (let minute = safeMin; minute <= safeMax; minute += RANDOM_GRANULARITY_MINUTES) {
    slots.push(minute);
  }
  return slots;
}

function pickRandomMinutes(localDate: string, minMinute: number, maxMinute: number, count: number) {
  const slots = buildAvailableMinuteSlots(localDate, minMinute, maxMinute);
  if (slots.length === 0 || count <= 0) return [];

  const remaining = [...slots];
  const selected: number[] = [];
  for (let slotIndex = 0; slotIndex < count && remaining.length > 0; slotIndex += 1) {
    const idx = seededInt(`${localDate}:facebook-episode-minute:${slotIndex}`) % remaining.length;
    const [minute] = remaining.splice(idx, 1);
    selected.push(minute);
  }

  return selected.sort((left, right) => left - right);
}

function buildResurfaceMessage(candidate: EpisodeCandidate) {
  const excerpt = shortText(candidate.description, 240);
  if (excerpt) {
    return `${candidate.title}\n\n${excerpt}\n\nSi no has visto este episodio todavia, date la vuelta y miralo completo.`;
  }
  return `${candidate.title}\n\nSi no has visto este episodio todavia, date la vuelta y miralo completo.`;
}

function toEpisodeCandidate(row: Awaited<ReturnType<typeof getPublishedEpisodes>>[number]): EpisodeCandidate {
  const fallbackSlug = getYouTubeVideoId(row.youtube_url) || String(row.id);
  return {
    id: String(row.id),
    slug: normalizeText(row.slug) || fallbackSlug,
    title: normalizeText(row.title) || "Episodio",
    description: normalizeText(row.description),
    sourceUrl: normalizeText(row.youtube_url) || null,
    publishedAt: row.published_at ?? row.updated_at ?? null
  };
}

function isEligibleFullEpisode(row: Awaited<ReturnType<typeof getPublishedEpisodes>>[number]) {
  const sourceUrl = normalizeText(row.youtube_url).toLowerCase();
  if (sourceUrl.includes("/shorts/")) return false;
  if (isShorts(row.duration_seconds)) return false;
  return true;
}

function isEligibleExternalEpisode(row: ExternalEpisodeRow) {
  const sourceUrl = normalizeText(row.source_url);
  if (!sourceUrl) return false;
  const youtubeId = getYouTubeVideoId(sourceUrl);
  if (!youtubeId) return false;
  const title = normalizeText(row.title).toLowerCase();
  if (title === "auto post") return false;
  const metrics = row.metrics ?? null;
  if (metrics?.isShort === true) return false;
  if (isShorts(metrics?.durationSeconds ?? null)) return false;
  if (sourceUrl.toLowerCase().includes("/shorts/")) return false;
  return true;
}

function toExternalEpisodeCandidate(row: ExternalEpisodeRow): EpisodeCandidate {
  const sourceUrl = normalizeText(row.source_url) || null;
  const fallbackSlug = getYouTubeVideoId(sourceUrl) || String(row.id ?? "");
  return {
    id: String(row.id ?? fallbackSlug),
    slug: fallbackSlug,
    title: normalizeText(row.title) || "Episodio",
    description: normalizeText(row.caption),
    sourceUrl,
    publishedAt: row.posted_at ?? null
  };
}

async function getExternalEpisodeCandidates(service: SupabaseClient, limit: number): Promise<EpisodeCandidate[]> {
  const desiredLimit = Math.max(1, Math.floor(Number(limit) || 100));
  const preloadLimit = Math.max(desiredLimit * 4, 200);
  const res = await service
    .from("external_posts")
    .select("id, title, caption, source_url, posted_at, metrics")
    .not("source_url", "is", null)
    .order("posted_at", { ascending: false })
    .limit(preloadLimit);

  if (res.error) {
    throw new Error(res.error.message);
  }

  const seen = new Set<string>();
  const candidates: EpisodeCandidate[] = [];
  for (const row of (res.data ?? []) as ExternalEpisodeRow[]) {
    if (!isEligibleExternalEpisode(row)) continue;
    const candidate = toExternalEpisodeCandidate(row);
    if (!candidate.slug || seen.has(candidate.slug)) continue;
    seen.add(candidate.slug);
    candidates.push(candidate);
    if (candidates.length >= desiredLimit) break;
  }

  return candidates;
}

function safeTimestamp(value?: string | null) {
  const stamp = new Date(String(value ?? "")).getTime();
  return Number.isFinite(stamp) ? stamp : 0;
}

function resolveTargetDates(now: Date, scheduledCounts: Map<string, number>) {
  const today = chicagoDateInputFromNow(now);
  const nowMinute = localMinuteOfDay(now, SPM_AUTOPOST_TIMEZONE);
  const tomorrow = addDays(today, 1);
  const candidates = [today, tomorrow];
  const targets: Array<{ localDate: string; minMinute: number; missingSlots: number }> = [];

  for (const localDate of candidates) {
    const scheduledCount = scheduledCounts.get(localDate) ?? 0;
    const missingSlots = Math.max(0, DAILY_POSTS_PER_DAY - scheduledCount);
    if (missingSlots <= 0) continue;
    const minMinute =
      localDate === today ? Math.max(DAILY_WINDOW_START_MINUTE, nowMinute + MINIMUM_LEAD_MINUTES) : DAILY_WINDOW_START_MINUTE;
    if (minMinute > DAILY_WINDOW_END_MINUTE) continue;
    targets.push({ localDate, minMinute, missingSlots });
  }

  return {
    today,
    tomorrow,
    targets
  };
}

function pickEpisodeCandidate(
  episodes: EpisodeCandidate[],
  history: HistoryRow[],
  localDate: string,
  slotIndex: number,
  excludedEpisodeIds: Set<string>
) {
  const lastScheduledByEpisode = new Map<string, string>();
  let latestEpisodeId: string | null = null;

  for (const row of history) {
    const episodeId = normalizeText(row.content_id);
    const scheduledFor = normalizeText(row.scheduled_for);
    if (!episodeId || !scheduledFor) continue;
    if (!latestEpisodeId) latestEpisodeId = episodeId;
    if (!lastScheduledByEpisode.has(episodeId)) {
      lastScheduledByEpisode.set(episodeId, scheduledFor);
    }
  }

  const ranked = [...episodes].sort((left, right) => {
    const leftLast = safeTimestamp(lastScheduledByEpisode.get(left.id));
    const rightLast = safeTimestamp(lastScheduledByEpisode.get(right.id));
    if (leftLast !== rightLast) return leftLast - rightLast;
    return safeTimestamp(left.publishedAt) - safeTimestamp(right.publishedAt);
  });

  const available = ranked.filter((candidate) => !excludedEpisodeIds.has(candidate.id));
  const base = available.length > 0 ? available : ranked;
  const withoutLatest = base.filter((candidate) => candidate.id !== latestEpisodeId);
  const poolBase = withoutLatest.length > 0 ? withoutLatest : base;
  const pool = poolBase.slice(0, Math.max(1, Math.min(CANDIDATE_POOL_SIZE, poolBase.length)));
  if (pool.length === 0) return null;

  const idx = seededInt(`${localDate}:facebook-episode-candidate:${slotIndex}`) % pool.length;
  return pool[idx];
}

export async function scheduleDailyEpisodeResurface(
  service: SupabaseClient,
  now = new Date()
): Promise<EpisodeResurfacerResult> {
  const mergedEpisodes = [
    ...(await getPublishedEpisodes(400)).filter(isEligibleFullEpisode).map(toEpisodeCandidate),
    ...(await getExternalEpisodeCandidates(service, 400))
  ];
  const seenEpisodeKeys = new Set<string>();
  const episodes = mergedEpisodes.filter((episode) => {
    const key = normalizeText(episode.slug) || normalizeText(episode.sourceUrl) || normalizeText(episode.id);
    if (!key || seenEpisodeKeys.has(key)) return false;
    seenEpisodeKeys.add(key);
    return true;
  });
  if (episodes.length === 0) {
    return { ok: true, scheduled: false, reason: "no_candidates" };
  }

  const historyRes = await service
    .from("automation_jobs")
    .select("content_id, scheduled_for")
    .eq("job_type", "facebook_post_episode")
    .eq("source", RESURFACER_SOURCE)
    .in("status", ["queued", "running", "done"])
    .order("scheduled_for", { ascending: false })
    .limit(500);

  if (historyRes.error) {
    throw new Error(historyRes.error.message);
  }

  const history = (historyRes.data ?? []) as HistoryRow[];
  const scheduledCounts = new Map<string, number>();
  for (const row of history) {
    const iso = normalizeText(row.scheduled_for);
    if (!iso) continue;
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) continue;
    const localDate = chicagoDateInputFromNow(parsed);
    scheduledCounts.set(localDate, (scheduledCounts.get(localDate) ?? 0) + 1);
  }

  const scheduleWindow = resolveTargetDates(now, scheduledCounts);
  if (scheduleWindow.targets.length === 0) {
    return { ok: true, scheduled: false, reason: "already_scheduled" };
  }

  const created: Array<{
    jobId: string;
    episodeId: string;
    episodeTitle: string;
    scheduledFor: string;
    localDate: string;
    localTime: string;
  }> = [];
  const excludedEpisodeIds = new Set<string>();

  for (const target of scheduleWindow.targets) {
    const minutes = pickRandomMinutes(target.localDate, target.minMinute, DAILY_WINDOW_END_MINUTE, target.missingSlots);
    for (let slotIndex = 0; slotIndex < minutes.length; slotIndex += 1) {
      const picked = pickEpisodeCandidate(
        episodes,
        history,
        target.localDate,
        slotIndex,
        excludedEpisodeIds
      );
      if (!picked) continue;

      const localTime = fromMinutes(minutes[slotIndex]);
      const scheduledFor = chicagoLocalToUtcIso(target.localDate, localTime);
      const customText = buildResurfaceMessage(picked);

      const jobId = await createAutomationJob(service, {
        jobType: "facebook_post_episode",
        source: RESURFACER_SOURCE,
        title: `Auto share: ${picked.title}`.slice(0, 120),
        contentType: "episode",
        contentId: picked.id,
        payload: {
          episodeId: picked.id,
          episodeSlug: picked.slug,
          title: picked.title,
          description: picked.description || null,
          sourceUrl: picked.sourceUrl,
          customText,
          autoResurface: true,
          localDate: target.localDate,
          localTime
        },
        status: "queued",
        priority: 55,
        scheduledFor
      });

      await logPipelineEvent(service, {
        jobId,
        stage: "social",
        status: "info",
        contentType: "episode",
        contentId: picked.id,
        platform: "Facebook",
        message: "Episodio programado automaticamente para resurfacerse en Facebook",
        meta: {
          local_date: target.localDate,
          local_time: localTime,
          auto_resurface: true
        }
      });

      excludedEpisodeIds.add(picked.id);
      created.push({
        jobId,
        episodeId: picked.id,
        episodeTitle: picked.title,
        scheduledFor,
        localDate: target.localDate,
        localTime
      });
    }
  }

  if (created.length === 0) {
    return { ok: true, scheduled: false, reason: "no_candidates" };
  }

  return {
    ok: true,
    scheduled: true,
    created,
    scheduledCount: created.length,
    missingToday: Math.max(0, DAILY_POSTS_PER_DAY - (scheduledCounts.get(scheduleWindow.today) ?? 0) - created.filter((item) => item.localDate === scheduleWindow.today).length),
    missingTomorrow: Math.max(0, DAILY_POSTS_PER_DAY - (scheduledCounts.get(scheduleWindow.tomorrow) ?? 0) - created.filter((item) => item.localDate === scheduleWindow.tomorrow).length)
  };
}
