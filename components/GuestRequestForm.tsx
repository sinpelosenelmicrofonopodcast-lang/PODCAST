"use client";

import { useEffect } from "react";

const FORM_ID = "262476243704054";
const FORM_URL = `https://form.jotform.com/${FORM_ID}`;
const EMBED_SCRIPT = "https://cdn.jotfor.ms/s/umd/latest/for-form-embed-handler.js";

export function GuestRequestForm() {
  useEffect(() => {
    let active = true;
    const initEmbed = () => {
      if (!active) return;
      const jotformWindow = window as Window & {
        jotformEmbedHandler?: (selector: string, baseUrl: string) => void;
      };
      jotformWindow.jotformEmbedHandler?.(
        `iframe[id='JotFormIFrame-${FORM_ID}']`,
        "https://form.jotform.com/"
      );
    };

    let script = document.querySelector<HTMLScriptElement>(
      'script[data-spm-jotform="guest"]'
    );
    if (!script) {
      script = document.createElement("script");
      script.src = EMBED_SCRIPT;
      script.async = true;
      script.dataset.spmJotform = "guest";
      document.body.appendChild(script);
    }
    if ((window as Window & { jotformEmbedHandler?: unknown }).jotformEmbedHandler) {
      initEmbed();
    } else {
      script.addEventListener("load", initEmbed);
    }
    return () => {
      active = false;
      script?.removeEventListener("load", initEmbed);
    };
  }, []);

  return (
    <div className="card" style={{ display: "grid", gap: 16, padding: "clamp(12px, 3vw, 28px)" }}>
      <h1 className="section-title" style={{ margin: 0 }}>
        ¿Quieres salir en Sin Pelos en el Micrófono?
      </h1>
      <p className="muted" style={{ margin: 0 }}>
        Todas las solicitudes de invitados se hacen mediante nuestro formulario oficial.
        Cuéntanos tu historia, tema y disponibilidad. Bebo y Bito evaluarán cada
        propuesta; enviar la solicitud no garantiza una invitación ni una fecha de grabación.
      </p>
      <iframe
        id={`JotFormIFrame-${FORM_ID}`}
        title="Solicitud oficial de invitados — Sin Pelos en el Micrófono"
        src={FORM_URL}
        width="100%"
        height="1500"
        scrolling="yes"
        allow="camera; microphone; geolocation; fullscreen"
        loading="lazy"
        style={{ display: "block", width: "100%", minWidth: 0, minHeight: 700, border: 0 }}
      />
      <p className="muted" style={{ margin: 0 }}>
        ¿No carga el formulario?{" "}
        <a href={FORM_URL} target="_blank" rel="noopener noreferrer">
          Ábrelo directamente en Jotform
        </a>.
      </p>
    </div>
  );
}
