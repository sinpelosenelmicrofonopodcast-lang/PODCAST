import type { SupabaseClient } from "@supabase/supabase-js";
import { resolvePageAccessToken } from "@/lib/metaTokens";

type MetaConfig = {
  pageId: string;
  pageAccessToken: string;
  pageAccessTokenRef: string;
  graphVersion: string;
  appId: string;
  appSecret: string;
};

type GraphError = {
  message: string;
  status: number;
  code?: number;
  subcode?: number;
};

type GraphPage<T> = {
  data: T[];
  paging?: { next?: string };
};

type FacebookPostGraph = {
  id: string;
  message?: string;
  permalink_url?: string;
  created_time?: string;
  updated_time?: string;
  comments?: { summary?: { total_count?: number } };
  reactions?: { summary?: { total_count?: number } };
  [key: string]: any;
};

type FacebookCommentGraph = {
  id: string;
  message?: string;
  created_time?: string;
  from?: { id?: string; name?: string };
  [key: string]: any;
};

type FacebookReactionGraph = {
  id?: string;
  name?: string;
  type?: string;
  created_time?: string;
  [key: string]: any;
};

type DashboardDateRange = "7d" | "30d" | "90d" | "custom";

type RangeInput = {
  range?: string | null;
  start?: string | null;
  end?: string | null;
};

type RangeResolved = {
  key: DashboardDateRange;
  startAt: Date;
  endAt: Date;
};

type SyncInput = {
  days?: number;
  maxPosts?: number;
};

type SyncSummary = {
  pageId: string;
  pageName: string;
  postsSynced: number;
  commentsSynced: number;
  reactionsSynced: number;
  fansUpdated: number;
  syncRunId: string;
};

type FanScoreRow = {
  user_name: string | null;
  fb_user_id: string;
  total_comments: number;
  total_reactions: number;
  posts_interacted_count: number;
  engagement_score: number;
  last_interacted_at: string | null;
};

type OverviewInput = {
  range?: string | null;
  start?: string | null;
  end?: string | null;
  postId?: string | null;
};

async function getMetaConfig(): Promise<MetaConfig> {
  const resolved = await resolvePageAccessToken();
  const tokenRef = resolved.source.includes(":") ? `resolved:${resolved.source}` : `env:${resolved.source}`;

  return {
    pageId: resolved.pageId,
    pageAccessToken: resolved.accessToken,
    pageAccessTokenRef: tokenRef,
    graphVersion: resolved.graphVersion,
    appId: String(process.env.META_APP_ID ?? "").trim(),
    appSecret: String(process.env.META_APP_SECRET ?? "").trim()
  };
}

function assertMetaConfig(config: MetaConfig) {
  if (!config.pageId || !config.pageAccessToken) {
    throw new Error("Faltan FACEBOOK_PAGE_ID/META_PAGE_ID o FACEBOOK_PAGE_ACCESS_TOKEN/META_PAGE_ACCESS_TOKEN en el servidor.");
  }
}

