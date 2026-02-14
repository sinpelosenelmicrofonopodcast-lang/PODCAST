"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const subcategories = [
  "Gobierno y poder",
  "Medios",
  "Economía",
  "Salud",
  "Tecnología",
  "Historia alternativa"
];

export function TeoriaComposer() {
  const [theory, setTheory] = useState("");
  const [source, setSource] = useState("");
  const [opinion, setOpinion] = useState("");
  const [question, setQuestion] = useState("");
  const [subcategory, setSubcategory] = useState(subcategories[0]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setStatus("Debes iniciar sesión para publicar una teoría.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("theories").insert({
      theory,
      source,
      opinion,
      question,
      subcategory,
      author_id: userId
    });

    if (error) {
      setStatus(error.message);
      setLoading(false);
      return;
    }

    setTheory("");
    setSource("");
    setOpinion("");
    setQuestion("");
    setStatus("Teoría publicada.");
    setLoading(false);
    router.refresh();
  };

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <h3 style={{ marginTop: 0 }}>Publicar teoría</h3>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        <input
          className="input"
          placeholder="Teoría"
          value={theory}
          onChange={(e) => setTheory(e.target.value)}
          required
        />
        <input
          className="input"
          placeholder="Fuente (aunque sea debatible)"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        />
        <textarea
          className="textarea"
          rows={3}
          placeholder="Tu opinión personal"
          value={opinion}
          onChange={(e) => setOpinion(e.target.value)}
          required
        />
        <textarea
          className="textarea"
          rows={2}
          placeholder="Pregunta abierta"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          required
        />
        <select className="select" value={subcategory} onChange={(e) => setSubcategory(e.target.value)}>
          {subcategories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <button className="button" type="submit" disabled={loading}>
          {loading ? "Publicando..." : "Publicar"}
        </button>
        {status ? <p className="muted">{status}</p> : null}
      </form>
    </div>
  );
}
