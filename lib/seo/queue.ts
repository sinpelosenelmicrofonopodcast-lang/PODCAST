import { canonicalUrl } from "@/lib/seo/constants";
import { submitGscSitemap } from "@/lib/seo/gsc";
import { supabaseService } from "@/lib/supabaseService";

export type SeoQueueType = "post" | "episode" | "clip" | "event" | "page";
export type SeoQueueStatus = "pending" | "submitted" | "error" | "skipped";

type SeoQueueRow = {
  id: string;
  url: string;
  type: SeoQueueType;
  status: SeoQueueStatus;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

function sitemapForType(type: SeoQueueType) {
  if (type === "post") return canonicalUrl("/sitemaps/posts.xml");
  if (type === "episode") return canonicalUrl("/sitemaps/episodes.xml");
  if (type === "event") return canonicalUrl("/sitemaps/events.xml");
  if (type === "clip") return canonicalUrl("/sitemaps/pages.xml");
  return canonicalUrl("/sitemaps/pages.xml");
}

export async function enqueueSeoUrl(url: string, type: SeoQueueType = "page") {
  const service = supabaseService();
  const canonical = canonicalUrl(url);
  const existing = await service
    .from("seo_queue")
    .select("id, status")
    .eq("url", canonical)
    .limit(1)
    .maybeSingle();

  if (existing.data?.id) {
    await service
      .from("seo_queue")
      .update({
        type,
        status: "pending",
        last_error: null,
        updated_at: new Date().toISOString()
      })
      .eq("id", existing.data.id);
    return { ok: true as const, id: existing.data.id, status: "pending" as SeoQueueStatus, updated: true };
  }

  const inserted = await service
    .from("seo_queue")
    .insert({ url: canonical, type, status: "pending" })
    .select("id")
    .limit(1)
    .maybeSingle();
  if (inserted.error) throw new Error(inserted.error.message);
  return { ok: true as const, id: String(inserted.data?.id ?? ""), status: "pending" as SeoQueueStatus, updated: false };
}

function shouldRetry(row: SeoQueueRow) {
  if (row.status === "pending") return true;
  if (row.status !== "error") return false;
  const attempts = Math.max(1, Number(row.attempts ?? 0));
  const backoffMinutes = Math.min(60, Math.pow(2, Math.min(6, attempts)));
  const updated = new Date(row.updated_at).getTime();
  if (!Number.isFinite(updated)) return true;
  return Date.now() - updated >= backoffMinutes * 60 * 1000;
}

async function isUrlInSitemap(sitemapUrl: string, targetUrl: string) {
  const res = await fetch(sitemapUrl, { cache: "no-store" });
  if (!res.ok) return false;
  const xml = await res.text();
  return xml.includes(targetUrl);
}

export async function processSeoQueue(limit = 50) {
  const service = supabaseService();
  const query = await service
    .from("seo_queue")
    .select("id, url, type, status, attempts, last_error, created_at, updated_at")
    .in("status", ["pending", "error"])
    .order("created_at", { ascending: true })
    .limit(Math.max(limit * 3, limit));

  if (query.error) throw new Error(query.error.message);
  const eligible = ((query.data ?? []) as SeoQueueRow[]).filter(shouldRetry).slice(0, limit);

  let processed = 0;
  let submitted = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of eligible) {
    processed += 1;
    const attempts = Number(row.attempts ?? 0) + 1;
    const sitemapUrl = sitemapForType(row.type);
    try {
      const inSitemap = await isUrlInSitemap(sitemapUrl, row.url);
      if (!inSitemap) {
        await service
          .from("seo_queue")
          .update({
            status: "error",
            attempts,
            last_error: `URL no encontrada en ${sitemapUrl}`,
            updated_at: new Date().toISOString()
          })
          .eq("id", row.id);
        failed += 1;
        continue;
      }

      try {
        await submitGscSitemap(sitemapUrl);
      } catch (e: any) {
        await service
          .from("seo_queue")
          .update({
            status: "error",
            attempts,
            last_error: String(e?.message ?? "No se pudo enviar sitemap a GSC."),
            updated_at: new Date().toISOString()
          })
          .eq("id", row.id);
        failed += 1;
        continue;
      }

      await service
        .from("seo_queue")
        .update({
          status: "submitted",
          attempts,
          last_error: null,
          updated_at: new Date().toISOString()
        })
        .eq("id", row.id);
      submitted += 1;
    } catch (e: any) {
      const message = String(e?.message ?? "Unexpected queue error");
      await service
        .from("seo_queue")
        .update({
          status: message.includes("skip") ? "skipped" : "error",
          attempts,
          last_error: message,
          updated_at: new Date().toISOString()
        })
        .eq("id", row.id);
      if (message.includes("skip")) skipped += 1;
      else failed += 1;
    }
  }

  return { ok: true as const, processed, submitted, failed, skipped };
}

export async function seoQueueStats() {
  const service = supabaseService();
  const [pending, error, submitted] = await Promise.all([
    service.from("seo_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
    service.from("seo_queue").select("id", { count: "exact", head: true }).eq("status", "error"),
    service.from("seo_queue").select("id", { count: "exact", head: true }).eq("status", "submitted")
  ]);
  return {
    pending: Number(pending.count ?? 0),
    error: Number(error.count ?? 0),
    submitted: Number(submitted.count ?? 0)
  };
}