function escapeCsvValue(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function toIsoOrNull(value?: string | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.toISOString();
}

function chunkArray<T>(items: T[], chunkSize = 250): T[][] {
  const size = Math.max(1, Math.floor(chunkSize));
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function bucketWeekKey(iso: string | null) {
  if (!iso) return "unknown";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "unknown";
  const day = d.getUTCDay(); // 0=dom,1=lun
  const shift = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + shift);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function resolveRange(input: RangeInput): RangeResolved {
  const now = new Date();
  const keyRaw = String(input.range ?? "30d").trim().toLowerCase();
  const key: DashboardDateRange =
    keyRaw === "7d" || keyRaw === "30d" || keyRaw === "90d" || keyRaw === "custom" ? (keyRaw as DashboardDateRange) : "30d";

  if (key === "custom") {
    const start = toIsoOrNull(input.start);
    const end = toIsoOrNull(input.end);
    if (start && end) {
      const a = new Date(start);
      const b = new Date(end);
      if (a.getTime() <= b.getTime()) return { key, startAt: a, endAt: b };
      return { key, startAt: b, endAt: a };
    }
  }

  const days = key === "7d" ? 7 : key === "90d" ? 90 : 30;
  const startAt = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { key: key === "custom" ? "30d" : key, startAt, endAt: now };
}

async function graphFetchJson<T = any>(url: string): Promise<T> {
  const res = await fetch(url, { method: "GET", cache: "no-store" });
  const json = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    const error: GraphError = {
      message: String(json?.error?.message ?? `Meta API HTTP ${res.status}`),
      status: res.status,
      code: Number(json?.error?.code ?? 0) || undefined,
      subcode: Number(json?.error?.error_subcode ?? 0) || undefined
    };
    throw new Error(JSON.stringify(error));
  }
  return json as T;
}

function buildGraphUrl(config: MetaConfig, path: string, params: Record<string, string>) {
  const url = new URL(`https://graph.facebook.com/${config.graphVersion}/${path.replace(/^\//, "")}`);
  url.searchParams.set("access_token", config.pageAccessToken);
  for (const [k, v] of Object.entries(params)) {
    if (String(v ?? "").trim()) url.searchParams.set(k, String(v));
  }
  return url.toString();
}

async function fetchPaginatedData<T = any>(initialUrl: string, maxItems: number, maxPages = 60): Promise<T[]> {
  let nextUrl: string | null = initialUrl;
  const output: T[] = [];
  let pages = 0;

  while (nextUrl && output.length < maxItems && pages < maxPages) {
    const page: GraphPage<T> = await graphFetchJson(nextUrl);
    const rows = Array.isArray(page?.data) ? page.data : [];
    output.push(...rows);
    nextUrl = page?.paging?.next ? String(page.paging.next) : null;
    pages += 1;
  }

  return output.slice(0, maxItems);
}

async function graphGetDebugScopes(config: MetaConfig): Promise<string[]> {
  if (!config.appId || !config.appSecret || !config.pageAccessToken) return [];
  const url = new URL(`https://graph.facebook.com/${config.graphVersion}/debug_token`);
  url.searchParams.set("input_token", config.pageAccessToken);
  url.searchParams.set("access_token", `${config.appId}|${config.appSecret}`);

  try {
    const json = await graphFetchJson<any>(url.toString());
    const scopes = Array.isArray(json?.data?.scopes) ? json.data.scopes : [];
    return scopes.map((value: unknown) => String(value)).filter(Boolean);
  } catch {
    return [];
  }
}

async function fetchPageProfile(config: MetaConfig) {
  const url = buildGraphUrl(config, config.pageId, { fields: "id,name,link" });
  return graphFetchJson<{ id: string; name?: string; link?: string }>(url);
}

async function fetchPostsForSync(config: MetaConfig, sinceIso: string, untilIso: string, maxPosts: number) {
  const fields = [
    "id",
    "message",
    "permalink_url",
    "created_time",
    "updated_time",
    "comments.summary(true).limit(0)",
    "reactions.summary(true).limit(0)"
  ].join(",");

  const url = buildGraphUrl(config, `${config.pageId}/posts`, {
    fields,
    limit: "25",
    since: sinceIso,
    until: untilIso
  });

  return fetchPaginatedData<FacebookPostGraph>(url, maxPosts, 30);
}

async function fetchCommentsForPost(config: MetaConfig, postId: string) {
  const url = buildGraphUrl(config, `${postId}/comments`, {
    fields: "id,message,from,created_time",
    filter: "stream",
    limit: "100"
  });
  return fetchPaginatedData<FacebookCommentGraph>(url, 5000, 100);
}

async function fetchReactionsForPost(config: MetaConfig, postId: string) {
  const url = buildGraphUrl(config, `${postId}/reactions`, {
    fields: "id,name,type,created_time",
    limit: "100"
  });
  return fetchPaginatedData<FacebookReactionGraph>(url, 10000, 120);
}

async function upsertInBatches(
  service: SupabaseClient,
  table: string,
  rows: Record<string, any>[],
  onConflict: string
) {
  if (rows.length === 0) return;
  for (const batch of chunkArray(rows, 300)) {
    const { error } = await service.from(table).upsert(batch, { onConflict });
    if (error) throw new Error(error.message);
  }
}

type FanAgg = {
  userName: string | null;
  comments: number;
  reactions: number;
  posts: Set<string>;
  lastInteractedAt: string | null;
};

function addLastInteraction(current: string | null, candidate: string | null) {
  if (!candidate) return current;
  if (!current) return candidate;
  return new Date(candidate).getTime() > new Date(current).getTime() ? candidate : current;
}

function computeFanScores(
  comments: Array<{ fb_post_id: string | null; fb_user_id: string | null; user_name: string | null; created_time: string | null }>,
  reactions: Array<{ fb_post_id: string | null; fb_user_id: string | null; user_name: string | null; created_at: string | null }>
): FanScoreRow[] {
  const map = new Map<string, FanAgg>();

  for (const row of comments) {
    const fanId = String(row.fb_user_id ?? "").trim();
    if (!fanId) continue;
    const current = map.get(fanId) ?? {
      userName: row.user_name ?? null,
      comments: 0,
      reactions: 0,
      posts: new Set<string>(),
      lastInteractedAt: null
    };
    current.comments += 1;
    if (row.fb_post_id) current.posts.add(String(row.fb_post_id));
    if (!current.userName && row.user_name) current.userName = row.user_name;
    current.lastInteractedAt = addLastInteraction(current.lastInteractedAt, toIsoOrNull(row.created_time));
    map.set(fanId, current);
  }

  for (const row of reactions) {
    const fanId = String(row.fb_user_id ?? "").trim();
    if (!fanId) continue;
    const current = map.get(fanId) ?? {
      userName: row.user_name ?? null,
      comments: 0,
      reactions: 0,
      posts: new Set<string>(),
      lastInteractedAt: null
    };
    current.reactions += 1;
    if (row.fb_post_id) current.posts.add(String(row.fb_post_id));
    if (!current.userName && row.user_name) current.userName = row.user_name;
    current.lastInteractedAt = addLastInteraction(current.lastInteractedAt, toIsoOrNull(row.created_at));
    map.set(fanId, current);
  }

  const rows: FanScoreRow[] = [];
  for (const [fbUserId, agg] of map.entries()) {
    const postsInteractedCount = agg.posts.size;
    const engagementScore = agg.comments * 5 + agg.reactions + (postsInteractedCount > 1 ? 3 : 0);
    rows.push({
      fb_user_id: fbUserId,
      user_name: agg.userName,
      total_comments: agg.comments,
      total_reactions: agg.reactions,
      posts_interacted_count: postsInteractedCount,
      engagement_score: engagementScore,
      last_interacted_at: agg.lastInteractedAt
    });
  }

  rows.sort((a, b) => {
    if (b.engagement_score !== a.engagement_score) return b.engagement_score - a.engagement_score;
    if (b.total_comments !== a.total_comments) return b.total_comments - a.total_comments;
    if (b.total_reactions !== a.total_reactions) return b.total_reactions - a.total_reactions;
    return new Date(b.last_interacted_at ?? 0).getTime() - new Date(a.last_interacted_at ?? 0).getTime();
  });
  return rows;
}

async function fetchTableInPages<T>(
  service: SupabaseClient,
  table: string,
  selectCols: string,
  options: {
    orderBy: string;
    ascending?: boolean;
    pageSize?: number;
    startAt?: string;
    endAt?: string;
    timestampColumn?: string;
    postId?: string | null;
    maxRows?: number;
  }
): Promise<T[]> {
  const pageSize = Math.max(100, Math.min(1000, Number(options.pageSize ?? 1000)));
  const maxRows = Math.max(pageSize, Math.min(100000, Number(options.maxRows ?? 20000)));
  const output: T[] = [];

  for (let from = 0; from < maxRows; from += pageSize) {
    let query = service
      .from(table)
      .select(selectCols)
      .order(options.orderBy, { ascending: options.ascending ?? false })
      .range(from, from + pageSize - 1);

    if (options.timestampColumn && options.startAt) {
      query = query.gte(options.timestampColumn, options.startAt);
    }
    if (options.timestampColumn && options.endAt) {
      query = query.lte(options.timestampColumn, options.endAt);
    }
    if (options.postId) {
      query = query.eq("fb_post_id", options.postId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as T[];
    output.push(...rows);
    if (rows.length < pageSize) break;
  }

  return output;
}

async function recalculateFansTable(service: SupabaseClient) {
  const [comments, reactions] = await Promise.all([
    fetchTableInPages<{
      fb_post_id: string | null;
      fb_user_id: string | null;
      user_name: string | null;
      created_time: string | null;
    }>(service, "facebook_post_comments", "fb_post_id,fb_user_id,user_name,created_time", {
      orderBy: "created_time",
      timestampColumn: "created_time",
      maxRows: 150000
    }),
    fetchTableInPages<{
      fb_post_id: string | null;
      fb_user_id: string | null;
      user_name: string | null;
      created_at: string | null;
    }>(service, "facebook_post_reactions", "fb_post_id,fb_user_id,user_name,created_at", {
      orderBy: "created_at",
      timestampColumn: "created_at",
      maxRows: 150000
    })
  ]);

  const scores = computeFanScores(comments, reactions);
  const nowIso = new Date().toISOString();

  const upsertRows = scores.map((row) => ({
    fb_user_id: row.fb_user_id,
    user_name: row.user_name,
    total_comments: row.total_comments,
    total_reactions: row.total_reactions,
    engagement_score: row.engagement_score,
    posts_interacted_count: row.posts_interacted_count,
    last_interacted_at: row.last_interacted_at,
    updated_at: nowIso
  }));

  if (upsertRows.length > 0) {
    await upsertInBatches(service, "facebook_fans", upsertRows, "fb_user_id");
  }

  return upsertRows.length;
}

export async function connectFacebookPage(service: SupabaseClient) {
  const config = await getMetaConfig();
  assertMetaConfig(config);

  // TODO(meta-app-review): migrar a OAuth server-to-server con token rotatorio por página
  // y cifrado en repositorio seguro (KMS/Vault) cuando se habilite multi-page productivo.
  const profile = await fetchPageProfile(config);
  const scopes = await graphGetDebugScopes(config);
  const nowIso = new Date().toISOString();

  const pageRow = {
    page_id: String(profile.id ?? config.pageId),
    page_name: String(profile.name ?? "Sin Pelos en el Micrófono"),
    connected: true,
    updated_at: nowIso
  };
  const accountRow = {
    page_id: String(profile.id ?? config.pageId),
    // NOTE: no guardamos token real en DB; solo referencia segura al origen.
    access_token: config.pageAccessTokenRef,
    token_expires_at: null,
    permissions: scopes,
    updated_at: nowIso
  };

  const pageRes = await service.from("facebook_pages").upsert(pageRow, { onConflict: "page_id" });
  if (pageRes.error) throw new Error(pageRes.error.message);
  const accountRes = await service.from("facebook_connected_accounts").upsert(accountRow, { onConflict: "page_id" });
  if (accountRes.error) throw new Error(accountRes.error.message);

  return {
    pageId: pageRow.page_id,
    pageName: pageRow.page_name,
    connected: true,
    permissions: scopes
  };
}

export async function syncFacebookFans(service: SupabaseClient, input: SyncInput = {}): Promise<SyncSummary> {
  const config = await getMetaConfig();
  assertMetaConfig(config);

  const maxPosts = Math.max(5, Math.min(100, Number(input.maxPosts ?? 40)));
  const days = Math.max(1, Math.min(180, Number(input.days ?? 30)));

  const now = new Date();
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const nowIso = now.toISOString();
  const sinceIso = since.toISOString();

  const startRunRes = await service
    .from("facebook_sync_runs")
    .insert({
      status: "running",
      started_at: nowIso,
      page_id: null,
      created_at: nowIso,
      updated_at: nowIso
    })
    .select("id")
    .limit(1)
    .maybeSingle();

  if (startRunRes.error) throw new Error(startRunRes.error.message);
  const syncRunId = String(startRunRes.data?.id ?? "").trim();
  if (!syncRunId) throw new Error("No se pudo crear sync run.");

  try {
    const profile = await fetchPageProfile(config);
    await connectFacebookPage(service);

    const posts = await fetchPostsForSync(config, sinceIso, nowIso, maxPosts);
    const postRows: Record<string, any>[] = [];
    const commentRows: Record<string, any>[] = [];
    const reactionRows: Record<string, any>[] = [];

    for (const post of posts) {
      const postId = String(post?.id ?? "").trim();
      if (!postId) continue;

      const comments = await fetchCommentsForPost(config, postId).catch(() => [] as FacebookCommentGraph[]);
      const reactions = await fetchReactionsForPost(config, postId).catch(() => [] as FacebookReactionGraph[]);

      postRows.push({
        page_id: config.pageId,
        fb_post_id: postId,
        message: String(post?.message ?? "").trim() || null,
        permalink_url: String(post?.permalink_url ?? "").trim() || null,
        created_time: toIsoOrNull(String(post?.created_time ?? "")),
        comment_count: comments.length || Number(post?.comments?.summary?.total_count ?? 0) || 0,
        reaction_count: reactions.length || Number(post?.reactions?.summary?.total_count ?? 0) || 0,
        raw: post,
        updated_at: nowIso
      });

      for (const comment of comments) {
        const commentId = String(comment?.id ?? "").trim();
        if (!commentId) continue;
        commentRows.push({
          fb_comment_id: commentId,
          fb_post_id: postId,
          fb_user_id: String(comment?.from?.id ?? "").trim() || null,
          user_name: String(comment?.from?.name ?? "").trim() || null,
          message: String(comment?.message ?? "").trim() || null,
          created_time: toIsoOrNull(String(comment?.created_time ?? "")),
          raw: comment
        });
      }

      for (const reaction of reactions) {
        const fanId = String(reaction?.id ?? "").trim();
        if (!fanId) continue;
        reactionRows.push({
          fb_post_id: postId,
          fb_user_id: fanId,
          user_name: String(reaction?.name ?? "").trim() || null,
          reaction_type: String(reaction?.type ?? "").trim() || "UNKNOWN",
          created_at: toIsoOrNull(String(reaction?.created_time ?? "")) ?? nowIso,
          raw: reaction
        });
      }
    }

    await upsertInBatches(service, "facebook_posts", postRows, "fb_post_id");
    await upsertInBatches(service, "facebook_post_comments", commentRows, "fb_comment_id");
    await upsertInBatches(service, "facebook_post_reactions", reactionRows, "fb_post_id,fb_user_id,reaction_type");

    const fansUpdated = await recalculateFansTable(service);

    const finishRes = await service
      .from("facebook_sync_runs")
      .update({
        page_id: config.pageId,
        status: "done",
        finished_at: new Date().toISOString(),
        posts_synced: postRows.length,
        comments_synced: commentRows.length,
        reactions_synced: reactionRows.length,
        fans_updated: fansUpdated,
        error_log: null,
        updated_at: new Date().toISOString()
      })
      .eq("id", syncRunId);
    if (finishRes.error) throw new Error(finishRes.error.message);

    return {
      pageId: config.pageId,
      pageName: String(profile?.name ?? "Sin Pelos en el Micrófono"),
      postsSynced: postRows.length,
      commentsSynced: commentRows.length,
      reactionsSynced: reactionRows.length,
      fansUpdated,
      syncRunId
    };
  } catch (e: any) {
    await service
      .from("facebook_sync_runs")
      .update({
        page_id: config.pageId,
        status: "error",
        finished_at: new Date().toISOString(),
        error_log: String(e?.message ?? "Unknown error"),
        updated_at: new Date().toISOString()
      })
      .eq("id", syncRunId);
    throw e;
  }
}

export async function getFacebookFansOverview(service: SupabaseClient, input: OverviewInput = {}) {
  const range = resolveRange({ range: input.range, start: input.start, end: input.end });
  const startIso = range.startAt.toISOString();
  const endIso = range.endAt.toISOString();
  const postId = String(input.postId ?? "").trim() || null;

  let postsCountQuery = service.from("facebook_posts").select("id", { count: "exact", head: true });
  postsCountQuery = postsCountQuery.gte("created_time", startIso).lte("created_time", endIso);
  if (postId) postsCountQuery = postsCountQuery.eq("fb_post_id", postId);

  const [pageRes, accountRes, lastSyncRes, comments, reactions, postOptionsRes, postsCountRes] = await Promise.all([
    service.from("facebook_pages").select("page_id,page_name,connected,updated_at").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    service
      .from("facebook_connected_accounts")
      .select("page_id,token_expires_at,permissions,updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    service.from("facebook_sync_runs").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    fetchTableInPages<{
      fb_comment_id: string;
      fb_post_id: string | null;
      fb_user_id: string | null;
      user_name: string | null;
      message: string | null;
      created_time: string | null;
    }>(service, "facebook_post_comments", "fb_comment_id,fb_post_id,fb_user_id,user_name,message,created_time", {
      orderBy: "created_time",
      timestampColumn: "created_time",
      startAt: startIso,
      endAt: endIso,
      postId,
      maxRows: 50000
    }),
    fetchTableInPages<{
      fb_post_id: string | null;
      fb_user_id: string | null;
      user_name: string | null;
      reaction_type: string | null;
      created_at: string | null;
    }>(service, "facebook_post_reactions", "fb_post_id,fb_user_id,user_name,reaction_type,created_at", {
      orderBy: "created_at",
      timestampColumn: "created_at",
      startAt: startIso,
      endAt: endIso,
      postId,
      maxRows: 100000
    }),
    service
      .from("facebook_posts")
      .select("fb_post_id,message,permalink_url,created_time,comment_count,reaction_count")
      .order("created_time", { ascending: false })
      .limit(200),
    postsCountQuery
  ]);

  if (pageRes.error) throw new Error(pageRes.error.message);
  if (accountRes.error) throw new Error(accountRes.error.message);
  if (lastSyncRes.error) throw new Error(lastSyncRes.error.message);
  if (postOptionsRes.error) throw new Error(postOptionsRes.error.message);
  if (postsCountRes.error) throw new Error(postsCountRes.error.message);

  const interactionPostIds = new Set<string>();
  for (const row of comments) {
    if (row.fb_post_id) interactionPostIds.add(String(row.fb_post_id));
  }
  for (const row of reactions) {
    if (row.fb_post_id) interactionPostIds.add(String(row.fb_post_id));
  }
  if (postId) interactionPostIds.add(postId);

  let postDetails = [] as Array<{
    fb_post_id: string;
    message: string | null;
    permalink_url: string | null;
    created_time: string | null;
    comment_count: number | null;
    reaction_count: number | null;
  }>;
  if (interactionPostIds.size > 0) {
    const ids = Array.from(interactionPostIds);
    for (const chunk of chunkArray(ids, 100)) {
      const { data, error } = await service
        .from("facebook_posts")
        .select("fb_post_id,message,permalink_url,created_time,comment_count,reaction_count")
        .in("fb_post_id", chunk);
      if (error) throw new Error(error.message);
      postDetails.push(...(data ?? []));
    }
  }

  const fans = computeFanScores(
    comments.map((row) => ({
      fb_post_id: row.fb_post_id,
      fb_user_id: row.fb_user_id,
      user_name: row.user_name,
      created_time: row.created_time
    })),
    reactions.map((row) => ({
      fb_post_id: row.fb_post_id,
      fb_user_id: row.fb_user_id,
      user_name: row.user_name,
      created_at: row.created_at
    }))
  );

  const topFans = fans.slice(0, 200);
  const superFans = topFans.slice(0, 10);

  const postsMap = new Map<string, { comments: number; reactions: number }>();
  for (const row of comments) {
    const key = String(row.fb_post_id ?? "").trim();
    if (!key) continue;
    const current = postsMap.get(key) ?? { comments: 0, reactions: 0 };
    current.comments += 1;
    postsMap.set(key, current);
  }
  for (const row of reactions) {
    const key = String(row.fb_post_id ?? "").trim();
    if (!key) continue;
    const current = postsMap.get(key) ?? { comments: 0, reactions: 0 };
    current.reactions += 1;
    postsMap.set(key, current);
  }

  const postById = new Map(postDetails.map((post) => [post.fb_post_id, post]));
  const topPosts = Array.from(postsMap.entries())
    .map(([fbPostId, metrics]) => {
      const details = postById.get(fbPostId);
      const engagementScore = metrics.comments * 5 + metrics.reactions;
      return {
        fb_post_id: fbPostId,
        message: details?.message ?? null,
        permalink_url: details?.permalink_url ?? null,
        created_time: details?.created_time ?? null,
        comments: metrics.comments,
        reactions: metrics.reactions,
        engagement_score: engagementScore
      };
    })
    .sort((a, b) => {
      if (b.engagement_score !== a.engagement_score) return b.engagement_score - a.engagement_score;
      if (b.comments !== a.comments) return b.comments - a.comments;
      return b.reactions - a.reactions;
    })
    .slice(0, 50);

  const weeklyMap = new Map<string, { comments: number; reactions: number; score: number }>();
  for (const row of comments) {
    const week = bucketWeekKey(toIsoOrNull(row.created_time));
    if (week === "unknown") continue;
    const current = weeklyMap.get(week) ?? { comments: 0, reactions: 0, score: 0 };
    current.comments += 1;
    current.score += 5;
    weeklyMap.set(week, current);
  }
  for (const row of reactions) {
    const week = bucketWeekKey(toIsoOrNull(row.created_at));
    if (week === "unknown") continue;
    const current = weeklyMap.get(week) ?? { comments: 0, reactions: 0, score: 0 };
    current.reactions += 1;
    current.score += 1;
    weeklyMap.set(week, current);
  }
  const weeklyTrend = Array.from(weeklyMap.entries())
    .map(([week_start, values]) => ({ week_start, ...values }))
    .sort((a, b) => (a.week_start < b.week_start ? -1 : 1));

  const recentComments = comments
    .sort((a, b) => new Date(b.created_time ?? 0).getTime() - new Date(a.created_time ?? 0).getTime())
    .slice(0, 120);

  const postOptions = ((postOptionsRes.data ?? []) as Array<{
    fb_post_id: string;
    message: string | null;
    permalink_url: string | null;
    created_time: string | null;
    comment_count: number | null;
    reaction_count: number | null;
  }>).map((post) => ({
    fb_post_id: post.fb_post_id,
    created_time: post.created_time,
    message: post.message,
    label:
      String(post.message ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 90) || `Post ${post.fb_post_id.slice(0, 16)}`
  }));

  return {
    connection: {
      connected: Boolean(pageRes.data?.connected),
      page_id: pageRes.data?.page_id ?? null,
      page_name: pageRes.data?.page_name ?? null,
      page_updated_at: pageRes.data?.updated_at ?? null,
      token_expires_at: accountRes.data?.token_expires_at ?? null,
      permissions: Array.isArray(accountRes.data?.permissions) ? accountRes.data?.permissions : []
    },
    last_sync: lastSyncRes.data ?? null,
    range: {
      key: range.key,
      start: startIso,
      end: endIso,
      post_id: postId
    },
    kpis: {
      total_posts_synced: Number(postsCountRes.count ?? 0),
      total_comments_recolected: comments.length,
      total_reactions_recolected: reactions.length,
      total_fans_unique: fans.length
    },
    top_superfans: superFans,
    top_fans: topFans,
    recent_comments: recentComments,
    active_posts: topPosts,
    weekly_trend: weeklyTrend,
    post_options: postOptions
  };
}

export function buildFansCsv(rows: FanScoreRow[]) {
  const header = [
    "user_name",
    "fb_user_id",
    "total_comments",
    "total_reactions",
    "posts_interacted_count",
    "engagement_score",
    "last_interacted_at"
  ];

  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        escapeCsvValue(row.user_name ?? ""),
        escapeCsvValue(row.fb_user_id),
        escapeCsvValue(row.total_comments),
        escapeCsvValue(row.total_reactions),
        escapeCsvValue(row.posts_interacted_count),
        escapeCsvValue(row.engagement_score),
        escapeCsvValue(row.last_interacted_at ?? "")
      ].join(",")
    );
  }
  return lines.join("\n");
}
