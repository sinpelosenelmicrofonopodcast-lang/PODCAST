"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/lib/toast";

export function AdRequestForm() {
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
      company: String(formData.get("company") ?? "").trim(),
      website: String(formData.get("website") ?? "").trim(),
      budget: String(formData.get("budget") ?? "").trim(),
      message: String(formData.get("message") ?? "").trim(),
      updated_at: new Date().toISOString()
    };

    const requiredMissing = !payload.full_name || !payload.email || !payload.company || !payload.message;
    if (requiredMissing) {
      setLoading(false);
      const msg = "Completa nombre, email, compañía y mensaje.";
      setError(msg);
      toast.error(msg);
      return;
    }

    const { error: insertError } = await supabase.from("ad_requests").insert(payload);

    setLoading(false);
    if (insertError) {
      const msg = "No se pudo enviar ahora. Intenta de nuevo en un momento.";
      setError(msg);
      toast.error(msg);
      return;
    }

    event.currentTarget.reset();
    const msg = "Solicitud enviada. Te contactamos con opciones de publicidad y media kit.";
    setOk(msg);
    toast.success("Solicitud enviada.");
  };

  return (
    <form className="card" onSubmit={onSubmit} style={{ display: "grid", gap: 14 }}>
      <h2 className="section-title" style={{ margin: 0 }}>
        Publicidad y Patrocinios
      </h2>
      <p className="muted" style={{ marginTop: -4 }}>
        Marcas, negocios y creadores: cuéntanos qué quieres promover y te enviamos opciones.
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
          Compañía / Marca
          <input className="input" name="company" required />
        </label>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        <label>
          Website / Landing (opcional)
          <input className="input" name="website" placeholder="https://..." />
        </label>
        <label>
          Presupuesto (opcional)
          <input className="input" name="budget" placeholder="Ej: $200-$500 / mes" />
        </label>
      </div>

      <label>
        Mensaje
        <textarea className="textarea" name="message" rows={5} placeholder="Qué quieres anunciar, objetivo, fechas, etc." required />
      </label>

      {error ? <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p> : null}
      {ok ? <p style={{ color: "var(--success)", margin: 0 }}>{ok}</p> : null}

      <button className="button" disabled={loading} type="submit">
        {loading ? "Enviando..." : "Enviar solicitud"}
      </button>
    </form>
  );
}

