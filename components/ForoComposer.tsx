"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Category = { id: string; name: string };

export function ForoComposer({ categories }: { categories: Category[] }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id ?? "");
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
      setStatus("Debes iniciar sesión para publicar.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("threads").insert({
      title,
      body,
      author_id: userId,
      space: "foro",
      category_id: categoryId || null,
      visibility: "public",
      status: "published"
    });

    if (error) {
      setStatus(error.message);
      setLoading(false);
      return;
    }

    setTitle("");
    setBody("");
    setStatus("Publicado.");
    setLoading(false);
    router.refresh();
  };

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <h3 style={{ marginTop: 0 }}>Crear nuevo tema</h3>
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
          placeholder="Escribe tu opinión sin filtro..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
        />
        <select className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
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
