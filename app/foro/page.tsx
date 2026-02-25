"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ForoComposer } from "@/components/ForoComposer";
import { AdminDeleteButton } from "@/components/AdminDeleteButton";
import { ForumLayout, type ForumCategory, type ForumThread } from "@/components/foro/ForumLayout";
import { supabase } from "@/lib/supabaseClient";
import { useProtectedUser } from "@/lib/useProtectedUser";

type Category = { id: string; name: string };
type ThreadRow = {
  id: string;
  title: string;
  body: string | null;
  created_at: string | null;
  category_id: string | null;
  users: { nickname?: string | null; bio?: string | null; avatar_url?: string | null } | { nickname?: string | null; bio?: string | null; avatar_url?: string | null }[] | null;
  categories: { name?: string | null } | { name?: string | null }[] | null;
};

const pickUser = (users: any) => (Array.isArray(users) ? users[0] : users);
const pickCategory = (category: any) => (Array.isArray(category) ? category[0] : category);

export default function ForoPage() {
  const { checking, userId } = useProtectedUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [replyCountByThread, setReplyCountByThread] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (!userId) return;
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      const [{ data: cats, error: catsError }, { data: threadRows, error: threadsError }] = await Promise.all([
        supabase.from("categories").select("id, name").eq("space", "foro").order("name"),
        supabase
          .from("threads")
          .select("id, title, body, created_at, category_id, users(nickname, bio, avatar_url), categories(name)")
          .eq("space", "foro")
          .order("created_at", { ascending: false })
          .limit(40)
      ]);

      if (!mounted) return;

      if (catsError || threadsError) {
        setCategories([]);
        setThreads([]);
        setReplyCountByThread(new Map());
        setError(catsError?.message ?? threadsError?.message ?? "No se pudo cargar el foro.");
        setLoading(false);
        return;
      }

      const items = (threadRows as ThreadRow[]) ?? [];
      setCategories((cats as Category[]) ?? []);
      setThreads(items);

      const ids = items.map((x) => x.id);
      if (ids.length === 0) {
        setReplyCountByThread(new Map());
        setLoading(false);
        return;
      }

      const { data: replies, error: repliesError } = await supabase
        .from("replies")
        .select("id, thread_id")
        .in("thread_id", ids)
        .limit(4000);

      if (!mounted) return;
      if (repliesError) {
        setError(repliesError.message);
        setReplyCountByThread(new Map());
        setLoading(false);
        return;
      }

      const counts = new Map<string, number>();
      (replies ?? []).forEach((r: any) => counts.set(r.thread_id, (counts.get(r.thread_id) ?? 0) + 1));
      setReplyCountByThread(counts);
      setLoading(false);
    };

    load();
    return () => {
      mounted = false;
    };
  }, [userId]);

  const forumCategories: ForumCategory[] = categories.map((category) => {
    const count = threads.filter((thread) => thread.category_id === category.id).length;
    return {
      id: category.id,
      name: category.name,
      count
    };
  });

  const forumThreads: ForumThread[] = threads.map((thread) => {
    const user = pickUser(thread.users);
    const category = pickCategory(thread.categories);
    return {
      id: thread.id,
      href: `/foro/${thread.id}` as `/foro/${string}`,
      title: thread.title,
      body: thread.body,
      created_at: thread.created_at,
      category_id: thread.category_id,
      category_name: category?.name ?? null,
      author: {
        nickname: user?.nickname ?? "Anónimo",
        bio: user?.bio ?? null,
        avatar_url: user?.avatar_url ?? null
      },
      repliesCount: replyCountByThread.get(thread.id) ?? 0
    };
  });

  return (
    <main>
      <Navbar />

      <ForumLayout
        categories={forumCategories}
        threads={forumThreads}
        isLoading={checking || loading}
        error={error}
        onCreateTopicHref="#new-topic"
        renderThreadExtras={(thread) => (
          <>
            <AdminDeleteButton table="threads" id={thread.id} label="Eliminar tema" />
          </>
        )}
      />

      {!checking && userId ? (
        <section className="section" id="new-topic">
          <div className="container foro-premium-shell">
            <ForoComposer categories={categories} />
          </div>
        </section>
      ) : null}

      <Footer />
    </main>
  );
}
