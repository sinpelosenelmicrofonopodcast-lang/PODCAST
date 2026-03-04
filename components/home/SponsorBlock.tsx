import Link from "next/link";
import type { HomeSponsor } from "@/lib/homepageQueries";

export function SponsorBlock({
  title,
  sponsor,
  slot
}: {
  title: string;
  sponsor: HomeSponsor | null;
  slot: "mid" | "footer";
}) {
  return (
    <section className={`home-media-section home-sponsor-block ${slot === "footer" ? "footer" : "mid"}`} aria-label={title}>
      <div className="home-media-section-head">
        <h2>{title}</h2>
      </div>

      <article className="card home-sponsor-card">
        {sponsor?.image_url ? (
          <div className="home-sponsor-logo-wrap">
            <img src={sponsor.image_url} alt={sponsor.title} loading="lazy" className="home-sponsor-logo" />
          </div>
        ) : null}

        <div className="home-sponsor-body">
          <h3>{sponsor?.title ?? "Espacio patrocinado disponible"}</h3>
          <p>{sponsor?.description ?? "Activa este slot desde promociones o solicita presencia de marca en el media kit."}</p>

          {sponsor?.cta_url ? (
            <a className="button" href={sponsor.cta_url} target="_blank" rel="noreferrer">
              {sponsor.cta_label ?? "Ver patrocinador"}
            </a>
          ) : (
            <Link className="button" href="/publicidad">
              Solicitar patrocinio
            </Link>
          )}
        </div>
      </article>
    </section>
  );
}
