import Image from "next/image";
import Link from "next/link";

export function BrandHero() {
  return (
    <section className="spm-brand-hero">
      <div className="spm-hero-noise" aria-hidden="true" />
      <div className="spm-hero-orb spm-hero-orb-one" aria-hidden="true" />
      <div className="spm-hero-orb spm-hero-orb-two" aria-hidden="true" />
      <div className="container spm-brand-hero-grid">
        <div className="spm-brand-hero-copy">
          <span className="spm-brand-eyebrow">PODCAST · HISTORIAS · COMUNIDAD</span>
          <h1>
            Conversaciones que <em>se quedan contigo.</em>
          </h1>
          <p>
            Gente real. Historias reales. Puntos de vista que no se quedan en el estudio. Cada episodio continúa aquí con lo que nos impactó, lo que aprendimos y lo que vale la pena seguir hablando.
          </p>
          <div className="spm-brand-actions">
            <Link className="button spm-hero-primary" href="/podcast">
              VER EPISODIOS
            </Link>
            <Link className="spm-text-link" href="/blog">
              LEER DESDE EL MICRÓFONO <span>→</span>
            </Link>
          </div>
          <div className="spm-brand-signals" aria-label="Identidad Sin Pelos">
            <span>PUERTO RICO</span>
            <i />
            <span>TEXAS</span>
            <i />
            <span>SIN LIBRETO</span>
          </div>
        </div>

        <div className="spm-brand-hero-art" aria-label="Sin Pelos en el Micrófono">
          <div className="spm-hero-wordmark" aria-hidden="true">SIN<br />PELOS</div>
          <div className="spm-hero-logo-shell">
            <div className="spm-hero-logo-glow" aria-hidden="true" />
            <Image src="/logo.png" alt="Sin Pelos en el Micrófono" width={360} height={360} priority />
          </div>
          <div className="spm-hero-quote">
            <span>“</span>
            <p>Aquí no venimos a quedar bien. Venimos a hablar claro.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
