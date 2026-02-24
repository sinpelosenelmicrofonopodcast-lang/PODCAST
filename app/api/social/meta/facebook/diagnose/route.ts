import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/adminAuth";

type GraphOk<T = any> = { ok: true; data: T };
type GraphFail = { ok: false; error: string; status?: number; code?: number; subcode?: number; fbtrace_id?: string };

function maskToken(token: string) {
  if (!token) return "";
  if (token.length <= 12) return `${token.slice(0, 3)}***`;
  return `${token.slice(0, 8)}...${token.slice(-6)}`;
}

async function graphGet(path: string, accessToken: string, graphVersion: string, params?: Record<string, string>): Promise<GraphOk | GraphFail> {
  const url = new URL(`https://graph.facebook.com/${graphVersion}${path}`);
  url.searchParams.set("access_token", accessToken);
  for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v);

  try {
    const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
    const json = await res.json().catch(() => ({} as any));
    if (!res.ok) {
      return {
        ok: false,
        error: json?.error?.message ?? "Meta API error",
        status: res.status,
        code: json?.error?.code,
        subcode: json?.error?.error_subcode,
        fbtrace_id: json?.error?.fbtrace_id
      };
    }
    return { ok: true, data: json };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Network error" };
  }
}

async function graphPost(path: string, accessToken: string, graphVersion: string, body: URLSearchParams): Promise<GraphOk | GraphFail> {
  body.set("access_token", accessToken);
  const url = `https://graph.facebook.com/${graphVersion}${path}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      cache: "no-store"
    });
    const json = await res.json().catch(() => ({} as any));
    if (!res.ok) {
      return {
        ok: false,
        error: json?.error?.message ?? "Meta API error",
        status: res.status,
        code: json?.error?.code,
        subcode: json?.error?.error_subcode,
        fbtrace_id: json?.error?.fbtrace_id
      };
    }
    return { ok: true, data: json };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Network error" };
  }
}

async function graphDelete(path: string, accessToken: string, graphVersion: string): Promise<GraphOk | GraphFail> {
  const url = new URL(`https://graph.facebook.com/${graphVersion}${path}`);
  url.searchParams.set("access_token", accessToken);
  try {
    const res = await fetch(url.toString(), { method: "DELETE", cache: "no-store" });
    const json = await res.json().catch(() => ({} as any));
    if (!res.ok) {
      return {
        ok: false,
        error: json?.error?.message ?? "Meta API error",
        status: res.status,
        code: json?.error?.code,
        subcode: json?.error?.error_subcode,
        fbtrace_id: json?.error?.fbtrace_id
      };
    }
    return { ok: true, data: json };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Network error" };
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const pageId = String(process.env.META_PAGE_ID ?? "").trim();
  const pageAccessToken = String(process.env.META_PAGE_ACCESS_TOKEN ?? "").trim();
  const graphVersion = String(process.env.META_GRAPH_VERSION ?? "v24.0").trim();
  const appId = String(process.env.META_APP_ID ?? "").trim();
  const appSecret = String(process.env.META_APP_SECRET ?? "").trim();
  const probePost = request.nextUrl.searchParams.get("probePost") === "1";

  const response: any = {
    ok: true,
    env: {
      graphVersion,
      hasPageId: Boolean(pageId),
      hasPageAccessToken: Boolean(pageAccessToken),
      pageId,
      pageTokenMasked: maskToken(pageAccessToken),
      hasAppId: Boolean(appId),
      hasAppSecret: Boolean(appSecret)
    },
    checks: {}
  };

  if (!pageId || !pageAccessToken) {
    response.ok = false;
    response.error = "Faltan META_PAGE_ID o META_PAGE_ACCESS_TOKEN en el servidor.";
    return NextResponse.json(response, { status: 400 });
  }

  response.checks.pageProfile = await graphGet(`/${encodeURIComponent(pageId)}`, pageAccessToken, graphVersion, {
    fields: "id,name,link"
  });

  response.checks.readFeed = await graphGet(`/${encodeURIComponent(pageId)}/feed`, pageAccessToken, graphVersion, {
    limit: "1",
    fields: "id,created_time"
  });

  if (appId && appSecret) {
    const appToken = `${appId}|${appSecret}`;
    response.checks.debugToken = await graphGet("/debug_token", appToken, graphVersion, {
      input_token: pageAccessToken
    });
  } else {
    response.checks.debugToken = {
      ok: false,
      error: "No se ejecutó debug_token porque faltan META_APP_ID/META_APP_SECRET."
    };
  }

  if (probePost) {
    const postBody = new URLSearchParams();
    postBody.set("message", `[DIAG] ${new Date().toISOString()} - prueba permisos pages_manage_posts`);
    postBody.set("published", "false");
    const created = await graphPost(`/${encodeURIComponent(pageId)}/feed`, pageAccessToken, graphVersion, postBody);
    response.checks.postProbe = created;

    if (created.ok && created.data?.id) {
      response.checks.postProbeCleanup = await graphDelete(`/${encodeURIComponent(String(created.data.id))}`, pageAccessToken, graphVersion);
    }
  } else {
    response.checks.postProbe = {
      ok: false,
      error: "Saltado. Usa ?probePost=1 para probar publicación y cleanup automático."
    };
  }

  return NextResponse.json(response);
}

