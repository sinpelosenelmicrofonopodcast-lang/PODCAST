import Link from "next/link";
import type { HomeCommunityThread } from "@/lib/homepageQueries";

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("es-PR", {
    day: "2-digit",
    month: "short"
  });
}

export function CommunityPreview({
  threads,
  fallbackTopics
}: {
  threads: HomeCommunityThread[];
  fallbackTopics: string[];
}) {
  const hasThreads = threads.length > 0;

  return (
    <section className="home-media-section" aria-label="Comunidad">
      <div className="home-media-section-head">
        <h2>COMUNIDAD</h2>
      </div>

      <div className="home-community-grid">
        <article className="card home-community-main">
          <span className="home-media-chip">Debate abierto</span>
          <h3>{hasThreads ? "Ultimas discusiones" : "Temas calientes hoy"}</h3>

          {hasThreads ? (
            <ul className="home-community-list">
              {threads.slice(0, 5).map((thread) => (
                <li key={thread.id}>
                  <a href={thread.space === "foro" ? `/foro/${encodeURIComponent(thread.id)}` : "/community"}>
                    <span className="clamp-2">{thread.title}</span>
                    <small>
                      {thread.space === "foro" ? "Foro" : "Comunidad"} · {formatDate(thread.created_at)}
                    </small>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="home-community-list">
              {fallbackTopics.slice(0, 6).map((topic, idx) => (
                <li key={`${topic}-${idx}`}>
                  <a href="/community">
                    <span className="clamp-2">{topic}</span>
                    <small>Tendencia</small>
                  </a>
                </li>
              ))}
            </ul>
          )}

          <Link className="button" href="/community">
            ENTRAR A LA COMUNIDAD
          </Link>
        </article>
      </div>
    </section>
  );
}
