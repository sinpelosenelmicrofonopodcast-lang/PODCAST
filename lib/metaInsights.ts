type ExternalPostRow = {
  id: string;
  platform: string | null;
  external_id: string | null;
  metrics: Record<string, any> | null;
  posted_at: string | null;
};

type SyncOptions = {
  force?: boolean;
  maxPerPlatform?: number;
  minSyncMinutes?: number;
};

type SyncSummary = {
  attempted: number;
  updated: number;
  skippedFresh: number;
  skippedInvalid: number;
  errors: Array<{ id: string; platform: string; error: string }>;
  permissionErrors: Array<{ platform: string; code: string; hint: string }>;
};

type MetricPayload = {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  reach?: number;
  engaged?: number;
  plays?: number;
};

function toPlatform(raw?: string | null) {
  const value = String(raw ?? "").toLowerCase().trim();
  if (value.includes("instagram")) return "instagram" as const;
  if (value.includes("facebook")) return "facebook" as const;
  return null;
}

function classifyPermissionError(platform: "facebook" | "instagram", error: string) {
  const msg = String(error ?? "");
  const lower = msg.toLowerCase();
  if (platform === "facebook" && (lower.includes("pages_read_engagement") || lower.includes("page public content access"))) {
    return {
      platform,
      code: "missing_pages_read_engagement",
      hint: "Tu token de página no tiene pages_read_engagement. Regenera el token con ese permiso."
    };
  }
  if (platform === "instagram" && lower.includes("instagram_manage_insights")) {
    return {
      platform,
      code: "missing_instagram_manage_insights",
      hint: "Tu token no tiene instagram_manage_insights para leer métricas de Instagram."
    };
  }
  return null;
}

