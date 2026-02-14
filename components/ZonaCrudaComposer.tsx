"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export function ZonaCrudaComposer() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const loadAccess = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;
      const { data: profile } = await supabase
        .from("users")
        .select("is_21_confirmed")
        .eq("id", userId)
        .single();
      const { data: membership } = await supabase
        .from("memberships")
        .select("status, plan")
        .eq("user_id", userId)
        .single();

      const is21 = profile?.is_21_confirmed === true;
      const paid = membership?.status === "active" && membership?.plan === "paid";
      if (is21 && paid) setAllowed(true);
    };

    loadAccess();
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);

    if (!confirm) {
      setStatus("Debes confirmar el disclaimer para publicar.");
      return;
    }

    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setStatus("Debes iniciar sesión para publicar.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("threads").insert({
      title,
      body,
      author_id: userId,
      space: "zona-cruda",
      visibility: "paid",
      status: "published"
    });

    if (error) {
      setStatus(error.message);
      setLoading(false);
      return;
    }

    setTitle("");
    setBody("");
    setStatus("Publicado en Zona Cruda.");
    setLoading(false);
    router.refresh();
  };

  if (!allowed) {
    return (
      <div className="card" style={{ marginTop: 18 }}>
        <h3 style={{ marginTop: 0 }}>Zona Cruda (21+ · Membresía)</h3>
        <p className="muted">Necesitas ser 21+ y tener membresía activa para entrar.</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <h3 style={{ marginTop: 0 }}>Publicar en Zona Cruda</h3>
      <p className="muted">“Si entras aquí, es bajo tu responsabilidad.”</p>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        <input
          className="input"
          placeholder="Título"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <textarea
          className="textarea"
          rows={4}
          placeholder="Opinión sin censura..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
        />
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
          Confirmo que entiendo el contenido explícito y entro bajo mi responsabilidad
        </label>
        <button className="button" type="submit" disabled={loading}>
          {loading ? "Publicando..." : "Publicar"}
        </button>
        {status ? <p className="muted">{status}</p> : null}
      </form>
    </div>
  );
}
