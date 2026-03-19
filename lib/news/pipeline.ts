import type { SupabaseClient } from "@supabase/supabase-js";
import type { IngestSummary, NewsSourceRow } from "@/types/viral";
import { supabaseService } from "@/lib/supabaseService";
import { runSpmNewsIngestionPipeline } from "@/services/newsIngestion";

type IngestOptions = {
  sourceLimit?: number;
  perSourceLimit?: number;
  timeoutMs?: number;
  rankedLimit?: number;
};

function baseSourceQuery(service: SupabaseClient) {
  return service
    .from("news_sources")
    .select(
      "id, name, type, rss_url, api_url, category, region, active, is_active, priority, meta, default_categories, auto_publish, auto_post_facebook, max_items_per_run, trust_score, last_checked_at, last_scanned_at, scan_every_min"
    )
    .order("priority", { ascending: false })
    .order("updated_at", { ascending: false });
}

export async function listActiveNewsSources(service: SupabaseClient, limit = 40) {
  const { data, error } = await baseSourceQuery(service).limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as NewsSourceRow[]).filter((row) => (row.active ?? row.is_active ?? true) !== false);
}

export async function runNewsIngestionPipeline(options: IngestOptions = {}, serviceClient?: SupabaseClient): Promise<IngestSummary> {
  const service = serviceClient ?? supabaseService();
  return runSpmNewsIngestionPipeline(options, service);
}
