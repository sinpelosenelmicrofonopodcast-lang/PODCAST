import { supabaseServer } from "@/lib/supabaseServer";

export type HomeEditorialPost = {
  id: string;
  slug?: string | null;
  title: string;
  excerpt: string | null;
  cover_url: string | null;
  episode_title?: string | null;
  episode_url?: string | null;
  created_at: string | null;
  reading_time_minutes?: number | null;
};

export async function queryPodcastEditorialPosts(limit = 3): Promise<HomeEditorialPost[]> {
  const supabase = supabaseServer();
  const primary = await supabase
    .from("blog_posts")
    .select("id,slug,title,excerpt,cover_url,episode_title,episode_url,created_at,reading_time_minutes")
    .not("episode_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!primary.error && (primary.data?.length ?? 0) > 0) return primary.data as HomeEditorialPost[];

  const fallback = await supabase
    .from("blog_posts")
    .select("id,title,excerpt,cover_url,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (fallback.data ?? []) as HomeEditorialPost[];
}
