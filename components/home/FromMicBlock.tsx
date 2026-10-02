import Link from "next/link";
import type { HomeEditorialPost } from "@/lib/homeEditorialQueries";

function href(post: HomeEditorialPost) {
  return `/blog/${String(post.slug ?? post.id).trim()}` as any;
}

function dateLabel(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("es-PR", { month: "short", day: "numeric" });
}

export function FromMicBlock({ posts }: { posts: HomeEditorialPost[] }) {
  if (!posts.length) return null;

  return (
    <section className="from-mic-block">
      <div className="from-mic-heading">
        <div>
          <span>DESDE EL MICRÓFONO</span>
          <h2>Lo que una conversación nos dejó pensando.</h2>
        </div>
        <Link href="/blog" className="from-mic-all">VER EDITORIALES →</Link>
      </div>

      <div className="from-mic-grid">
        {posts.map((post, index) => (
          <Link className={`from-mic-card ${index === 0 ? "featured" : ""}`} href={href(post)} key={post.id}>
            <div className="from-mic-media">
              {post.cover_url ? <img src={post.cover_url} alt="" loading="lazy" /> : <div className="from-mic-fallback">SPM</div>}
              <span>{post.episode_title || "Editorial Sin Pelos"}</span>
            </div>
            <div className="from-mic-copy">
              <small>{dateLabel(post.created_at)}{post.reading_time_minutes ? ` · ${post.reading_time_minutes} min` : ""}</small>
              <h3>{post.title}</h3>
              <p>{post.excerpt || "Ideas, aprendizajes y preguntas que siguen vivas después de apagar los micrófonos."}</p>
              <strong>LEER HISTORIA →</strong>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
