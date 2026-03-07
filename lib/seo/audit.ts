import { PUBLIC_CORE_PAGES, canonicalUrl } from "@/lib/seo/constants";
import { getPublishedEpisodes, getPublishedEvents, getPublishedPosts } from "@/lib/seo/content";
import { supabaseService } from "@/lib/supabaseService";

type AuditIssueType =
  | "missing_title"
  | "missing_description"
  | "missing_og"
  | "missing_schema"
  | "broken_canonical"
  | "soft_404"
  | "blocked_by_robots"
  | "accidental_noindex";

type AuditIssue = {
  url: string;
  issueType: AuditIssueType;
  details: Record<string, any>;
};

function strip(pathOrUrl: string) {
  try {
    const u = new URL(pathOrUrl);
    return u.pathname;
  } catch {
    return pathOrUrl;
  }
}

function hasTag(html: string, pattern: RegExp) {
  return pattern.test(html);
}

async function collectPublicUrls() {
  const [posts, episodes, events] = await Promise.all([
    getPublishedPosts(300),
    getPublishedEpisodes(200),
    getPublishedEvents(200)
  ]);
  const urls = new Set<string>();
  PUBLIC_CORE_PAGES.forEach((path) => urls.add(canonicalUrl(path)));
  posts.forEach((row) => urls.add(canonicalUrl(`/noticias/${encodeURIComponent(row.slug)}`)));
  episodes.forEach((row) => urls.add(canonicalUrl(`/podcast/${encodeURIComponent(row.slug)}`)));
  events.forEach((row) => urls.add(canonicalUrl(`/eventos/${encodeURIComponent(row.slug)}`)));
  return Array.from(urls);
}

function disallowedByRobots(pathname: string, robotsText: string) {
  const lines = robotsText.split("\n").map((line) => line.trim().toLowerCase());
  const disallows = lines
    .filter((line) => line.startsWith("disallow:"))
    .map((line) => line.replace("disallow:", "").trim())
    .filter(Boolean);
  const path = String(pathname || "/").toLowerCase();
  return disallows.some((rule) => path === rule || path.startsWith(`${rule}/`));
}

function auditHtml(url: string, status: number, html: string, xRobots: string, robotsText: string): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const pathname = strip(url);

  if (status >= 400) {
    issues.push({
      url,
      issueType: "soft_404",
      details: { status }
    });
    return issues;
  }

  if (disallowedByRobots(pathname, robotsText)) {
    issues.push({
      url,
      issueType: "blocked_by_robots",
      details: { pathname }
    });
  }

  if (!hasTag(html, /<title>[^<]+<\/title>/i)) {
    issues.push({ url, issueType: "missing_title", details: {} });
  }

  if (!hasTag(html, /<meta\s+name=["']description["'][^>]*content=["'][^"']+/i)) {
    issues.push({ url, issueType: "missing_description", details: {} });
  }

  const hasOgTitle = hasTag(html, /property=["']og:title["']/i);
  const hasOgDesc = hasTag(html, /property=["']og:description["']/i);
  const hasOgImage = hasTag(html, /property=["']og:image["']/i);
  if (!hasOgTitle || !hasOgDesc || !hasOgImage) {
    issues.push({
      url,
      issueType: "missing_og",
      details: { hasOgTitle, hasOgDesc, hasOgImage }
    });
  }

  if (!hasTag(html, /<script[^>]*type=["']application\/ld\+json["']/i)) {
    issues.push({ url, issueType: "missing_schema", details: {} });
  }

  const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  if (!canonicalMatch?.[1]) {
    issues.push({ url, issueType: "broken_canonical", details: { reason: "missing" } });
  } else {
    try {
      const canonical = new URL(canonicalMatch[1]);
      const expected = new URL(canonicalUrl(pathname));
      if (canonical.host !== expected.host || canonical.protocol !== "https:") {
        issues.push({
          url,
          issueType: "broken_canonical",
          details: { canonical: canonical.toString(), expectedHost: expected.host }
        });
      }
    } catch {
      issues.push({ url, issueType: "broken_canonical", details: { reason: "invalid_url" } });
    }
  }

  const robotsNoindexMeta = /<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html);
  const robotsNoindexHeader = String(xRobots || "").toLowerCase().includes("noindex");
  if (robotsNoindexMeta || robotsNoindexHeader) {
    issues.push({
      url,
      issueType: "accidental_noindex",
      details: { robotsNoindexMeta, robotsNoindexHeader }
    });
  }

  return issues;
}

export async function runSeoAudit(limit = 200) {
  const service = supabaseService();
  const urls = (await collectPublicUrls()).slice(0, limit);
  const robotsRes = await fetch(canonicalUrl("/robots.txt"), { cache: "no-store" });
  const robotsText = robotsRes.ok ? await robotsRes.text() : "";

  const issues: AuditIssue[] = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store", redirect: "manual" });
      const html = await res.text();
      const pageIssues = auditHtml(url, res.status, html, res.headers.get("x-robots-tag") ?? "", robotsText);
      issues.push(...pageIssues);
    } catch (e: any) {
      issues.push({
        url,
        issueType: "soft_404",
        details: { error: String(e?.message ?? "fetch_failed") }
      });
    }
  }

  if (issues.length > 0) {
    const rows = issues.map((issue) => ({
      url: issue.url,
      issue_type: issue.issueType,
      details: issue.details
    }));
    const inserted = await service.from("seo_audit").insert(rows);
    if (inserted.error) throw new Error(inserted.error.message);
  }

  return {
    ok: true as const,
    scanned: urls.length,
    issues: issues.length
  };
}

