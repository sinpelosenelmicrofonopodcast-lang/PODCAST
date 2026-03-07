"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AdminDeleteButton } from "@/components/AdminDeleteButton";
import { toast } from "@/lib/toast";
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
  episode_url?: string | null;
  episode_title?: string | null;
  created_at: string | null;
};

type BlogSchemaCheck = {
  table: string;
  healthy: boolean;
  missingRequired: string[];
  missingRecommended: string[];
};

const BLOG_COMPAT_COLUMNS_REGEX = /(slug|meta_description|reading_time_minutes|categories|tags|updated_at|episode_url|episode_title)/i;

function isBlogCompatibilityColumnError(message?: string | null) {
  return BLOG_COMPAT_COLUMNS_REGEX.test(String(message ?? ""));
}

function postHref(post: { id: string; slug?: string | null }) {
  const slug = String(post.slug ?? "").trim();
  return `/blog/${slug || post.id}`;
}

function humanizeBlogError(raw?: string | null) {
  const msg = String(raw ?? "").trim();
  if (!msg) return "No se pudo guardar el artículo.";
  if (
    msg.includes("blog_posts_source_hash_unique") ||
    msg.includes("blog_posts_slug_unique") ||
    msg.toLowerCase().includes("duplicate key value")
  ) {
    return "Duplicado detectado: slug o fuente/contenido ya existe.";
  }
  return msg;
}

