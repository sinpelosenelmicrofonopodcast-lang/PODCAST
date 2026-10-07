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
  categories: { name?: string | null } | { name?: string | null }[] | null;
  users: { nickname?: string | null; bio?: string | null; avatar_url?: string | null } | { nickname?: string | null; bio?: string | null; avatar_url?: string | null }[] | null;
  thread_media: Array<{ id: string; storage_path: string; kind: "image" | "video"; mime_type: string | null; created_at: string | null }> | null;
};

const SEGMENT_ORDER = [
  "Vacilón de corillo",
  "Confesiones sin nombre",
  "Relaciones, sexo y exes",
  "Familia y crianza",
  "Dinero, trabajo y vida adulta",
  "Redes, tecnología y privacidad",
  "Sociedad, política y religión",
  "Dilemas sin filtro",
  "Archivo crudo"
];

const pickUser = (users: any) => (Array.isArray(users) ? users[0] : users);
const pickCategory = (categories: any) => (Array.isArray(categories) ? categories[0] : categories);

function formatDate(value: string | null) {
  if (!value) return "Archivo reciente";
  return new Date(value).toLocaleDateString("es-PR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function categoryName(thread: ThreadRow) {
  return pickCategory(thread.categories)?.name || "Dilemas sin filtro";
}

export default function ZonaCrudaPage() {
  const { checking, userId } = useProtectedUser({ require21: true });
  const [sharedThreadId, setSharedThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [replyCountByThread, setReplyCountByThread] = useState<Map<string, number>>(new Map());
  const [activeSegment, setActiveSegment] = useState("Todos");
  const [copiedThreadId, setCopiedThreadId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSharedThreadId(new URLSearchParams(window.location.search).get("hilo"));
  }, []);

  useEffect(() => {
    if (!userId) return;
    let mounted = true;

    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("threads")
        .select("id, title, body, created_at, categories(name), users(nickname, bio, avatar_url), thread_media(id, storage_path, kind, mime_type, created_at)")
        .eq("space", "zona-cruda")
        .order("created_at", { ascending: false })
        .limit(100);

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
        .limit(5000);

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

  useEffect(() => {
    if (loading || !sharedThreadId) return;
    const node = document.getElementById(`hilo-${sharedThreadId}`);
    if (node) window.setTimeout(() => node.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
  }, [loading, sharedThreadId, threads]);

  const totalReplies = useMemo(
    () => Array.from(replyCountByThread.values()).reduce((sum, count) => sum + count, 0),
    [replyCountByThread]
  );

  const segmentStats = useMemo(() => {
    const counts = new Map<string, number>();
    threads.forEach((thread) => {
      const name = categoryName(thread);
      counts.set(name, (counts.get(name) ?? 0) + 1);
    });
    return counts;
  }, [threads]);

  const sharedThread = useMemo(
    () => (sharedThreadId ? threads.find((thread) => thread.id === sharedThreadId) ?? null : null),
    [threads, sharedThreadId]
  );

  const groupedThreads = useMemo(() => {
    if (sharedThread) return [{ name: categoryName(sharedThread), items: [sharedThread] }];

    const candidates = activeSegment === "Todos"
      ? threads
      : threads.filter((thread) => categoryName(thread) === activeSegment);

    const names = activeSegment === "Todos"
      ? [...SEGMENT_ORDER, ...Array.from(new Set(candidates.map(categoryName))).filter((name) => !SEGMENT_ORDER.includes(name))]
      : [activeSegment];

    return names
      .map((name) => ({ name, items: candidates.filter((thread) => categoryName(thread) === name) }))
      .filter((group) => group.items.length > 0);
  }, [threads, activeSegment, sharedThread]);

  const shareThread = async (thread: ThreadRow) => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/zona-cruda?hilo=${thread.id}#hilo-${thread.id}`;

    try {
      if (navigator.share) {
        await navigator.share({ title: thread.title, text: "Debate esto en Zona Cruda de Sin Pelos.", url });
        return;
      }
    } catch {
      // Si el usuario cierra el menú de compartir, dejamos disponible copiar el enlace.
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopiedThreadId(thread.id);
      window.setTimeout(() => setCopiedThreadId((current) => current === thread.id ? null : current), 1800);
    } catch {
      window.prompt("Copia este enlace:", url);
    }
  };

  const renderArchive = (thread: ThreadRow, index: number, featured = false) => {
    const user = pickUser(thread.users);
    const repliesCount = replyCountByThread.get(thread.id) ?? 0;
    const category = categoryName(thread);
    const kindLabel = category === "Archivo crudo" ? "Documentado" : category === "Vacilón de corillo" ? "Vacilón" : "Debate";

    return (
      <article
        id={`hilo-${thread.id}`}
        key={thread.id}
        className={`${styles.archiveCard} ${featured ? styles.featuredArchive : ""}`}
        style={{ scrollMarginTop: 120 }}
      >
        <div className={styles.archiveIndex}>{String(index).padStart(2, "0")}</div>

        <div className={styles.archiveInner}>
          <div className={styles.archiveTopline}>
            <div className={styles.badgeRow}>
              <span className={styles.documentedBadge}>{category}</span>
              <span className={styles.sensitiveBadge}>{kindLabel}</span>
            </div>
            <span className={styles.date}>{formatDate(thread.created_at)}</span>
          </div>

          <div className={styles.archiveContent}>
            <span className={styles.archiveLabel}>{featured ? "Hilo compartido" : "Zona Cruda"}</span>
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
                <span>{user?.bio || "Comunidad Zona Cruda"}</span>
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
            <button className="button secondary" type="button" onClick={() => shareThread(thread)}>
              {copiedThreadId === thread.id ? "Link copiado" : "Compartir hilo"}
            </button>
            <a className="button secondary" href={`/zona-cruda?hilo=${thread.id}#hilo-${thread.id}`}>
              Abrir solo este hilo
            </a>
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
              <span>Sin filtro</span>
            </div>
            <h1>Zona Cruda</h1>
            <p>
              Vacilones de corillo, relaciones, familia, dinero, redes, política, dilemas incómodos y archivos que dan para discutir sin el teatro de las redes.
            </p>
            <div className={styles.heroActions}>
              <a className="button" href="#segmentos">Escoger segmento</a>
              <a className="button secondary" href="#publicar-zona-cruda">Publicar</a>
            </div>
          </div>

          <div className={styles.warningPanel}>
            <span className={styles.warningKicker}>Aquí se viene a hablar</span>
            <h2>Debate serio o vacilón. Pero con tema.</h2>
            <p>Cada hilo vive en su propio segmento y tiene enlace individual para compartirlo fuera de la plataforma.</p>
            <div className={styles.warningStats}>
              <div><strong>{threads.length}</strong><span>hilos</span></div>
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
                <span className={styles.sectionEyebrow}>{sharedThread ? "Enlace directo · hilo individual" : "Escoge el mood y entra"}</span>
                <h2>{sharedThread ? "Hilo compartido" : "Zona Cruda por segmentos"}</h2>
              </div>
              {sharedThread ? (
                <a className="button secondary" href="/zona-cruda">Ver todos los segmentos</a>
              ) : (
                <span className={styles.feedHint}>No más revolú: cada tema en su esquina</span>
              )}
            </header>

            {!sharedThread ? (
              <div
                id="segmentos"
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 24,
                  scrollMarginTop: 110
                }}
              >
                <button
                  className={activeSegment === "Todos" ? "button" : "button secondary"}
                  type="button"
                  onClick={() => setActiveSegment("Todos")}
                >
                  Todos ({threads.length})
                </button>
                {SEGMENT_ORDER.filter((name) => (segmentStats.get(name) ?? 0) > 0).map((name) => (
                  <button
                    key={name}
                    className={activeSegment === name ? "button" : "button secondary"}
                    type="button"
                    onClick={() => setActiveSegment(name)}
                  >
                    {name} ({segmentStats.get(name) ?? 0})
                  </button>
                ))}
              </div>
            ) : null}

            {checking || loading ? <div className={styles.stateCard}>Abriendo Zona Cruda...</div> : null}

            {!checking && !loading && groupedThreads.length > 0 ? (
              <div style={{ display: "grid", gap: 34 }}>
                {groupedThreads.map((group) => (
                  <section key={group.name} aria-label={group.name}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "end",
                        gap: 12,
                        marginBottom: 12,
                        paddingBottom: 10,
                        borderBottom: "1px solid rgba(255,255,255,.08)"
                      }}
                    >
                      <div>
                        <span className={styles.sectionEyebrow}>Segmento</span>
                        <h3 style={{ margin: "6px 0 0", fontSize: "clamp(26px, 3vw, 38px)" }}>{group.name}</h3>
                      </div>
                      <span className={styles.feedHint}>{group.items.length} {group.items.length === 1 ? "hilo" : "hilos"}</span>
                    </div>
                    <div className={styles.archiveList}>
                      {group.items.map((thread, index) => renderArchive(thread, index + 1, Boolean(sharedThread)))}
                    </div>
                  </section>
                ))}
              </div>
            ) : null}

            {!checking && !loading && threads.length === 0 ? (
              <div className={styles.emptyState}>
                <span>Zona vacía</span>
                <h2>Todavía no hay hilos publicados.</h2>
                <p>Abre una conversación que obligue a la gente a escoger postura, contar una historia o etiquetar mentalmente al pana correcto.</p>
              </div>
            ) : null}

            {!checking && !loading && sharedThreadId && !sharedThread ? (
              <div className={styles.emptyState}>
                <span>Ese hilo no aparece</span>
                <h2>Puede haber sido eliminado o ya no estar disponible.</h2>
                <p><a href="/zona-cruda">Vuelve a Zona Cruda</a> para ver los hilos activos.</p>
              </div>
            ) : null}
          </div>

          <aside className={styles.sidebar}>
            <div className={styles.codeCard}>
              <span className={styles.sidebarEyebrow}>Código de Zona Cruda</span>
              <h3>Fuerte sí. Falso no.</h3>
              <p>Vacila, debate y cuenta experiencias. No doxxing, amenazas reales ni inventar hechos sobre personas.</p>
              <ul>
                <li>Vacilón sin perseguir a nadie.</li>
                <li>Opinión fuerte sin fabricar “hechos”.</li>
                <li>Cada hilo se puede compartir por separado.</li>
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
