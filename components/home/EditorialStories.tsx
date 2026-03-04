import type { HomeEditorialStory } from "@/lib/homepageQueries";

export function EditorialStories({ stories }: { stories: HomeEditorialStory[] }) {
  return (
    <section className="home-media-section" aria-label="Historias editoriales">
      <div className="home-media-section-head">
        <h2>HISTORIAS EDITORIALES</h2>
      </div>

      <div className="home-editorial-grid">
        {stories.length > 0 ? (
          stories.slice(0, 3).map((story) => (
            <article key={story.id} className="card home-editorial-card">
              <a href={story.href} className="home-editorial-thumb">
                {story.imageUrl ? <img src={story.imageUrl} alt={story.title} loading="lazy" /> : <div className="home-media-image-fallback" aria-hidden="true" />}
              </a>
              <div className="home-editorial-body">
                <span className="home-media-chip">{story.category}</span>
                <h3 className="clamp-2">{story.title}</h3>
                <p className="clamp-3">{story.excerpt}</p>
                <a className="button secondary" href={story.href}>
                  Leer mas
                </a>
              </div>
            </article>
          ))
        ) : (
          <article className="card home-empty-state">
            <p>Aun no hay historias editoriales.</p>
          </article>
        )}
      </div>
    </section>
  );
}
