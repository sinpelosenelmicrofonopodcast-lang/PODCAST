import "server-only";

import { canonicalUrl } from "@/lib/seo/constants";

const ONE_SIGNAL_API_URL = "https://api.onesignal.com/notifications?c=push";
const DEFAULT_ONE_SIGNAL_APP_ID = "1b6cad80-36e8-4a6c-9734-6e6b1abfee80";

type OneSignalServerConfig = {
  appId: string;
  restApiKey: string;
};

export type SendOneSignalPushInput = {
  title: string;
  message: string;
  url?: string | null;
  imageUrl?: string | null;
  category?: string | null;
  segment?: string | null;
  data?: Record<string, unknown>;
};

export type OneSignalSendResult = {
  id: string | null;
  recipients: number;
  errors: string[];
  raw: Record<string, unknown> | null;
};

function extractUuid(value: string) {
  const raw = String(value ?? "").trim();
  const candidates = [raw];
  try {
    candidates.push(decodeURIComponent(raw));
  } catch {
    // Ignore malformed URI pieces.
  }
  for (const candidate of candidates) {
    const match = String(candidate)
      .trim()
      .match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
    if (match) return match[0];
  }
  return "";
}

function cleanText(value: string, maxLen: number) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

function cleanCategory(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_\-]/g, "")
    .slice(0, 32);
}

function resolvePushUrl(rawUrl?: string | null) {
  const value = String(rawUrl ?? "").trim();
  if (!value) return canonicalUrl("/");
  if (value.startsWith("/")) return canonicalUrl(value);

  const parsed = new URL(value);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("URL inválida para notificación.");
  }
  parsed.protocol = "https:";
  return parsed.toString();
}

export function getOneSignalServerConfig(): OneSignalServerConfig {
  const appIdCandidates = [
    String(process.env.ONESIGNAL_APP_ID ?? ""),
    String(process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? ""),
    DEFAULT_ONE_SIGNAL_APP_ID
  ];
  const appId = appIdCandidates.map(extractUuid).find(Boolean) ?? "";
  const restApiKey = String(process.env.ONESIGNAL_REST_API_KEY ?? process.env.ONESIGNAL_API_KEY ?? "")
    .trim()
    .replace(/^['"]|['"]$/g, "");

  if (!appId) {
    throw new Error("ONESIGNAL_APP_ID inválido. Debe ser UUID puro.");
  }
  if (!restApiKey) {
    throw new Error("Falta ONESIGNAL_REST_API_KEY (o ONESIGNAL_API_KEY) en el servidor.");
  }

  return { appId, restApiKey };
}

export async function sendOneSignalPush(input: SendOneSignalPushInput): Promise<OneSignalSendResult> {
  const config = getOneSignalServerConfig();

  const title = cleanText(input.title, 110);
  const message = cleanText(input.message, 500);
  if (!title) throw new Error("title es requerido.");
  if (!message) throw new Error("message es requerido.");

  const category = cleanCategory(String(input.category ?? ""));
  const segment = cleanText(String(input.segment ?? ""), 64) || "Subscribed Users";
  const pushUrl = resolvePushUrl(input.url);

  const payload: Record<string, unknown> = {
    app_id: config.appId,
    target_channel: "push",
    headings: { es: title, en: title },
    contents: { es: message, en: message },
    web_url: pushUrl,
    url: pushUrl,
    ...(input.imageUrl ? { chrome_web_image: String(input.imageUrl).trim() } : {}),
    ...(input.data && Object.keys(input.data).length > 0 ? { data: input.data } : {})
  };

  if (category) {
    payload.filters = [
      { field: "tag", key: `interest_${category}`, relation: "=", value: "1" },
      { operator: "OR" },
      { field: "tag", key: "push_all", relation: "=", value: "1" }
    ];
  } else {
    payload.included_segments = [segment];
  }

  const response = await fetch(ONE_SIGNAL_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Key ${config.restApiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(payload),
    cache: "no-store"
  });

  const json = (await response.json().catch(() => null)) as Record<string, any> | null;
  const errors: string[] = [];
  if (Array.isArray(json?.errors)) {
    for (const entry of json.errors) {
      const text = String(entry ?? "").trim();
      if (text) errors.push(text);
    }
  }

  if (!response.ok) {
    throw new Error(errors[0] ?? `OneSignal respondió ${response.status}.`);
  }

  return {
    id: typeof json?.id === "string" ? json.id : null,
    recipients: Number(json?.recipients ?? 0),
    errors,
    raw: json
  };
}
