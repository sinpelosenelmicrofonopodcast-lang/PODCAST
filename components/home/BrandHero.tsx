"use client";

import { useState } from "react";
import Link from "next/link";

export function BrandHero() {
  const [logoBroken, setLogoBroken] = useState(false);

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
            Bito y Bebo se sientan con gente real a hablar sin libreto. Vivencias, preguntas incómodas y conversaciones que siguen contigo después de apagar los micrófonos.
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
            {logoBroken ? (
              <div className="spm-hero-hosts" aria-label="Bito y Bebo, Sin Pelos en el Micrófono">
                <img src="/images/hosts/bito-sin-pelos-en-el-microfono.webp" alt="Bito" width={180} height={230} decoding="async" onError={(event) => { event.currentTarget.hidden = true; }} />
                <img src="/images/hosts/bebo-sin-pelos-en-el-microfono.webp" alt="Bebo" width={180} height={230} decoding="async" onError={(event) => { event.currentTarget.hidden = true; }} />
                <strong>SIN PELOS</strong>
              </div>
            ) : (
              <img
                src="/brand/spm-official-logo.png?v=20261030"
                alt="Sin Pelos en el Micrófono"
                width={360}
                height={360}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                onError={() => setLogoBroken(true)}
              />
            )}
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
