import { createSign } from "crypto";
import { CANONICAL_SITE_URL } from "@/lib/seo/constants";

type GscConfig = {
  publicSiteUrl: string;
  siteUrl: string;
  serviceEmail: string;
  privateKey: string;
  sitemapUrl: string;
};

export type GscRow = {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

function base64Url(input: string) {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function readConfig(): GscConfig {
  const publicSiteUrl = String(process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
  const siteUrl = String(process.env.GSC_SITE_URL ?? "").trim();
  const serviceEmail = String(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "").trim();
  const privateKey = String(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? "")
    .replace(/\\n/g, "\n")
    .trim();
  const sitemapUrl = String(process.env.GSC_SITEMAP_URL ?? "").trim();

  if (!publicSiteUrl) throw new Error("Missing NEXT_PUBLIC_SITE_URL.");
  if (publicSiteUrl !== CANONICAL_SITE_URL) {
    throw new Error(`NEXT_PUBLIC_SITE_URL must be ${CANONICAL_SITE_URL}.`);
  }
  if (!siteUrl) throw new Error("Missing GSC_SITE_URL.");
  if (!serviceEmail) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL.");
  if (!privateKey) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.");
  if (!sitemapUrl) throw new Error("Missing GSC_SITEMAP_URL.");

  return { publicSiteUrl, siteUrl, serviceEmail, privateKey, sitemapUrl };
}

async function serviceAccessToken(scopes: string[]) {
  const cfg = readConfig();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: cfg.serviceEmail,
    scope: scopes.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const signature = signer.sign(cfg.privateKey, "base64url");
  const assertion = `${unsigned}.${signature}`;

  const body = new URLSearchParams();
  body.set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer");
  body.set("assertion", assertion);

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store"
  });
  const tokenJson = await tokenRes.json().catch(() => ({} as any));
  if (!tokenRes.ok || !tokenJson?.access_token) {
    throw new Error(String(tokenJson?.error_description ?? tokenJson?.error ?? `OAuth error ${tokenRes.status}`));
  }
  return String(tokenJson.access_token);
}

export async function submitGscSitemap(inputUrl?: string) {
  const cfg = readConfig();
  const sitemapUrl = String(inputUrl ?? cfg.sitemapUrl).trim();
  const token = await serviceAccessToken(["https://www.googleapis.com/auth/webmasters"]);
  const endpoint = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
    cfg.siteUrl
  )}/sitemaps/${encodeURIComponent(sitemapUrl)}`;

  const res = await fetch(endpoint, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`
    },
    cache: "no-store"
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `Sitemap submit failed (${res.status}).`);
  }
  return { ok: true as const, sitemapUrl };
}

function parseRange(range: string) {
  const value = String(range || "28d").trim().toLowerCase();
  if (value === "7d") return 7;
  if (value === "14d") return 14;
  if (value === "28d") return 28;
  if (value === "90d") return 90;
  return 28;
}

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function getGscPerformance(range = "28d") {
  const cfg = readConfig();
  const days = parseRange(range);
  const end = new Date();
  const start = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000);

  const token = await serviceAccessToken(["https://www.googleapis.com/auth/webmasters.readonly"]);
  const endpoint = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(cfg.siteUrl)}/searchAnalytics/query`;

  const payload = {
    startDate: isoDay(start),
    endDate: isoDay(end),
    dimensions: ["page"],
    rowLimit: 250
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    cache: "no-store"
  });
  const json = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    throw new Error(String(json?.error?.message ?? `GSC query failed (${res.status}).`));
  }

  const rows = (json?.rows ?? []) as Array<{
    keys?: string[];
    clicks?: number;
    impressions?: number;
    ctr?: number;
    position?: number;
  }>;

  const normalized: GscRow[] = rows.map((row) => ({
    page: String(row.keys?.[0] ?? ""),
    clicks: Number(row.clicks ?? 0),
    impressions: Number(row.impressions ?? 0),
    ctr: Number(row.ctr ?? 0),
    position: Number(row.position ?? 0)
  }));

  const summary = normalized.reduce(
    (acc, row) => {
      acc.clicks += row.clicks;
      acc.impressions += row.impressions;
      return acc;
    },
    { clicks: 0, impressions: 0 }
  );

  const avgCtr = summary.impressions > 0 ? summary.clicks / summary.impressions : 0;
  const avgPosition =
    normalized.length > 0 ? normalized.reduce((acc, row) => acc + row.position, 0) / normalized.length : 0;

  return {
    range: `${days}d`,
    startDate: isoDay(start),
    endDate: isoDay(end),
    summary: {
      clicks: summary.clicks,
      impressions: summary.impressions,
      ctr: avgCtr,
      position: avgPosition
    },
    rows: normalized
  };
}
