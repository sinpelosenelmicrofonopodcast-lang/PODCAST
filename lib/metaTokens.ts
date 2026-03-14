type MetaTokenCandidate = {
  label: string;
  token: string;
};

type MetaFetchJsonResult<T = any> = {
  res: Response;
  json: T;
};

type CachedPageToken = {
  token: string;
  source: string;
  resolvedAt: number;
};

export class MetaGraphError extends Error {
  status?: number;
  code?: number;
  subcode?: number;
  fbtraceId?: string;

  constructor(message: string, input: { status?: number; code?: number; subcode?: number; fbtraceId?: string } = {}) {
    super(message);
    this.name = "MetaGraphError";
    this.status = input.status;
    this.code = input.code;
    this.subcode = input.subcode;
    this.fbtraceId = input.fbtraceId;
  }
}

const PAGE_TOKEN_CACHE_TTL_MS = 30 * 60 * 1000;
const pageTokenCache = new Map<string, CachedPageToken>();

function readToken(label: string, value: string | undefined | null) {
  const token = String(value ?? "").trim();
  if (!token) return null;
  return { label, token };
}

function uniqueCandidates(input: Array<MetaTokenCandidate | null>) {
  const seen = new Set<string>();
  const out: MetaTokenCandidate[] = [];

  for (const row of input) {
    if (!row?.token || seen.has(row.token)) continue;
    seen.add(row.token);
    out.push(row);
  }

  return out;
}

export function getMetaRuntimeConfig() {
  return {
    pageId: String(process.env.FACEBOOK_PAGE_ID ?? process.env.META_PAGE_ID ?? "").trim(),
    graphVersion: String(process.env.FACEBOOK_GRAPH_VERSION ?? process.env.META_GRAPH_VERSION ?? "v24.0").trim() || "v24.0"
  };
}

export function getDirectPageTokenCandidates() {
  return uniqueCandidates([
    readToken("FACEBOOK_PAGE_ACCESS_TOKEN", process.env.FACEBOOK_PAGE_ACCESS_TOKEN),
    readToken("META_PAGE_ACCESS_TOKEN", process.env.META_PAGE_ACCESS_TOKEN),
    readToken("IG_ACCESS_TOKEN", process.env.IG_ACCESS_TOKEN)
  ]);
}

export function getRootMetaTokenCandidates() {
  return uniqueCandidates([
    readToken("META_USER_ACCESS_TOKEN", process.env.META_USER_ACCESS_TOKEN),
    readToken("META_LONG_LIVED_USER_ACCESS_TOKEN", process.env.META_LONG_LIVED_USER_ACCESS_TOKEN),
    readToken("FACEBOOK_USER_ACCESS_TOKEN", process.env.FACEBOOK_USER_ACCESS_TOKEN),
    readToken("META_SYSTEM_USER_ACCESS_TOKEN", process.env.META_SYSTEM_USER_ACCESS_TOKEN),
    readToken("META_FALLBACK_USER_ACCESS_TOKEN", process.env.META_FALLBACK_USER_ACCESS_TOKEN),
    readToken("FACEBOOK_PAGE_ACCESS_TOKEN", process.env.FACEBOOK_PAGE_ACCESS_TOKEN),
    readToken("META_PAGE_ACCESS_TOKEN", process.env.META_PAGE_ACCESS_TOKEN),
    readToken("IG_ACCESS_TOKEN", process.env.IG_ACCESS_TOKEN)
  ]);
}

export function getInstagramTokenCandidates() {
  return uniqueCandidates([
    readToken("IG_ACCESS_TOKEN", process.env.IG_ACCESS_TOKEN),
    readToken("META_PAGE_ACCESS_TOKEN", process.env.META_PAGE_ACCESS_TOKEN),
    readToken("FACEBOOK_PAGE_ACCESS_TOKEN", process.env.FACEBOOK_PAGE_ACCESS_TOKEN)
  ]);
}

export function buildMetaError(error?: { message?: string; code?: number; error_subcode?: number; fbtrace_id?: string } | null, status?: number) {
  const base = String(error?.message ?? `Meta API HTTP ${status ?? 500}`);
  const code = Number(error?.code ?? 0);
  const subcode = Number(error?.error_subcode ?? 0);
  const trace = String(error?.fbtrace_id ?? "").trim();
  const suffix = [
    code ? `code ${code}` : "",
    subcode ? `subcode ${subcode}` : "",
    trace ? `trace ${trace}` : ""
  ]
    .filter(Boolean)
    .join(" · ");
  return suffix ? `${base} (${suffix})` : base;
}

export function isMetaAuthError(error: unknown) {
  const code = Number((error as any)?.code ?? 0);
  const subcode = Number((error as any)?.subcode ?? 0);
  const status = Number((error as any)?.status ?? 0);
  const message = String((error as any)?.message ?? error ?? "").toLowerCase();

  if (code === 190 || code === 200) return true;
  if (subcode === 463 || subcode === 467) return true;
  if (status === 401 || status === 403) return true;

  return (
    message.includes("page access token is required") ||
    message.includes("requires both pages_read_engagement and pages_manage_posts") ||
    message.includes("invalid oauth access token") ||
    message.includes("session has expired") ||
    message.includes("access token has expired") ||
    message.includes("error validating access token") ||
    message.includes("permissions error") ||
    message.includes("permissions for this operation") ||
    message.includes("missing permission")
  );
}

