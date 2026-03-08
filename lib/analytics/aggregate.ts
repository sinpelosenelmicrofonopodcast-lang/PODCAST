import type { SupabaseClient } from "@supabase/supabase-js";

export async function aggregateAnalytics(service: SupabaseClient, windowHours = 24) {
  const { data, error } = await service.rpc("refresh_trending_metrics_from_events", {
    p_window_hours: Math.max(1, Math.min(168, Math.floor(windowHours)))
  });

  if (error) throw new Error(error.message);

  return {
    updatedRows: Number(data ?? 0)
  };
}
