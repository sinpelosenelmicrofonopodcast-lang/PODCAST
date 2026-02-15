"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AdminDeleteButton } from "@/components/AdminDeleteButton";
import { clampMetaDescription, estimateReadingTimeMinutes, slugify } from "@/lib/blogSeo";
import { newsCategories } from "@/lib/newsCategories";

type BlogPost = {
  id: string;
  title: string;
  body: string | null;
  excerpt: string | null;
  meta_description?: string | null;
  slug?: string | null;
  reading_time_minutes?: number | null;
  categories?: string[] | null;
  tags?: string[] | null;
  cover_url: string | null;
  created_at: string | null;
};

export default function AdminBlogPage() {
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [body, setBody] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState("");
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [items, setItems] = useState<BlogPost[]>([]);
  const router = useRouter();

  const loadItems = async () => {
    // Column-safe: don't break admin if migrations haven't been applied yet.
    const primary = await supabase
      .from("blog_posts")
      .select("id, slug, title, excerpt, meta_description, body, cover_url, created_at, reading_time_minutes, categories, tags")
      .order("created_at", { ascending: false });
    if (primary.error && /(slug|meta_description|reading_time_minutes|categories|tags)/i.test(primary.error.message)) {
      const fallback = await supabase
        .from("blog_posts")
        .select("id, title, excerpt, body, cover_url, created_at")
        .order("created_at", { ascending: false });
      setItems((fallback.data as BlogPost[]) ?? []);
      return;
    }
    setItems((primary.data as BlogPost[]) ?? []);
  };

  useEffect(() => {
    loadItems();
  }, []);

  const resetForm = () => {
    setTitle("");
    setExcerpt("");
    setMetaDescription("");
    setSlug("");
    setBody("");
    setCoverUrl("");
    setCategories([]);
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

    const readingTime = estimateReadingTimeMinutes(`${title}\n\n${body}`);
    const safeSlug = (slug ? slugify(slug) : slugify(title)).slice(0, 120);
    const safeMeta = clampMetaDescription(metaDescription || excerpt || body || "");
    const tagList = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payloadBase: any = {
      title,
      excerpt: excerpt || null,
      meta_description: safeMeta || null,
      slug: safeSlug,
      reading_time_minutes: readingTime,
      categories: categories.length ? categories : null,
      tags: tagList.length ? tagList : null,
      body: body || null,
      cover_url: coverUrl || null,
      author_id: userId,
      updated_at: new Date().toISOString()
    };

    if (editingId) {
      let { error } = await supabase.from("blog_posts").update(payloadBase).eq("id", editingId);
      if (error && /(slug|meta_description|reading_time_minutes|categories|tags|updated_at)/i.test(error.message)) {
        const minimal = { title, excerpt: excerpt || null, body: body || null, cover_url: coverUrl || null, author_id: userId };
        const retry = await supabase.from("blog_posts").update(minimal).eq("id", editingId);
        error = retry.error;
      }
      if (error) return setStatus(error.message), void setLoading(false);
      setStatus("Artículo actualizado.");
    } else {
      let { error } = await supabase.from("blog_posts").insert(payloadBase);
      if (error && /(slug|meta_description|reading_time_minutes|categories|tags|updated_at)/i.test(error.message)) {
        const minimal = { title, excerpt: excerpt || null, body: body || null, cover_url: coverUrl || null, author_id: userId };
        const retry = await supabase.from("blog_posts").insert(minimal);
        error = retry.error;
      }
      if (error) return setStatus(error.message), void setLoading(false);
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
    setMetaDescription((item as any).meta_description ?? "");
    setSlug((item as any).slug ?? "");
    setBody(item.body ?? "");
    setCoverUrl(item.cover_url ?? "");
    setCategories((item as any).categories ?? []);
    setTags(((item as any).tags ?? []).join(", "));
  };

  return (
    <main>
      <h1 className="section-title">Blog (Admin)</h1>
      <p className="muted">Estructura recomendada: usa headings con "##" para H2 y "###" para H3.</p>
      <form className="card form-stack" style={{ marginTop: 20 }} onSubmit={handleSubmit}>
        <label>
          Título
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label>
          Slug (SEO)
          <input className="input" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="ej: analisis-medios-pr-2026" />
        </label>
        <label>
          Meta descripción (155–160)
          <textarea
            className="textarea"
            rows={2}
            value={metaDescription}
            onChange={(e) => setMetaDescription(e.target.value)}
            placeholder="Resumen breve y magnetico para Google y previews."
          />
          <div className="muted" style={{ fontSize: 12 }}>
            {clampMetaDescription(metaDescription || excerpt || "").length}/160
          </div>
        </label>
        <label>
          Extracto
          <textarea className="textarea" rows={2} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
        </label>
        <label>
          Categorías
          <div className="check-grid" style={{ marginTop: 10 }}>
            {newsCategories.map((cat) => (
              <label key={cat} className="check-row compact">
                <input
                  type="checkbox"
                  checked={categories.includes(cat)}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setCategories((prev) => (checked ? [...prev, cat] : prev.filter((c) => c !== cat)));
                  }}
                />
                {cat}
              </label>
            ))}
          </div>
        </label>
        <label>
          Tags (separados por coma)
          <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="medios, cultura, texas" />
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
                  <a className="button secondary" href={`/blog/${(item as any).slug ?? item.id}`} target="_blank" rel="noreferrer">
                    Ver publico
                  </a>
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
