"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AdminDeleteButton } from "@/components/AdminDeleteButton";
import { newsCategories } from "@/lib/newsCategories";
import { toast } from "@/lib/toast";
import { newsHref } from "@/lib/newsRoute";

type NewsItem = {
  id: string;
  slug?: string | null;
  title: string;
  summary: string | null;
  analysis: string | null;
  source_url: string | null;
  cover_url: string | null;
  video_url: string | null;
  categories: string[] | null;
  tags: string[] | null;
  publication_state?: "draft" | "published" | null;
  ingest_source?: string | null;
  updated_at?: string | null;
  rewrite_status?: "none" | "queued" | "processing" | "done" | "failed" | null;
  rewrite_error?: string | null;
  needs_review?: boolean | null;
  rewritten_at?: string | null;
  published_at: string | null;
};

type NewsItemFull = NewsItem;

function humanizeNewsError(raw?: string | null) {
  const msg = String(raw ?? "").trim();
  if (!msg) return "No se pudo guardar la noticia.";
  if (msg.includes("news_items_source_hash_unique") || msg.toLowerCase().includes("duplicate key value")) {
    return "Duplicado detectado: ya existe una noticia con la misma fuente/contenido.";
  }
  return msg;
}

export default function AdminNewsPage() {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [categories, setCategories] = useState<string[]>([newsCategories[0]]);
  const [tags, setTags] = useState("");
  const [publishNow, setPublishNow] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingPublishedAt, setEditingPublishedAt] = useState<string | null>(null);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [postToFacebook, setPostToFacebook] = useState(true);
  const [postingFacebookId, setPostingFacebookId] = useState<string | null>(null);
  const [rewritingId, setRewritingId] = useState<string | null>(null);
  const router = useRouter();

  const loadItems = async () => {
    const primary = await supabase
      .from("news_items")
      .select(
        "id, slug, title, summary, analysis, source_url, cover_url, video_url, categories, tags, publication_state, ingest_source, updated_at, rewrite_status, rewrite_error, needs_review, rewritten_at, published_at"
      )
      .order("published_at", { ascending: false });
    if (
      primary.error &&
      /(slug|video_url|publication_state|ingest_source|updated_at|rewrite_status|rewrite_error|needs_review|rewritten_at)/i.test(
        primary.error.message
      )
    ) {
      const fallback = await supabase
        .from("news_items")
        .select("id, title, summary, analysis, source_url, cover_url, categories, tags, published_at")
        .order("published_at", { ascending: false });
      setItems((fallback.data as NewsItem[]) ?? []);
      return;
    }
    setItems((primary.data as NewsItem[]) ?? []);
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
    setVideoUrl("");
    setCategories([newsCategories[0]]);
    setTags("");
    setPublishNow(true);
    setEditingId(null);
    setEditingPublishedAt(null);
    setPostToFacebook(true);
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
      toast.error(uploadError.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("news-covers").getPublicUrl(filePath);
    if (data?.publicUrl) {
      setCoverUrl(data.publicUrl);
      setStatus("Portada subida.");
      toast.success("Portada subida.");
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
      summary: summary ? summary : null,
      analysis: analysis ? analysis : null,
      source_url: sourceUrl ? sourceUrl : null,
      cover_url: coverUrl ? coverUrl : null,
      video_url: videoUrl ? videoUrl : null,
      categories: categories && categories.length > 0 ? categories : [newsCategories[0]],
      tags: tagList,
      publication_state: publishNow ? "published" : "draft"
    };

    if (editingId) {
      const updatePayload: any = { ...payload };
      // Keep original publish time on edit so sorting/feeds remain stable.
      if (publishNow) {
        updatePayload.published_at = editingPublishedAt ?? new Date().toISOString();
      } else {
        updatePayload.published_at = null;
      }

      // Do NOT rely on `.single()` / `.maybeSingle()` here.
      // Under some RLS states PostgREST returns 0 rows (empty array) which triggers:
      // "Cannot coerce the result to a single JSON object".
      const u = await supabase.from("news_items").update(updatePayload).eq("id", editingId).select("id");
      if (u.error && /video_url/i.test(String(u.error.message ?? ""))) {
        const legacyPayload = { ...updatePayload };
        delete (legacyPayload as any).video_url;
        const retry = await supabase.from("news_items").update(legacyPayload).eq("id", editingId).select("id");
        if (retry.error) {
          const msg = humanizeNewsError(retry.error.message ?? "No se pudo actualizar.");
          setStatus(msg);
          toast.error(msg);
          setLoading(false);
          return;
        }
        const warn =
          "Noticia actualizada, pero falta la columna video_url en news_items. Ejecuta `supabase/news_items_video_url.sql` para habilitar video en noticias.";
        setStatus(warn);
        toast.error("Falta migración video_url en news_items.");
        setLoading(false);
        await loadItems();
        resetForm();
        router.refresh();
        return;
      }
      if (u.error) {
        const msg = humanizeNewsError(u.error.message ?? "No se pudo actualizar.");
        setStatus(msg);
        toast.error(msg);
        setLoading(false);
        return;
      }
      if (!u.data || (Array.isArray(u.data) && u.data.length === 0)) {
        const msg = "No se pudo actualizar (sin permisos o la noticia no existe).";
        setStatus(msg);
        toast.error(msg);
        setLoading(false);
        return;
      }

      // Reload list (best-effort) to reflect changes immediately.
      await loadItems();
      setStatus("Noticia actualizada.");
      toast.success("Noticia actualizada.");
    } else {
      const createPayload = {
        ...payload,
        author_id: userId,
        published_at: publishNow ? new Date().toISOString() : null
      };
      const insertRes = await supabase.from("news_items").insert(createPayload).select().limit(1);
      let inserted = Array.isArray(insertRes.data) ? (insertRes.data[0] as { id: string; slug?: string | null } | undefined) : undefined;
      let error = insertRes.error;

      if (error && /video_url/i.test(String(error.message ?? ""))) {
        const legacyPayload = { ...createPayload } as any;
        delete legacyPayload.video_url;
        const retry = await supabase.from("news_items").insert(legacyPayload).select().limit(1);
        inserted = Array.isArray(retry.data) ? (retry.data[0] as { id: string; slug?: string | null } | undefined) : undefined;
        error = retry.error;
        if (!error && inserted?.id) {
          setStatus(
            "Noticia publicada, pero falta la columna video_url en news_items. Ejecuta `supabase/news_items_video_url.sql` para habilitar video en noticias."
          );
          toast.error("Falta migración video_url en news_items.");
        }
      }
      if (error || !inserted?.id) {
        const msg = humanizeNewsError(error?.message ?? "No se pudo publicar la noticia.");
        setStatus(msg);
        toast.error(msg);
        setLoading(false);
        return;
      }
      setStatus("Noticia publicada.");
      toast.success("Noticia publicada.");

      if (postToFacebook && publishNow) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) {
          setStatus("Noticia publicada, pero no se pudo postear a Facebook (sesión inválida).");
          toast.error("No se pudo postear a Facebook (sesión inválida).");
        } else {
          const res = await fetch("/api/social/meta/facebook/post-news", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              newsId: inserted.id,
              newsSlug: inserted.slug ?? null,
              title,
              summary
            })
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) {
            setStatus(`Noticia publicada, pero Facebook falló: ${json?.error ?? "error"}`);
            toast.error(`Facebook falló: ${json?.error ?? "error"}`);
          } else {
            setStatus("Noticia publicada y posteada en Facebook.");
            toast.success("Posteada en Facebook.");
          }
        }
      }
    }

    setLoading(false);
    resetForm();
    await loadItems(); // ensure UI stays in sync after create/update
    router.refresh();
  };

  const handleEdit = (item: NewsItem) => {
    setEditingId(item.id);
    setEditingPublishedAt(item.published_at ?? null);
    setTitle(item.title ?? "");
    setSummary(item.summary ?? "");
    setAnalysis(item.analysis ?? "");
    setSourceUrl(item.source_url ?? "");
    setCoverUrl(item.cover_url ?? "");
    setVideoUrl(item.video_url ?? "");
    setCategories(item.categories && item.categories.length > 0 ? item.categories : [newsCategories[0]]);
    setTags(item.tags?.join(", ") ?? "");
    setPublishNow((item.publication_state ?? "published") !== "draft");
  };

  const handleStateChange = async (item: NewsItem, next: "draft" | "published") => {
    const payload: Record<string, any> = { publication_state: next };
    payload.published_at = next === "published" ? item.published_at ?? new Date().toISOString() : null;
    const { error } = await supabase.from("news_items").update(payload).eq("id", item.id);
    if (error) {
      const msg = humanizeNewsError(error.message);
      setStatus(msg);
      toast.error(msg);
      return;
    }
    toast.success(next === "published" ? "Noticia publicada." : "Noticia pasada a borrador.");
    await loadItems();
  };

  const handlePostToFacebookNow = async (item: NewsItem) => {
    if ((item.publication_state ?? "published") === "draft") {
      const msg = "Publica la noticia primero antes de enviarla a Facebook.";
      setStatus(msg);
      toast.error(msg);
      return;
    }

    setPostingFacebookId(item.id);
    setStatus(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      const msg = "Sesión inválida. Inicia sesión de nuevo.";
      setStatus(msg);
      toast.error(msg);
      setPostingFacebookId(null);
      return;
    }

    const res = await fetch("/api/social/meta/facebook/post-news", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        newsId: item.id,
        newsSlug: item.slug ?? null,
        title: item.title,
        summary: item.summary ?? ""
      })
    });
    const json = await res.json().catch(() => ({}));
    setPostingFacebookId(null);
    if (!res.ok) {
      const msg = `Facebook falló: ${json?.error ?? "error"}`;
      setStatus(msg);
      toast.error(msg);
      return;
    }
    const msg = "Noticia publicada en Facebook.";
    setStatus(msg);
    toast.success(msg);
  };

  const handleRewriteWithAI = async (item: NewsItem) => {
    setRewritingId(item.id);
    setStatus(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      const msg = "Sesión inválida. Inicia sesión de nuevo.";
      setStatus(msg);
      toast.error(msg);
      setRewritingId(null);
      return;
    }

    const res = await fetch("/api/admin/news/rewrite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        newsId: item.id,
        shouldPublish: (item.publication_state ?? "draft") === "published",
        autoPostFacebook: false,
        runNow: true
      })
    });
    const json = await res.json().catch(() => ({}));
    setRewritingId(null);
    if (!res.ok || !json?.ok) {
      const msg = json?.error ?? "No se pudo encolar reescritura IA.";
      setStatus(msg);
      toast.error(msg);
      return;
    }
    const msg = json?.alreadyQueued ? "Esta noticia ya tiene reescritura en cola." : "Reescritura IA encolada.";
    setStatus(msg);
    toast.success(msg);
    await loadItems();
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
          Video (Google Drive / YouTube / Vimeo opcional)
          <input
            className="input"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://drive.google.com/... | https://youtube.com/... | https://vimeo.com/..."
          />
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
        {!editingId ? (
          <label className="check-row">
            <input type="checkbox" checked={postToFacebook} onChange={(e) => setPostToFacebook(e.target.checked)} />
            Postear también en Facebook (con link a la noticia)
          </label>
        ) : null}
        <label className="check-row">
          <input type="checkbox" checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} />
          Publicar ahora (si se desmarca, queda como borrador)
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
        <h3 style={{ marginTop: 0 }}>Noticias (publicadas y borradores)</h3>
        {items.length > 0 ? (
          <div className="list" style={{ marginTop: 12 }}>
            {items.map((item) => (
              <div key={item.id} className="card" style={{ display: "grid", gap: 10 }}>
                <strong>{item.title}</strong>
                <span className="muted" style={{ fontSize: 12 }}>
                  {(item.categories ?? []).join(" · ")} · {(item.publication_state ?? "published").toUpperCase()} ·{" "}
                  {item.published_at ? new Date(item.published_at).toLocaleDateString("es-PR") : "sin fecha"}
                </span>
                {item.video_url ? (
                  <span className="muted" style={{ fontSize: 12 }}>
                    Video: configurado
                  </span>
                ) : null}
                <span className="muted" style={{ fontSize: 12 }}>
                  IA: {(item.rewrite_status ?? "none").toUpperCase()}
                  {item.needs_review ? " · REVISIÓN" : ""}
                  {item.rewrite_error ? ` · ${item.rewrite_error}` : ""}
                </span>
                <div className="admin-item-actions">
                  <button className="button secondary" type="button" onClick={() => handleEdit(item)}>
                    Editar
                  </button>
                  <button
                    className="button secondary"
                    type="button"
                    disabled={rewritingId === item.id}
                    onClick={() => handleRewriteWithAI(item)}
                  >
                    {rewritingId === item.id ? "Reescribiendo..." : "Reescribir IA"}
                  </button>
                  {(item.publication_state ?? "published") === "draft" ? (
                    <button className="button secondary" type="button" onClick={() => handleStateChange(item, "published")}>
                      Publicar
                    </button>
                  ) : (
                    <button className="button secondary" type="button" onClick={() => handleStateChange(item, "draft")}>
                      Borrador
                    </button>
                  )}
                  <a className="button secondary" href={newsHref(item)} target="_blank" rel="noreferrer">
                    Ver pública
                  </a>
                  <button
                    className="button secondary"
                    type="button"
                    disabled={postingFacebookId === item.id}
                    onClick={() => handlePostToFacebookNow(item)}
                  >
                    {postingFacebookId === item.id ? "Posteando..." : "Publicar en Facebook"}
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
