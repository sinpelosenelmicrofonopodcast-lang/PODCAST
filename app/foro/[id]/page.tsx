import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ReplyComposer } from "@/components/ReplyComposer";
import { AdminDeleteButton } from "@/components/AdminDeleteButton";
import { supabaseServer } from "@/lib/supabaseServer";

export const revalidate = 0;
export const dynamic = "force-dynamic";

type ThreadRow = {
  id: string;
  title: string;
  body: string | null;
  created_at: string | null;
  users: { nickname?: string | null; avatar_url?: string | null } | { nickname?: string | null; avatar_url?: string | null }[] | null;
  categories: { name?: string | null } | { name?: string | null }[] | null;
};

type ReplyRow = {
  id: string;
  body: string | null;
  created_at: string | null;
  users: { nickname?: string | null; avatar_url?: string | null } | { nickname?: string | null; avatar_url?: string | null }[] | null;
};

const pickUser = (users: any) => (Array.isArray(users) ? users[0] : users);
const pickCategory = (category: any) => (Array.isArray(category) ? category[0] : category);

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("es-PR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default async function ForoThreadPage({ params }: { params: { id: string } }) {
  const id = String(params?.id ?? "").trim();
  const supabase = supabaseServer();

  const { data: threadData, error: threadError } = await supabase
    .from("threads")
    .select("id, title, body, created_at, users(nickname, avatar_url), categories(name)")
    .eq("space", "foro")
    .eq("id", id)
    .maybeSingle();

  const thread = (threadData as ThreadRow | null) ?? null;

  const repliesResp = thread
    ? await supabase
        .from("replies")
        .select("id, body, created_at, users(nickname, avatar_url)")
        .eq("thread_id", id)
        .order("created_at", { ascending: true })
        .limit(300)
    : { data: [], error: null } as any;

  const replies = (repliesResp.data as ReplyRow[] | null) ?? [];
  const repliesError = repliesResp.error?.message ?? null;

  return (
    <main>
      <Navbar />
      <section className="section">
        <div className="container" style={{ maxWidth: 920, display: "grid", gap: 16 }}>
          <Link className="button secondary" href="/foro" style={{ width: "fit-content" }}>
            Volver al foro
          </Link>

          {!thread || threadError ? (
            <article className="card">
              <h1 className="section-title" style={{ marginTop: 0 }}>
                Tema no encontrado
              </h1>
              <p className="muted" style={{ marginBottom: 0 }}>
                Este debate no existe, fue borrado o no tienes acceso.
              </p>
            </article>
          ) : (
            <>
              <article className="card" style={{ display: "grid", gap: 14 }}>
                <header style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <img
                      src={pickUser(thread.users)?.avatar_url ?? "/logo.png"}
                      alt={pickUser(thread.users)?.nickname ?? "avatar"}
                      width={38}
                      height={38}
                      style={{ borderRadius: "50%", objectFit: "cover" }}
                    />
                    <div>
                      <div style={{ fontWeight: 700 }}>{pickUser(thread.users)?.nickname ?? "Anónimo"}</div>
                      <div className="muted" style={{ fontSize: 13 }}>
                        {formatDate(thread.created_at)}
                      </div>
                    </div>
                  </div>
                  {pickCategory(thread.categories)?.name ? <span className="badge">{pickCategory(thread.categories)?.name}</span> : null}
                </header>

                <h1 className="section-title" style={{ margin: 0, fontSize: "clamp(28px,4vw,48px)" }}>
                  {thread.title}
                </h1>

                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.8,
                    fontSize: 17,
                    borderTop: "1px solid var(--border)",
                    paddingTop: 14
                  }}
                >
                  {thread.body ?? ""}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <AdminDeleteButton table="threads" id={thread.id} label="Eliminar tema" />
                </div>
              </article>

              <article className="card" style={{ display: "grid", gap: 12 }}>
                <h2 style={{ margin: 0 }}>Respuestas ({replies.length})</h2>
                {repliesError ? (
                  <p className="muted" style={{ margin: 0 }}>
                    {repliesError}
                  </p>
                ) : null}
                {!repliesError && replies.length === 0 ? (
                  <p className="muted" style={{ margin: 0 }}>
                    Aún no hay respuestas. Sé el primero en comentar.
                  </p>
                ) : null}
                {!repliesError && replies.length > 0 ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    {replies.map((reply) => (
                      <div
                        key={reply.id}
                        style={{
                          border: "1px solid var(--border)",
                          borderRadius: 12,
                          padding: 12,
                          display: "grid",
                          gap: 6
                        }}
                      >
                        <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <img
                              src={pickUser(reply.users)?.avatar_url ?? "/logo.png"}
                              alt={pickUser(reply.users)?.nickname ?? "avatar"}
                              width={24}
                              height={24}
                              style={{ borderRadius: "50%", objectFit: "cover" }}
                            />
                            <strong style={{ fontSize: 14 }}>{pickUser(reply.users)?.nickname ?? "Anónimo"}</strong>
                            <span className="muted" style={{ fontSize: 12 }}>
                              {formatDate(reply.created_at)}
                            </span>
                          </div>
                          <AdminDeleteButton table="replies" id={reply.id} label="Eliminar respuesta" />
                        </div>
                        <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{reply.body ?? ""}</p>
                      </div>
                    ))}
                  </div>
                ) : null}

                <ReplyComposer threadId={id} />
              </article>
            </>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}