export default function AdminBlogPage() {
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [body, setBody] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [episodeUrl, setEpisodeUrl] = useState("");
  const [episodeTitle, setEpisodeTitle] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState("");
  const [inlineVideoUrl, setInlineVideoUrl] = useState("");
  const [inlineVideoTitle, setInlineVideoTitle] = useState("");
  const [inlineLinkText, setInlineLinkText] = useState("");
  const [inlineLinkUrl, setInlineLinkUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [items, setItems] = useState<BlogPost[]>([]);
  const [postToFacebook, setPostToFacebook] = useState(true);
  const [pushOnPublish, setPushOnPublish] = useState(true);
  const [postToInstagram, setPostToInstagram] = useState(false);
  const [postingFacebookId, setPostingFacebookId] = useState<string | null>(null);
  const [postingInstagramId, setPostingInstagramId] = useState<string | null>(null);
  const [scheduleFacebookAt, setScheduleFacebookAt] = useState("");
  const [scheduleItemFacebookAt, setScheduleItemFacebookAt] = useState<Record<string, string>>({});
  const [schedulingFacebookId, setSchedulingFacebookId] = useState<string | null>(null);
  const [schema, setSchema] = useState<BlogSchemaCheck | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const router = useRouter();

  const loadItems = async () => {
    // Column-safe: don't break admin if migrations haven't been applied yet.
    const primary = await supabase
      .from("blog_posts")
      .select(
        "id, slug, title, excerpt, meta_description, body, cover_url, episode_url, episode_title, created_at, reading_time_minutes, categories, tags"
      )
      .order("created_at", { ascending: false });
    if (primary.error && isBlogCompatibilityColumnError(primary.error.message)) {
      const fallback = await supabase
        .from("blog_posts")
        .select("id, title, excerpt, body, cover_url, created_at")
        .order("created_at", { ascending: false });
      setItems((fallback.data as BlogPost[]) ?? []);
      return;
    }
    setItems((primary.data as BlogPost[]) ?? []);
  };

  const checkSchema = async () => {
    setSchemaLoading(true);
    setSchemaError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setSchemaError("No se pudo validar esquema: sesión inválida.");
      setSchemaLoading(false);
      return;
    }

    const res = await fetch("/api/admin/schema/blog-posts", { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) {
      setSchemaError(json?.error ?? `No se pudo validar esquema (HTTP ${res.status}).`);
      setSchemaLoading(false);
      return;
    }

    setSchema(json as BlogSchemaCheck);
    setSchemaLoading(false);
  };

  useEffect(() => {
    loadItems();
    checkSchema();
  }, []);

  const resetForm = () => {
    setTitle("");
    setExcerpt("");
    setMetaDescription("");
    setSlug("");
    setBody("");
    setCoverUrl("");
    setEpisodeUrl("");
    setEpisodeTitle("");
    setCategories([]);
    setTags("");
    setInlineVideoUrl("");
    setInlineVideoTitle("");
    setInlineLinkText("");
    setInlineLinkUrl("");
    setEditingId(null);
    setPostToFacebook(true);
    setPushOnPublish(true);
    setPostToInstagram(false);
    setScheduleFacebookAt("");
  };

  const pushBlogNotification = async (
    token: string,
    post: { id: string; slug?: string | null; title?: string | null; excerpt?: string | null; cover_url?: string | null }
  ) => {
    const url = postHref({ id: post.id, slug: post.slug ?? null });
    const res = await fetch("/api/admin/notifications/onesignal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        title: post.title ?? "Nuevo blog",
        message: post.excerpt ?? "Nuevo artículo del blog en Sin Pelos en el Micrófono.",
        url,
        imageUrl: post.cover_url ?? null,
        category: "blog"
      })
    }).catch(() => null);
    const json = (res ? await res.json().catch(() => ({})) : {}) as { ok?: boolean; error?: string };
    if (!res || !res.ok || !json?.ok) {
      throw new Error(json?.error ?? "No se pudo enviar push.");
    }
  };

  const insertAtCursor = (snippet: string) => {
    const textarea = bodyRef.current;
    if (!textarea) {
      setBody((prev) => `${prev}${prev ? "\n" : ""}${snippet}`);
      return;
    }

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    setBody((prev) => {
      const before = prev.slice(0, start);
      const after = prev.slice(end);
      return `${before}${snippet}${after}`;
    });

    const nextPos = start + snippet.length;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextPos, nextPos);
    });
  };

  const insertVideoAtCursor = () => {
    const url = inlineVideoUrl.trim();
    if (!url) {
      setStatus("Pega primero el URL del video para insertarlo.");
      return;
    }
    const titlePart = inlineVideoTitle.trim() ? ` | ${inlineVideoTitle.trim()}` : "";
    insertAtCursor(`\n::video ${url}${titlePart}\n\n`);
    setStatus("Video insertado en el punto actual del contenido.");
  };

  const insertLinkAtCursor = () => {
    const text = inlineLinkText.trim();
    const url = inlineLinkUrl.trim();
    if (!text || !url) {
      setStatus("Completa texto y URL para insertar el enlace.");
      return;
    }
    insertAtCursor(`[${text}](${url})`);
    setStatus("Enlace insertado en el punto actual del contenido.");
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
      episode_url: episodeUrl.trim() ? episodeUrl.trim() : null,
      episode_title: episodeTitle.trim() ? episodeTitle.trim() : null,
      author_id: userId,
      updated_at: new Date().toISOString()
    };

    const minimalPayload = { title, excerpt: excerpt || null, body: body || null, cover_url: coverUrl || null, author_id: userId };
    const mode = editingId ? "update" : "insert";
    let error: { message?: string | null } | null = null;
    let usedFallback = false;
    let fallbackReason = "";
    let createdPost: { id: string; slug?: string | null; title?: string | null; excerpt?: string | null; cover_url?: string | null } | null = null;

    if (editingId) {
      const updateRes = await supabase.from("blog_posts").update(payloadBase).eq("id", editingId);
      error = updateRes.error;
      if (error && isBlogCompatibilityColumnError(error.message)) {
        usedFallback = true;
        fallbackReason = String(error.message ?? "");
        const fallback = await supabase.from("blog_posts").update(minimalPayload).eq("id", editingId);
        error = fallback.error;
      }
    } else {
      const insertRes = await supabase
        .from("blog_posts")
        .insert(payloadBase)
        .select("id, slug, title, excerpt, cover_url")
        .limit(1)
        .maybeSingle();
      error = insertRes.error;
      createdPost = (insertRes.data as any) ?? null;

      if (error && isBlogCompatibilityColumnError(error.message)) {
        usedFallback = true;
        fallbackReason = String(error.message ?? "");
        const fallback = await supabase
          .from("blog_posts")
          .insert(minimalPayload)
          .select("id, title, excerpt, cover_url")
          .limit(1)
          .maybeSingle();
        error = fallback.error;
        createdPost = (fallback.data as any) ?? null;
      }
    }

    if (error) return setStatus(humanizeBlogError(error.message)), void setLoading(false);
    if (usedFallback) {
      setStatus(
        `Artículo ${mode === "update" ? "actualizado" : "publicado"} en modo compatibilidad. Faltan columnas en blog_posts: ${fallbackReason}`
      );
    } else {
      setStatus(mode === "update" ? "Artículo actualizado." : "Artículo publicado.");
    }

    if (!editingId && createdPost?.id) {
      if (pushOnPublish) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (token) {
          await pushBlogNotification(token, {
            id: createdPost.id,
            slug: createdPost.slug ?? safeSlug,
            title: createdPost.title ?? title,
            excerpt: createdPost.excerpt ?? excerpt,
            cover_url: createdPost.cover_url ?? coverUrl
          }).catch((e: any) => {
            setStatus((prev) =>
              `${prev ? `${prev} ` : ""}Push falló: ${e?.message ?? "error"}`.trim()
            );
            toast.error(`Push falló: ${e?.message ?? "error"}`);
          });
        }
      }
    }

    if (!editingId && createdPost?.id && (postToFacebook || postToInstagram)) {
      const done: string[] = [];
      const failed: string[] = [];
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        if (postToFacebook) failed.push("Facebook: sesión inválida");
        if (postToInstagram) failed.push("Instagram: sesión inválida");
      } else {
        if (postToFacebook) {
          let scheduleIso: string | null = null;
          const scheduleRaw = scheduleFacebookAt.trim();
          let scheduleInvalid = false;
          if (scheduleRaw) {
            const parsed = new Date(scheduleRaw);
            if (!Number.isFinite(parsed.getTime())) {
              failed.push("Facebook: fecha de programación inválida");
              scheduleInvalid = true;
            } else {
              scheduleIso = parsed.toISOString();
            }
          }

          if (!scheduleInvalid) {
            const fbRes = await fetch("/api/social/meta/facebook/post-blog", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({
                blogId: createdPost.id,
                blogSlug: (createdPost.slug ?? safeSlug) || null,
                title: createdPost.title ?? title,
                excerpt: createdPost.excerpt ?? excerpt,
                scheduleFor: scheduleIso
              })
            });
            const fbJson = await fbRes.json().catch(() => ({}));
            if (!fbRes.ok) failed.push(`Facebook: ${fbJson?.error ?? "error"}`);
            else done.push(fbJson?.queued ? "Facebook (programado)" : "Facebook");
          }
        }

        if (postToInstagram) {
          const igRes = await fetch("/api/social/meta/instagram/post-blog", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              blogId: createdPost.id,
              blogSlug: (createdPost.slug ?? safeSlug) || null,
              title: createdPost.title ?? title,
              excerpt: createdPost.excerpt ?? excerpt,
              coverUrl: (createdPost.cover_url ?? coverUrl) || null
            })
          });
          const igJson = await igRes.json().catch(() => ({}));
          if (!igRes.ok) failed.push(`Instagram: ${igJson?.error ?? "error"}`);
          else done.push("Instagram");
        }
      }

      if (done.length > 0 && failed.length === 0) {
        setStatus(`Artículo publicado y compartido en ${done.join(" + ")}.`);
      } else if (done.length > 0 && failed.length > 0) {
        setStatus(`Artículo publicado. OK: ${done.join(" + ")}. Falló: ${failed.join(" | ")}.`);
      } else if (failed.length > 0) {
        setStatus(`Artículo publicado, pero falló redes: ${failed.join(" | ")}.`);
      }
    }

    setLoading(false);
    resetForm();
    await loadItems();
    await checkSchema();
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
    setEpisodeUrl(String((item as any).episode_url ?? ""));
    setEpisodeTitle(String((item as any).episode_title ?? ""));
    setCategories((item as any).categories ?? []);
    setTags(((item as any).tags ?? []).join(", "));
  };

  const handlePostToFacebookNow = async (item: BlogPost) => {
    setPostingFacebookId(item.id);
    setStatus(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      const msg = "Sesión inválida. Inicia sesión de nuevo.";
      setStatus(msg);
      setPostingFacebookId(null);
      return;
    }

    const res = await fetch("/api/social/meta/facebook/post-blog", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        blogId: item.id,
        blogSlug: item.slug ?? null,
        title: item.title,
        excerpt: item.excerpt ?? ""
      })
    });
    const json = await res.json().catch(() => ({}));
    setPostingFacebookId(null);
    if (!res.ok) {
      setStatus(`Facebook falló: ${json?.error ?? "error"}`);
      return;
    }
    setStatus("Artículo publicado en Facebook.");
  };

  const handleScheduleToFacebook = async (item: BlogPost) => {
    const localValue = String(scheduleItemFacebookAt[item.id] ?? "").trim();
    if (!localValue) {
      setStatus("Selecciona fecha y hora para programar.");
      return;
    }

    const parsed = new Date(localValue);
    if (!Number.isFinite(parsed.getTime())) {
      setStatus("Fecha/hora inválida para programar.");
      return;
    }

    setSchedulingFacebookId(item.id);
    setStatus(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      const msg = "Sesión inválida. Inicia sesión de nuevo.";
      setStatus(msg);
      setSchedulingFacebookId(null);
      return;
    }

    const res = await fetch("/api/social/meta/facebook/post-blog", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        blogId: item.id,
        blogSlug: item.slug ?? null,
        title: item.title,
        excerpt: item.excerpt ?? "",
        scheduleFor: parsed.toISOString()
      })
    });
    const json = await res.json().catch(() => ({}));
    setSchedulingFacebookId(null);
    if (!res.ok || !json?.ok) {
      setStatus(`Schedule Facebook falló: ${json?.error ?? "error"}`);
      return;
    }

    const scheduled = json?.scheduledFor ? new Date(json.scheduledFor).toLocaleString("es-PR") : localValue;
    setStatus(`Artículo programado en Facebook para ${scheduled}.`);
  };

  const handlePostToInstagramNow = async (item: BlogPost) => {
    if (!item.cover_url) {
      setStatus("Instagram requiere portada (cover_url) para publicar.");
      return;
    }

    setPostingInstagramId(item.id);
    setStatus(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      const msg = "Sesión inválida. Inicia sesión de nuevo.";
      setStatus(msg);
      setPostingInstagramId(null);
      return;
    }

    const res = await fetch("/api/social/meta/instagram/post-blog", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        blogId: item.id,
        blogSlug: item.slug ?? null,
        title: item.title,
        excerpt: item.excerpt ?? "",
        coverUrl: item.cover_url
      })
    });
    const json = await res.json().catch(() => ({}));
    setPostingInstagramId(null);
    if (!res.ok) {
      setStatus(`Instagram falló: ${json?.error ?? "error"}`);
      return;
    }
    setStatus("Artículo publicado en Instagram.");
  };

  return (
    <main>
      <h1 className="section-title">Blog (Admin)</h1>
      <p className="muted">Estructura recomendada: usa headings con "##" para H2 y "###" para H3.</p>
      {schemaError ? (
        <div className="card" style={{ marginTop: 14, borderColor: "rgba(255, 122, 24, 0.5)" }}>
          <strong>Validación de esquema no disponible</strong>
          <p className="muted" style={{ marginBottom: 0 }}>
            {schemaError}
          </p>
        </div>
      ) : null}
      {!schemaLoading && schema && (!schema.healthy || schema.missingRecommended.length > 0) ? (
        <div className="card" style={{ marginTop: 14, borderColor: "rgba(255, 122, 24, 0.5)" }}>
          <strong>{schema.healthy ? "Faltan columnas recomendadas en blog_posts" : "Faltan columnas críticas en blog_posts"}</strong>
          <div className="muted" style={{ marginTop: 8, display: "grid", gap: 6 }}>
            {schema.missingRequired.length > 0 ? (
              <span>Críticas: {schema.missingRequired.join(", ")}</span>
            ) : (
              <span>Críticas: ninguna</span>
            )}
            {schema.missingRecommended.length > 0 ? <span>Recomendadas: {schema.missingRecommended.join(", ")}</span> : null}
            <span>
              Ejecuta migración en Supabase SQL Editor: <code>supabase/blog_posts_seo.sql</code>
            </span>
          </div>
        </div>
      ) : null}
      <div className="form-submit-bar" style={{ marginTop: 14 }}>
        <button className="button secondary" type="button" onClick={checkSchema} disabled={schemaLoading}>
          {schemaLoading ? "Revisando esquema..." : "Revisar esquema blog_posts"}
        </button>
      </div>
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
          <div className="blog-editor-tools" style={{ marginTop: 10 }}>
            <button className="button secondary" type="button" onClick={() => insertAtCursor("\n## Nuevo subtítulo\n\n")}>
              + H2
            </button>
            <button className="button secondary" type="button" onClick={() => insertAtCursor("\n### Subtema\n\n")}>
              + H3
            </button>
            <button className="button secondary" type="button" onClick={() => insertAtCursor("\n> Cita destacada\n\n")}>
              + Cita
            </button>
            <button className="button secondary" type="button" onClick={() => insertAtCursor("\n- Punto 1\n- Punto 2\n\n")}>
              + Lista
            </button>
            <button className="button secondary" type="button" onClick={() => insertAtCursor("\n---\n\n")}>
              + Línea divisora
            </button>
          </div>
          <div className="blog-editor-video-tools" style={{ marginTop: 10 }}>
            <input
              className="input"
              value={inlineVideoUrl}
              onChange={(e) => setInlineVideoUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
            />
            <input
              className="input"
              value={inlineVideoTitle}
              onChange={(e) => setInlineVideoTitle(e.target.value)}
              placeholder="Título del video (opcional)"
            />
            <button className="button secondary" type="button" onClick={insertVideoAtCursor}>
              Insertar video en cursor
            </button>
          </div>
          <div className="blog-editor-link-tools" style={{ marginTop: 10 }}>
            <input
              className="input"
              value={inlineLinkText}
              onChange={(e) => setInlineLinkText(e.target.value)}
              placeholder="Texto del enlace (ej: ver fuente oficial)"
            />
            <input
              className="input"
              value={inlineLinkUrl}
              onChange={(e) => setInlineLinkUrl(e.target.value)}
              placeholder="https://..."
            />
            <button className="button secondary" type="button" onClick={insertLinkAtCursor}>
              Insertar enlace en cursor
            </button>
          </div>
          <textarea
            ref={bodyRef}
            className="textarea"
            rows={12}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={`Escribe el artículo aquí...

## Sección principal
Párrafo normal.

[Ver fuente original](https://ejemplo.com/fuente)

::video https://www.youtube.com/watch?v=VIDEO_ID | Título opcional

![Descripción de imagen](https://url-de-imagen.jpg)

---

> Cita o punchline
`}
          />
          <div className="muted" style={{ fontSize: 12 }}>
            Tipos soportados en el cuerpo: H2/H3 con ##/###, listas, citas (&gt;), divisor (---), enlaces [texto](url), imagen en línea con
            ![]() y video con ::video URL.
          </div>
        </label>
        <label>
          Episodio relacionado (URL)
          <input
            className="input"
            value={episodeUrl}
            onChange={(e) => setEpisodeUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=... (o link del episodio)"
          />
          <div className="muted" style={{ fontSize: 12 }}>
            Si el artículo es sobre un episodio, este link se muestra arriba (con embed si es YouTube).
          </div>
        </label>
        <label>
          Título del episodio (opcional)
          <input className="input" value={episodeTitle} onChange={(e) => setEpisodeTitle(e.target.value)} placeholder="Ej: Episodio 142 — ..." />
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
        {!editingId ? (
          <label className="check-row">
            <input type="checkbox" checked={postToFacebook} onChange={(e) => setPostToFacebook(e.target.checked)} />
            Compartir también en Facebook (resumen + link)
          </label>
        ) : null}
        {!editingId && postToFacebook ? (
          <label>
            Programar Facebook (opcional)
            <input
              className="input"
              type="datetime-local"
              value={scheduleFacebookAt}
              onChange={(e) => setScheduleFacebookAt(e.target.value)}
            />
          </label>
        ) : null}
        {!editingId ? (
          <label className="check-row">
            <input type="checkbox" checked={pushOnPublish} onChange={(e) => setPushOnPublish(e.target.checked)} />
            Enviar push de blog al publicar
          </label>
        ) : null}
        {!editingId ? (
          <label className="check-row">
            <input type="checkbox" checked={postToInstagram} onChange={(e) => setPostToInstagram(e.target.checked)} />
            Compartir también en Instagram (requiere portada)
          </label>
        ) : null}
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
                <label>
                  Programar Facebook (opcional)
                  <input
                    className="input"
                    type="datetime-local"
                    value={scheduleItemFacebookAt[item.id] ?? ""}
                    onChange={(e) => setScheduleItemFacebookAt((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  />
                </label>
                <div className="admin-item-actions">
                  <button className="button secondary" type="button" onClick={() => handleEdit(item)}>
                    Editar
                  </button>
                  <a className="button secondary" href={postHref(item)} target="_blank" rel="noreferrer">
                    Ver publico
                  </a>
                  <button
                    className="button secondary"
                    type="button"
                    disabled={postingFacebookId === item.id}
                    onClick={() => handlePostToFacebookNow(item)}
                  >
                    {postingFacebookId === item.id ? "Posteando..." : "Publicar en Facebook"}
                  </button>
                  <button
                    className="button secondary"
                    type="button"
                    disabled={schedulingFacebookId === item.id}
                    onClick={() => handleScheduleToFacebook(item)}
                  >
                    {schedulingFacebookId === item.id ? "Programando..." : "Programar Facebook"}
                  </button>
                  <button
                    className="button secondary"
                    type="button"
                    disabled={postingInstagramId === item.id}
                    onClick={() => handlePostToInstagramNow(item)}
                  >
                    {postingInstagramId === item.id ? "Posteando..." : "Publicar en Instagram"}
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
