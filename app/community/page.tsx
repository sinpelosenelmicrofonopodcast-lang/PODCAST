"use client";

import { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CommunityComposer } from "@/components/CommunityComposer";
import { ReplyComposer } from "@/components/ReplyComposer";
import { AdminDeleteButton } from "@/components/AdminDeleteButton";
import { LazyThreadReplies } from "@/components/LazyThreadReplies";
import { supabase } from "@/lib/supabaseClient";
import { useProtectedUser } from "@/lib/useProtectedUser";
import styles from "./community.module.css";

type ThreadRow = {
  id: string;
  title: string;
  body: string | null;
  created_at: string | null;
  users: { nickname?: string | null; bio?: string | null; avatar_url?: string | null } | { nickname?: string | null; bio?: string | null; avatar_url?: string | null }[] | null;
};

const pickUser = (users: any) => (Array.isArray(users) ? users[0] : users);

function formatDate(value: string | null) {
  if (!value) return "Reciente";
  return new Date(value).toLocaleDateString("es-PR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export default function CommunityPage() {
  const { checking, userId } = useProtectedUser();
  const [loading, setLoading] = useState(true);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [replyCountByThread, setReplyCountByThread] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (!userId) return;
    let mounted = true;

    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("threads")
        .select("id, title, body, created_at, users(nickname, bio, avatar_url)")
        .eq("space", "community")
        .order("created_at", { ascending: false })
        .limit(20);

      if (!mounted) return;
      const items = (data as ThreadRow[]) ?? [];
      setThreads(items);

      const ids = items.map((x) => x.id);
      if (ids.length === 0) {
        setReplyCountByThread(new Map());
        setLoading(false);
        return;
      }

      const { data: replies } = await supabase
        .from("replies")
        .select("id, thread_id")
        .in("thread_id", ids)
        .limit(2000);

      if (!mounted) return;
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

  const totalReplies = useMemo(
    () => Array.from(replyCountByThread.values()).reduce((sum, count) => sum + count, 0),
    [replyCountByThread]
  );

  const featuredThread = useMemo(() => {
    if (threads.length === 0) return null;
    return [...threads].sort((a, b) => {
      const replyDelta = (replyCountByThread.get(b.id) ?? 0) - (replyCountByThread.get(a.id) ?? 0);
      if (replyDelta !== 0) return replyDelta;
      return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
    })[0];
  }, [threads, replyCountByThread]);

  const remainingThreads = featuredThread ? threads.filter((thread) => thread.id !== featuredThread.id) : threads;

  const renderThread = (thread: ThreadRow, featured = false) => {
    const user = pickUser(thread.users);
    const repliesCount = replyCountByThread.get(thread.id) ?? 0;

    return (
      <article key={thread.id} className={`${styles.threadCard} ${featured ? styles.featuredThread : ""}`}>
        <div className={styles.threadTopline}>
          <div className={styles.threadAuthor}>
            <img
              src={user?.avatar_url || "/logo.png"}
              alt={user?.nickname ?? "avatar"}
              width={42}
              height={42}
              className={styles.avatar}
            />
            <div className={styles.authorCopy}>
              <strong>{user?.nickname ?? "Anónimo"}</strong>
              <span>{user?.bio || "Miembro de la comunidad"}</span>
            </div>
          </div>
          <div className={styles.threadMeta}>
            {featured ? <span className={styles.hotBadge}>Debate destacado</span> : <span className={styles.openBadge}>Debate abierto</span>}
            <span>{formatDate(thread.created_at)}</span>
          </div>
        </div>

        <div className={styles.threadContent}>
          <h2>{thread.title}</h2>
          {thread.body ? <p>{thread.body}</p> : null}
        </div>

        <div className={styles.engagementBar}>
          <div className={styles.replyStat}>
            <span className={styles.replyNumber}>{repliesCount}</span>
            <span>{repliesCount === 1 ? "respuesta" : "respuestas"}</span>
          </div>
          <span className={styles.prompt}>¿Qué tú piensas?</span>
        </div>

        <div className={styles.threadActions}>
          <LazyThreadReplies threadId={thread.id} initialCount={repliesCount} />
          <details className={styles.replyDetails}>
            <summary>Responder</summary>
            <div className={styles.replyComposerWrap}>
              <ReplyComposer threadId={thread.id} />
            </div>
          </details>
        </div>

        <AdminDeleteButton table="threads" id={thread.id} label="Eliminar thread" />
      </article>
    );
  };

  return (
    <main className={styles.page}>
      <Navbar />

      <section className={styles.heroSection}>
        <div className={`container ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <span className={styles.kicker}>Comunidad Sin Pelos</span>
            <h1>Aquí no vienes a mirar. Vienes a opinar.</h1>
            <p>
              Preguntas incómodas, posturas fuertes y conversaciones que normalmente la gente evita. Lee el argumento, toma posición y métete al debate.
            </p>
            <div className={styles.heroActions}>
              <a className="button" href="#abrir-conversacion">Abrir conversación</a>
              <a className="button secondary" href="#debates">Ver debates</a>
            </div>
          </div>

          <div className={styles.heroPanel}>
            <div className={styles.heroStatGrid}>
              <div>
                <strong>{threads.length}</strong>
                <span>debates activos</span>
              </div>
              <div>
                <strong>{totalReplies}</strong>
                <span>respuestas</span>
              </div>
            </div>
            <div className={styles.heroRule}>
              <span>Regla de la casa</span>
              <strong>Ataca la idea. No a la persona.</strong>
              <p>Argumenta duro, pero deja espacio para que el otro te conteste.</p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.contentSection}>
        <div className={`container ${styles.communityLayout}`}>
          <div className={styles.feed} id="debates">
            <header className={styles.feedHeader}>
              <div>
                <span className={styles.sectionEyebrow}>La conversación está prendida</span>
                <h2>Debates abiertos</h2>
              </div>
              <span className={styles.feedHint}>Lee · toma postura · responde</span>
            </header>

            {checking || loading ? (
              <div className={styles.stateCard}>Cargando conversaciones...</div>
            ) : null}

            {!checking && !loading && featuredThread ? (
              <div className={styles.featuredWrap}>{renderThread(featuredThread, true)}</div>
            ) : null}

            {!checking && !loading && remainingThreads.length > 0 ? (
              <div className={styles.threadList}>{remainingThreads.map((thread) => renderThread(thread))}</div>
            ) : null}

            {!checking && !loading && threads.length === 0 ? (
              <div className={styles.emptyState}>
                <span>La mesa está vacía</span>
                <h2>Abre el primer debate.</h2>
                <p>No hace falta escribir una tesis. Una buena pregunta puede prender toda la comunidad.</p>
              </div>
            ) : null}
          </div>

          <aside className={styles.sidebar}>
            <div id="abrir-conversacion" className={styles.composerWrap}>
              {!checking && userId ? <CommunityComposer /> : null}
            </div>

            <div className={styles.sidebarCard}>
              <span className={styles.sidebarEyebrow}>Para que el thread explote</span>
              <h3>Una postura clara gana más respuestas.</h3>
              <p>Evita preguntas flojas. Expón tu punto, deja algo en juego y termina con una pregunta que obligue a escoger lado.</p>
              <div className={styles.topicCloud}>
                <span>Pareja</span>
                <span>Familia</span>
                <span>Dinero</span>
                <span>Lealtad</span>
                <span>Cultura</span>
                <span>Opiniones impopulares</span>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <Footer />
    </main>
  );
}
