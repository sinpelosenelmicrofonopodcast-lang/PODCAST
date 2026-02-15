"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export function GuestRequestForm() {
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setOk(null);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      full_name: String(formData.get("full_name") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim().toLowerCase(),
      phone: String(formData.get("phone") ?? "").trim(),
      availability: String(formData.get("availability") ?? "").trim(),
      topic: String(formData.get("topic") ?? "").trim(),
      details: String(formData.get("details") ?? "").trim(),
      social_url: String(formData.get("social_url") ?? "").trim()
    };

    const requiredMissing = !payload.full_name || !payload.email || !payload.availability || !payload.topic;
    if (requiredMissing) {
      setLoading(false);
      setError("Completa nombre, email, disponibilidad y tema.");
      return;
    }

    const { error: insertError } = await supabase.from("guest_requests").insert(payload);

    setLoading(false);
    if (insertError) {
      setError("No se pudo enviar ahora. Intenta de nuevo en un momento.");
      return;
    }

    event.currentTarget.reset();
    setOk("Solicitud enviada. Te contactamos si tu tema encaja con el programa.");
  };

  return (
    <form className="card" onSubmit={onSubmit} style={{ display: "grid", gap: 14 }}>
      <h2 className="section-title" style={{ margin: 0 }}>
        Quiero salir en Sin Pelos
      </h2>
      <p className="muted" style={{ marginTop: -4 }}>
        Deja tus datos, disponibilidad y tema. Revisamos propuestas semanalmente.
      </p>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        <label>
          Nombre completo
          <input className="input" name="full_name" required />
        </label>
        <label>
          Email
          <input className="input" type="email" name="email" required />
        </label>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        <label>
          Teléfono / WhatsApp
          <input className="input" name="phone" />
        </label>
        <label>
          Disponibilidad
          <input className="input" name="availability" placeholder="Ej: Lunes y jueves 7pm-10pm" required />
        </label>
      </div>

      <label>
        Tema que quieres traer
        <input className="input" name="topic" placeholder="Ej: Política PR, medios, tecnología..." required />
      </label>

      <label>
        Cuéntanos más (ángulo, contexto, por qué importa)
        <textarea className="textarea" name="details" rows={5} />
      </label>

      <label>
        Red social / referencia (opcional)
        <input className="input" name="social_url" placeholder="https://..." />
      </label>

      {error ? <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p> : null}
      {ok ? <p style={{ color: "var(--success)", margin: 0 }}>{ok}</p> : null}

      <button className="button" disabled={loading} type="submit">
        {loading ? "Enviando..." : "Enviar solicitud"}
      </button>
    </form>
  );
}
