import type { EpisodeEditorial as EpisodeEditorialData } from "@/lib/episodeEditorials";

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return <span className="episode-editorial-eyebrow">{children}</span>;
}

export function EpisodeEditorial({ editorial }: { editorial: EpisodeEditorialData }) {
  const isHosts = editorial.episode_type === "hosts";
  const storyTitle = isHosts
    ? "Lo que realmente quisimos decir"
    : editorial.guest_name
      ? `La historia detrás de ${editorial.guest_name}`
      : "La historia detrás de la conversación";

  return (
    <section className="episode-editorial" aria-label="Editorial del episodio">
      <header className="episode-editorial-hero">
        <div>
          <SectionEyebrow>DESPUÉS DEL MICRÓFONO</SectionEyebrow>
          <h2>{editorial.title}</h2>
          {editorial.intro ? <p>{editorial.intro}</p> : null}
        </div>
        {editorial.episode_code ? <span className="episode-editorial-code">{editorial.episode_code}</span> : null}
      </header>

      {editorial.person_story ? (
        <article className="episode-editorial-story">
          <SectionEyebrow>{isHosts ? "NUESTRO PUNTO" : "QUIÉN SE SENTÓ CON NOSOTROS"}</SectionEyebrow>
          <h3>{storyTitle}</h3>
          <p>{editorial.person_story}</p>
        </article>
      ) : null}

      {editorial.impact_summary ? (
        <article className="episode-editorial-impact">
          <div className="episode-editorial-impact-mark">“</div>
          <div>
            <SectionEyebrow>LO QUE MÁS NOS IMPACTÓ</SectionEyebrow>
            <p>{editorial.impact_summary}</p>
          </div>
        </article>
      ) : null}

      {editorial.lessons.length > 0 ? (
        <section className="episode-editorial-section">
          <div className="episode-editorial-heading">
            <SectionEyebrow>LO QUE NOS LLEVAMOS</SectionEyebrow>
            <h3>Enseñanzas que dejó la conversación</h3>
          </div>
          <div className="episode-editorial-lessons">
            {editorial.lessons.map((lesson, index) => (
              <article key={`${lesson.title}-${index}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h4>{lesson.title}</h4>
                  <p>{lesson.body}</p>
                  {lesson.evidence ? <small>{lesson.evidence}</small> : null}
                  {lesson.timestamp ? <em>{lesson.timestamp}</em> : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {editorial.host_points.length > 0 ? (
        <section className="episode-editorial-section episode-editorial-host-points">
          <div className="episode-editorial-heading">
            <SectionEyebrow>{isHosts ? "LOS PUNTOS QUE QUERÍAMOS DEJAR CLAROS" : "BITO Y BEBO: LO QUE PUSIMOS SOBRE LA MESA"}</SectionEyebrow>
            <h3>Más allá del clip</h3>
          </div>
          <div className="episode-editorial-point-grid">
            {editorial.host_points.map((point, index) => (
              <article key={`${point.title}-${index}`}>
                {point.speaker ? <span>{point.speaker}</span> : null}
                <h4>{point.title}</h4>
                <p>{point.body}</p>
                {point.evidence ? <small>{point.evidence}</small> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {editorial.quotes.length > 0 ? (
        <section className="episode-editorial-quotes">
          <SectionEyebrow>FRASES QUE SE QUEDARON CON NOSOTROS</SectionEyebrow>
          <div className="episode-editorial-quote-grid">
            {editorial.quotes.slice(0, 4).map((item, index) => (
              <blockquote key={`${item.quote}-${index}`}>
                <p>“{item.quote}”</p>
                <footer>
                  {item.speaker ? <strong>{item.speaker}</strong> : null}
                  {item.timestamp ? <span>{item.timestamp}</span> : null}
                </footer>
              </blockquote>
            ))}
          </div>
        </section>
      ) : null}

      {editorial.closing_reflection ? (
        <footer className="episode-editorial-closing">
          <SectionEyebrow>CON QUÉ NOS QUEDAMOS</SectionEyebrow>
          <p>{editorial.closing_reflection}</p>
        </footer>
      ) : null}
    </section>
  );
}