export async function metaFetchJson<T = any>(url: string, init?: RequestInit): Promise<MetaFetchJsonResult<T>> {
  const res = await fetch(url, { cache: "no-store", ...(init ?? {}) });
  const json = await res.json().catch(() => ({} as T));

  if (!res.ok) {
    throw new MetaGraphError(buildMetaError((json as any)?.error ?? null, res.status), {
      status: res.status,
      code: Number((json as any)?.error?.code ?? 0) || undefined,
      subcode: Number((json as any)?.error?.error_subcode ?? 0) || undefined,
      fbtraceId: String((json as any)?.error?.fbtrace_id ?? "").trim() || undefined
    });
  }

  return { res, json };
}

async function resolvePageTokenViaAccounts(input: {
  rootToken: MetaTokenCandidate;
  pageId: string;
  graphVersion: string;
}) {
  const url = new URL(`https://graph.facebook.com/${input.graphVersion}/me/accounts`);
  url.searchParams.set("access_token", input.rootToken.token);
  url.searchParams.set("fields", "id,access_token,name");

  const { json } = await metaFetchJson<{ data?: Array<{ id?: string; access_token?: string }> }>(url.toString(), { method: "GET" });
  const rows = Array.isArray(json?.data) ? json.data : [];
  const match = rows.find((row) => String(row?.id ?? "").trim() === input.pageId);
  const token = String(match?.access_token ?? "").trim();
  if (!token) throw new Error("No se encontró access_token de la página en /me/accounts.");

  return {
    token,
    source: `${input.rootToken.label}:me/accounts`
  };
}

async function resolvePageTokenViaPageLookup(input: {
  rootToken: MetaTokenCandidate;
  pageId: string;
  graphVersion: string;
}) {
  const url = new URL(`https://graph.facebook.com/${input.graphVersion}/${encodeURIComponent(input.pageId)}`);
  url.searchParams.set("access_token", input.rootToken.token);
  url.searchParams.set("fields", "id,access_token,name");

  const { json } = await metaFetchJson<{ id?: string; access_token?: string }>(url.toString(), { method: "GET" });
  const token = String(json?.access_token ?? "").trim();
  if (!token) throw new Error("Meta no devolvió access_token al consultar la página.");

  return {
    token,
    source: `${input.rootToken.label}:page_lookup`
  };
}

export async function resolvePageAccessToken(input: { forceRefresh?: boolean } = {}) {
  const { pageId, graphVersion } = getMetaRuntimeConfig();
  if (!pageId) {
    throw new Error("Falta FACEBOOK_PAGE_ID/META_PAGE_ID en servidor.");
  }

  const cached = pageTokenCache.get(pageId);
  if (!input.forceRefresh && cached && Date.now() - cached.resolvedAt < PAGE_TOKEN_CACHE_TTL_MS) {
    return {
      pageId,
      graphVersion,
      accessToken: cached.token,
      source: cached.source
    };
  }

  const rootTokens = getRootMetaTokenCandidates();
  for (const rootToken of rootTokens) {
    const strategies = [resolvePageTokenViaAccounts, resolvePageTokenViaPageLookup];
    for (const strategy of strategies) {
      try {
        const resolved = await strategy({ rootToken, pageId, graphVersion });
        pageTokenCache.set(pageId, {
          token: resolved.token,
          source: resolved.source,
          resolvedAt: Date.now()
        });
        return {
          pageId,
          graphVersion,
          accessToken: resolved.token,
          source: resolved.source
        };
      } catch {
        // Try next strategy/candidate.
      }
    }
  }

  const direct = getDirectPageTokenCandidates()[0];
  if (direct) {
    return {
      pageId,
      graphVersion,
      accessToken: direct.token,
      source: direct.label
    };
  }

  throw new Error(
    "Faltan tokens Meta. Define META_PAGE_ACCESS_TOKEN o un token raíz como META_LONG_LIVED_USER_ACCESS_TOKEN / META_SYSTEM_USER_ACCESS_TOKEN."
  );
}

export async function resolveInstagramAccessToken(input: { forceRefresh?: boolean } = {}) {
  const direct = getInstagramTokenCandidates()[0];
  if (!input.forceRefresh && direct) {
    return {
      accessToken: direct.token,
      source: direct.label
    };
  }

  try {
    const resolved = await resolvePageAccessToken(input);
    return {
      accessToken: resolved.accessToken,
      source: resolved.source
    };
  } catch {
    if (direct) {
      return {
        accessToken: direct.token,
        source: direct.label
      };
    }
    throw new Error(
      "Falta IG_ACCESS_TOKEN/META_PAGE_ACCESS_TOKEN y no se pudo regenerar desde un token raíz Meta."
    );
  }
}

export function clearMetaTokenCache(pageId?: string) {
  if (pageId) {
    pageTokenCache.delete(pageId);
    return;
  }
  pageTokenCache.clear();
}