function asNumber(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function getConfig() {
  return {
    graphVersion: String(process.env.META_GRAPH_VERSION ?? "v24.0").trim(),
    token: String(process.env.IG_ACCESS_TOKEN ?? process.env.META_PAGE_ACCESS_TOKEN ?? "").trim()
  };
}

async function graphGet(path: string, params: Record<string, string> = {}) {
  const { graphVersion, token } = getConfig();
  if (!token) throw new Error("Falta META_PAGE_ACCESS_TOKEN / IG_ACCESS_TOKEN en servidor.");

  const url = new URL(`https://graph.facebook.com/${graphVersion}${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), { cache: "no-store" });
  const json = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    throw new Error(String(json?.error?.message ?? `Meta API HTTP ${res.status}`));
  }
  return json as any;
}

async function graphGetSafe(path: string, params: Record<string, string> = {}) {
  try {
    const data = await graphGet(path, params);
    return { ok: true as const, data };
  } catch (e: any) {
    return { ok: false as const, error: String(e?.message ?? "Meta API error") };
  }
}

function parseInsightMetric(insights: any, key: string) {
  const rows = Array.isArray(insights?.data) ? insights.data : [];
  const found = rows.find((row: any) => String(row?.name ?? "") === key);
  if (!found) return 0;
  const value = Array.isArray(found?.values) ? found.values[0]?.value : found?.values?.value;
  return asNumber(value);
}

async function fetchFacebookMetrics(postId: string): Promise<MetricPayload> {
  const json = await graphGet(`/${encodeURIComponent(postId)}`, {
    fields: "id,shares,comments.summary(true),reactions.summary(true)"
  });

  const metricSets = [
    "post_impressions,post_impressions_unique,post_engaged_users",
    "post_impressions,post_engaged_users",
    "post_impressions"
  ];
  let insightsData: any = null;
  for (const metric of metricSets) {
    const res = await graphGetSafe(`/${encodeURIComponent(postId)}/insights`, { metric });
    if (res.ok) {
      insightsData = res.data;
      break;
    }
    const msg = String(res.error ?? "").toLowerCase();
    if (!msg.includes("valid insights metric")) {
      // Unknown hard failure (token/permission/etc): bubble up immediately.
      throw new Error(res.error);
    }
  }

  return {
    views: parseInsightMetric(insightsData, "post_impressions"),
    reach: parseInsightMetric(insightsData, "post_impressions_unique"),
    engaged: parseInsightMetric(insightsData, "post_engaged_users"),
    likes: asNumber(json?.reactions?.summary?.total_count),
    comments: asNumber(json?.comments?.summary?.total_count),
    shares: asNumber(json?.shares?.count)
  };
}

async function fetchInstagramInsights(mediaId: string) {
  try {
    return await graphGet(`/${encodeURIComponent(mediaId)}/insights`, {
      metric: "impressions,reach,saved,shares,engagement,plays,total_interactions,likes,comments"
    });
  } catch {
    return null;
  }
}

async function fetchInstagramMetrics(mediaId: string): Promise<MetricPayload> {
  const media = await graphGet(`/${encodeURIComponent(mediaId)}`, {
    fields: "id,like_count,comments_count,media_type,media_product_type,permalink,timestamp"
  });

  const insights = await fetchInstagramInsights(mediaId);
  const impressions = parseInsightMetric(insights, "impressions");
  const plays = parseInsightMetric(insights, "plays");
  const likesFromInsights = parseInsightMetric(insights, "likes");
  const commentsFromInsights = parseInsightMetric(insights, "comments");

  return {
    views: impressions > 0 ? impressions : plays,
    plays,
    reach: parseInsightMetric(insights, "reach"),
    engaged: parseInsightMetric(insights, "engagement") || parseInsightMetric(insights, "total_interactions"),
    shares: parseInsightMetric(insights, "shares"),
    likes: likesFromInsights > 0 ? likesFromInsights : asNumber(media?.like_count),
    comments: commentsFromInsights > 0 ? commentsFromInsights : asNumber(media?.comments_count)
  };
}

function isFresh(metrics: Record<string, any> | null, minSyncMinutes: number) {
  const syncedAt = String(metrics?.synced_at ?? "").trim();
  if (!syncedAt) return false;
  const ms = new Date(syncedAt).getTime();
  if (!Number.isFinite(ms)) return false;
  return Date.now() - ms < minSyncMinutes * 60 * 1000;
}

export async function syncMetaInsights(service: any, options: SyncOptions = {}): Promise<SyncSummary> {
  const force = options.force === true;
  const maxPerPlatform = Math.max(1, Math.min(80, Number(options.maxPerPlatform ?? 40)));
  const minSyncMinutes = Math.max(1, Number(options.minSyncMinutes ?? 120));

  const summary: SyncSummary = {
    attempted: 0,
    updated: 0,
    skippedFresh: 0,
    skippedInvalid: 0,
    errors: [],
    permissionErrors: []
  };

  const { data, error } = await service
    .from("external_posts")
    .select("id, platform, external_id, metrics, posted_at")
    .not("external_id", "is", null)
    .order("posted_at", { ascending: false })
    .limit(600);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as ExternalPostRow[];
  const selected: ExternalPostRow[] = [];
  const perPlatformCounter = { facebook: 0, instagram: 0 };

  for (const row of rows) {
    const platform = toPlatform(row.platform);
    if (!platform) continue;
    if (perPlatformCounter[platform] >= maxPerPlatform) continue;
    perPlatformCounter[platform] += 1;
    selected.push(row);
  }

  async function processRow(row: ExternalPostRow) {
    const platform = toPlatform(row.platform);
    const externalId = String(row.external_id ?? "").trim();
    if (!platform || !externalId) {
      return { kind: "skippedInvalid" as const };
    }
    if (!force && isFresh(row.metrics, minSyncMinutes)) {
      return { kind: "skippedFresh" as const };
    }

    try {
      const payload = platform === "facebook" ? await fetchFacebookMetrics(externalId) : await fetchInstagramMetrics(externalId);
      const nextMetrics = {
        ...(row.metrics ?? {}),
        ...payload,
        synced_from: "meta_graph",
        synced_at: new Date().toISOString()
      };

      const upd = await service.from("external_posts").update({ metrics: nextMetrics }).eq("id", row.id);
      if (upd.error) throw new Error(upd.error.message);
      return { kind: "updated" as const };
    } catch (e: any) {
      return {
        kind: "error" as const,
        id: row.id,
        platform,
        error: String(e?.message ?? "Error sync")
      };
    }
  }

  const batchSize = 4;
  for (let i = 0; i < selected.length; i += batchSize) {
    const batch = selected.slice(i, i + batchSize);
    const results = await Promise.all(batch.map((row) => processRow(row)));
    for (const result of results) {
      if (result.kind === "skippedFresh") {
        summary.skippedFresh += 1;
        continue;
      }
      if (result.kind === "skippedInvalid") {
        summary.skippedInvalid += 1;
        continue;
      }
      summary.attempted += 1;
      if (result.kind === "updated") {
        summary.updated += 1;
        continue;
      }
      const perm = classifyPermissionError(result.platform as "facebook" | "instagram", result.error);
      if (perm) {
        if (!summary.permissionErrors.some((row) => row.code === perm.code)) {
          summary.permissionErrors.push(perm);
        }
        continue;
      }
      summary.errors.push({ id: result.id, platform: result.platform, error: result.error });
    }
  }

  return summary;
}
