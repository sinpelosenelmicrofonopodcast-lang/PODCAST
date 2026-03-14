import { supabase } from "@/lib/supabaseClient";

export type AuthApiResult<T = any> = {
  response: Response;
  json: T;
  ok: boolean;
};

type AuthJsonFetchOptions = Omit<RequestInit, "body" | "headers"> & {
  body?: BodyInit | null;
  headers?: HeadersInit;
  jsonBody?: unknown;
};

export async function getClientAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

export async function authFetch(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  const token = await getClientAccessToken();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers
  });
}

export async function authJsonFetch<T = any>(input: RequestInfo | URL, init?: AuthJsonFetchOptions) {
  const headers = new Headers(init?.headers);
  let body = init?.body;

  if (init && "jsonBody" in init && init.jsonBody !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.jsonBody);
  }

  const response = await authFetch(input, {
    ...init,
    headers,
    body
  });

  const json = (await response.json().catch(() => ({}))) as T;

  return { response, json };
}

export async function authApiRequest<T = any>(input: RequestInfo | URL, init?: AuthJsonFetchOptions): Promise<AuthApiResult<T>> {
  const { response, json } = await authJsonFetch<T>(input, init);
  const ok = response.ok && (!(json && typeof json === "object" && "ok" in (json as Record<string, unknown>)) || (json as any).ok !== false);
  return { response, json, ok };
}
