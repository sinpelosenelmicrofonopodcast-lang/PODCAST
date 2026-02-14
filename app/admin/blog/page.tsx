"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AdminDeleteButton } from "@/components/AdminDeleteButton";

type BlogPost = {
  id: string;
  title: string;
  body: string | null;
  excerpt: string | null;
  cover_url: string | null;
  created_at: string | null;
};

export default function AdminBlogPage() {
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [body, setBody] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [items, setItems] = useState<BlogPost[]>([]);
  const router = useRouter();

  const loadItems = async () => {
    const { data } = await supabase
      .from("blog_posts")
      .select("id, title, excerpt, body, cover_url, created_at")
      .order("created_at", { ascending: false });
    setItems((data as BlogPost[]) ?? []);
  };

  useEffect(() => {
    loadItems();
  }, []);

  const resetForm = () => {
    setTitle("");
    setExcerpt("");
    setBody("");
    setCoverUrl("");
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
    const filePath = `blog/${userId}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("blog-covers").upload(filePath, file, {
      upsert: true,
      contentType: file.type
    });

    if (uploadError) {
      setStatus(uploadError.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("blog-covers").getPublicUrl(filePath);
    if (data?.publicUrl) {
      setCoverUrl(data.publicUrl);
      setStatus("Portada subida.");
    }
    setUploading(false);
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

    const payload = {
      title,
      excerpt,
      body,
      cover_url: coverUrl,
      author_id: userId
    };

    if (editingId) {
      const { error } = await supabase.from("blog_posts").update(payload).eq("id", editingId);
      if (error) {
        setStatus(error.message);
        setLoading(false);
        return;
      }
      setStatus("Artículo actualizado.");
    } else {
      const { error } = await supabase.from("blog_posts").insert(payload);
      if (error) {
        setStatus(error.message);
        setLoading(false);
        return;
      }
      setStatus("Artículo publicado.");
    }

    setLoading(false);
    resetForm();
    await loadItems();
    router.refresh();
  };

  const handleEdit = (item: BlogPost) => {
    setEditingId(item.id);
    setTitle(item.title ?? "");
    setExcerpt(item.excerpt ?? "");
    setBody(item.body ?? "");
    setCoverUrl(item.cover_url ?? "");
  };

  return (
    <main>
      <h1 className="section-title">Blog (Admin)</h1>
      <p className="muted">Publica artículos largos y análisis.</p>
      <form className="card form-stack" style={{ marginTop: 20 }} onSubmit={handleSubmit}>
        <label>
          Título
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label>
          Extracto
          <textarea className="textarea" rows={2} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
        </label>
        <label>
          Contenido
          <textarea className="textarea" rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
        <label>
          Cover URL
          <input className="input" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} />
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
        <div className="form-submit-bar">
          <button className="button" type="submit" disabled={loading || uploading}>
            {loading ? "Guardando..." : uploading ? "Subiendo portada..." : editingId ? "Actualizar" : "Publicar"}
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
        <h3 style={{ marginTop: 0 }}>Artículos publicados</h3>
        {items.length > 0 ? (
          <div className="list" style={{ marginTop: 12 }}>
            {items.map((item) => (
              <div key={item.id} className="card" style={{ display: "grid", gap: 10 }}>
                <strong>{item.title}</strong>
                <span className="muted" style={{ fontSize: 12 }}>
                  {item.created_at ? new Date(item.created_at).toLocaleDateString("es-PR") : ""}
                </span>
                <div className="admin-item-actions">
                  <button className="button secondary" type="button" onClick={() => handleEdit(item)}>
                    Editar
                  </button>
                  <AdminDeleteButton table="blog_posts" id={item.id} label="Eliminar" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Aún no hay artículos.</p>
        )}
      </div>
    </main>
  );
}
