"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AdminDeleteButton } from "@/components/AdminDeleteButton";
import { newsCategories } from "@/lib/newsCategories";

type NewsItem = {
  id: string;
  title: string;
  summary: string | null;
  analysis: string | null;
  source_url: string | null;
  cover_url: string | null;
  categories: string[] | null;
  tags: string[] | null;
  published_at: string | null;
};

export default function AdminNewsPage() {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [categories, setCategories] = useState<string[]>([newsCategories[0]]);
  const [tags, setTags] = useState("");
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [items, setItems] = useState<NewsItem[]>([]);
  const router = useRouter();

  const loadItems = async () => {
    const { data } = await supabase
      .from("news_items")
      .select("id, title, summary, analysis, source_url, cover_url, categories, tags, published_at")
      .order("published_at", { ascending: false });
    setItems((data as NewsItem[]) ?? []);
  };

  useEffect(() => {
    loadItems();
  }, []);

  const resetForm = () => {
    setTitle("");
    setSummary("");
    setAnalysis("");
    setSourceUrl("");
    setCoverUrl("");
    setCategories([newsCategories[0]]);
    setTags("");
    setEditingId(null);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setStatus(null);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setStatus("Debes iniciar sesión para subir portada.");
      setUploading(false);
      return;
    }

    const ext = file.name.split(".").pop() ?? "jpg";
    const filePath = `news/${userId}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("news-covers").upload(filePath, file, {
      upsert: true,
      contentType: file.type
    });

    if (uploadError) {
      setStatus(uploadError.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("news-covers").getPublicUrl(filePath);
    if (data?.publicUrl) {
      setCoverUrl(data.publicUrl);
      setStatus("Portada subida.");
    }
    setUploading(false);
  };

  const toggleCategory = (cat: string) => {
    setCategories((prev) => {
      if (prev.includes(cat)) {
        const next = prev.filter((c) => c !== cat);
        return next.length > 0 ? next : [cat];
      }
      return [...prev, cat];
    });
  };

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

    const tagList = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      title,
      summary,
      analysis,
      source_url: sourceUrl,
      cover_url: coverUrl,
      categories,
      tags: tagList,
      author_id: userId,
      published_at: new Date().toISOString()
    };

    if (editingId) {
      const { error } = await supabase.from("news_items").update(payload).eq("id", editingId);
      if (error) {
        setStatus(error.message);
        setLoading(false);
        return;
      }
      setStatus("Noticia actualizada.");
    } else {
      const { error } = await supabase.from("news_items").insert(payload);
      if (error) {
        setStatus(error.message);
        setLoading(false);
        return;
      }
      setStatus("Noticia publicada.");
    }

    setLoading(false);
    resetForm();
    await loadItems();
    router.refresh();
  };

  const handleEdit = (item: NewsItem) => {
    setEditingId(item.id);
    setTitle(item.title ?? "");
    setSummary(item.summary ?? "");
    setAnalysis(item.analysis ?? "");
    setSourceUrl(item.source_url ?? "");
    setCoverUrl(item.cover_url ?? "");
    setCategories(item.categories && item.categories.length > 0 ? item.categories : [newsCategories[0]]);
    setTags(item.tags?.join(", ") ?? "");
  };

  return (
    <main>
      <h1 className="section-title">Curaduría de Noticias</h1>
      <p className="muted">Resumen + análisis propio + tags.</p>
      <form className="card form-stack" style={{ marginTop: 20 }} onSubmit={handleSubmit}>
        <label>
          Título
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label>
          Resumen
          <textarea className="textarea" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
        </label>
        <label>
          Análisis estilo Sin Pelos
          <textarea className="textarea" rows={4} value={analysis} onChange={(e) => setAnalysis(e.target.value)} />
        </label>
        <label>
          Fuente
          <input className="input" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
        </label>
        <label>
          Portada (URL)
          <input className="input" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://..." />
        </label>
        <label>
          Subir portada
          <input
            className="input"
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />
        </label>
        <label>
          Categorías
          <div className="check-grid">
            {newsCategories.map((cat) => (
              <label key={cat} className="check-row compact">
                <input type="checkbox" checked={categories.includes(cat)} onChange={() => toggleCategory(cat)} />
                {cat}
              </label>
            ))}
          </div>
        </label>
        <label>
          Tags (separados por coma)
          <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="medios, pr, politica" />
        </label>
        <div className="form-submit-bar">
          <button className="button" type="submit" disabled={loading || uploading}>
            {loading ? "Guardando..." : uploading ? "Subiendo portada..." : editingId ? "Actualizar noticia" : "Publicar noticia"}
          </button>
          {editingId ? (
            <button className="button secondary" type="button" onClick={resetForm}>
              Cancelar edición
            </button>
          ) : null}
        </div>
        {status ? <p className="muted" style={{ margin: 0 }}>{status}</p> : null}
      </form>

      <div className="card" style={{ marginTop: 24 }}>
        <h3 style={{ marginTop: 0 }}>Noticias publicadas</h3>
        {items.length > 0 ? (
          <div className="list" style={{ marginTop: 12 }}>
            {items.map((item) => (
              <div key={item.id} className="card" style={{ display: "grid", gap: 10 }}>
                <strong>{item.title}</strong>
                <span className="muted" style={{ fontSize: 12 }}>
                  {(item.categories ?? []).join(" · ")} · {item.published_at ? new Date(item.published_at).toLocaleDateString("es-PR") : ""}
                </span>
                <div className="admin-item-actions">
                  <button className="button secondary" type="button" onClick={() => handleEdit(item)}>
                    Editar
                  </button>
                  <AdminDeleteButton table="news_items" id={item.id} label="Eliminar" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Aún no hay noticias.</p>
        )}
      </div>
    </main>
  );
}
