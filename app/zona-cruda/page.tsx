"use client";

import { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ZonaCrudaComposer } from "@/components/ZonaCrudaComposer";
import { ReplyComposer } from "@/components/ReplyComposer";
import { AdminDeleteButton } from "@/components/AdminDeleteButton";
import { ThreadMedia } from "@/components/ThreadMedia";
import { LazyThreadReplies } from "@/components/LazyThreadReplies";
import { supabase } from "@/lib/supabaseClient";
import { useProtectedUser } from "@/lib/useProtectedUser";
import styles from "./zona-cruda.module.css";

type ThreadRow = {
  id: string;
  title: string;
  body: string | null;
  created_at: string | null;
  users: { nickname?: string | null; bio?: string | null; avatar_url?: string | null } | { nickname?: string | null; bio?: string | null; avatar_url?: string | null }[] | null;
  thread_media: Array<{ id: string; storage_path: string; kind: "image" | "video"; mime_type: string | null; created_at: string | null }> | null;
};

const pickUser = (users: any) => (Array.isArray(users) ? users[0] : users);

function formatDate(value: string | null) {
  if (!value) return "Archivo reciente";
  return new Date(value).toLocaleDateString("es-PR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export default function ZonaCrudaPage() {
  const { checking, userId } = useProtectedUser({ require21: true });
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
        .select("id, title, body, created_at, users(nickname, bio, avatar_url), thread_media(id, storage_path, kind, mime_type, created_at)")
        .eq("space", "zona-cruda")
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

  const renderArchive = (thread: ThreadRow, index: number, featured = false) => {
    const user = pickUser(thread.users);
    const repliesCount = replyCountByThread.get(thread.id) ?? 0;

    return (
      <article key={thread.id} className={`${styles.archiveCard} ${featured ? styles.featuredArchive : ""}`}>
        <div className={styles.archiveIndex}>{String(index).padStart(2, "0")}</div>

        <div className={styles.archiveInner}>
          <div className={styles.archiveTopline}>
            <div className={styles.badgeRow}>
              <span className={styles.documentedBadge}>Caso documentado</span>
              <span className={styles.sensitiveBadge}>Contenido sensible</span>
            </div>
            <span className={styles.date}>{formatDate(thread.created_at)}</span>
          </div>

          <div className={styles.archiveContent}>
            <span className={styles.archiveLabel}>{featured ? "Archivo destacado" : "Expediente Zona Cruda"}</span>
            <h2>{thread.title}</h2>
            {thread.body ? <p>{thread.body}</p> : null}
          </div>

          {thread.thread_media && thread.thread_media.length > 0 ? (
            <div className={styles.mediaWrap}>
              <ThreadMedia media={thread.thread_media} />
            </div>
          ) : null}

          <div className={styles.sourceBar}>
            <div className={styles.authorLine}>
              <img
                src={user?.avatar_url || "/logo.png"}
                alt={user?.nickname ?? "avatar"}
                width={34}
                height={34}
                className={styles.avatar}
              />
              <div>
                <strong>{user?.nickname ?? "Anónimo"}</strong>
                <span>{user?.bio || "Archivo de la comunidad"}</span>
              </div>
            </div>
            <div className={styles.replyCount}>
              <strong>{repliesCount}</strong>
              <span>{repliesCount === 1 ? "respuesta" : "respuestas"}</span>
            </div>
          </div>

          <div className={styles.archiveActions}>
            <LazyThreadReplies threadId={thread.id} initialCount={repliesCount} />
            <details className={styles.replyDetails}>
              <summary>Entrar al debate</summary>
              <div className={styles.replyComposerWrap}>
                <ReplyComposer threadId={thread.id} />
              </div>
            </details>
          </div>

          <AdminDeleteButton table="threads" id={thread.id} label="Eliminar thread" />
        </div>
      </article>
    );
  };

  return (
    <main className={styles.page}>
      <Navbar />

      <section className={styles.heroSection}>
        <div className={`container ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <div className={styles.heroBadges}>
              <span>21+</span>
              <span>Membresía</span>
              <span>Archivo incómodo</span>
            </div>
            <h1>Zona Cruda</h1>
            <p>
              Historias reales que incomodan: abusos institucionales, experimentos humanos, genocidios olvidados y episodios que la historia suele resumir demasiado rápido.
            </p>
            <div className={styles.heroActions}>
              <a className="button" href="#archivos">Explorar archivos</a>
              <a className="button secondary" href="#publicar-zona-cruda">Publicar</a>
            </div>
          </div>

          <div className={styles.warningPanel}>
            <span className={styles.warningKicker}>Antes de seguir</span>
            <h2>Esto no es morbo por morbo.</h2>
            <p>Puede haber lenguaje explícito y descripciones difíciles. El contexto y la veracidad van primero.</p>
            <div className={styles.warningStats}>
              <div><strong>{threads.length}</strong><span>archivos</span></div>
              <div><strong>{totalReplies}</strong><span>respuestas</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.contentSection}>
        <div className={`container ${styles.layout}`}>
          <div className={styles.feed} id="archivos">
            <header className={styles.feedHeader}>
              <div>
                <span className={styles.sectionEyebrow}>Documentado · incómodo · necesario</span>
                <h2>Archivos que merecen ser leídos</h2>
              </div>
              <span className={styles.feedHint}>Lee el contexto antes de reaccionar</span>
            </header>

            {checking || loading ? <div className={styles.stateCard}>Abriendo archivos...</div> : null}

            {!checking && !loading && featuredThread ? (
              <div className={styles.featuredWrap}>{renderArchive(featuredThread, 1, true)}</div>
            ) : null}

            {!checking && !loading && remainingThreads.length > 0 ? (
              <div className={styles.archiveList}>
                {remainingThreads.map((thread, index) => renderArchive(thread, index + 2))}
              </div>
            ) : null}

            {!checking && !loading && threads.length === 0 ? (
              <div className={styles.emptyState}>
                <span>Archivo vacío</span>
                <h2>Todavía no hay expedientes publicados.</h2>
                <p>Zona Cruda funciona mejor cuando el caso tiene contexto, fechas y una pregunta que abra conversación.</p>
              </div>
            ) : null}
          </div>

          <aside className={styles.sidebar}>
            <div className={styles.codeCard}>
              <span className={styles.sidebarEyebrow}>Código de Zona Cruda</span>
              <h3>Fuerte sí. Falso no.</h3>
              <p>Opiniones controversiales y lenguaje explícito están permitidos. Doxxing, amenazas reales y contenido ilegal no.</p>
              <ul>
                <li>Contexto antes que shock.</li>
                <li>Hechos antes que conspiración.</li>
                <li>Discute la idea, no persigas personas.</li>
              </ul>
            </div>

            <div id="publicar-zona-cruda" className={styles.composerWrap}>
              {!checking && userId ? <ZonaCrudaComposer /> : null}
            </div>
          </aside>
        </div>
      </section>

      <Footer />
    </main>
  );
}
