"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AdminDeleteButton } from "@/components/AdminDeleteButton";
import { newsCategories } from "@/lib/newsCategories";
import { toast } from "@/lib/toast";
import { newsHref } from "@/lib/newsRoute";
import { normalizeImageUrl } from "@/lib/imageUrl";

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
  const [pushOnPublish, setPushOnPublish] = useState(true);
  const [postingFacebookId, setPostingFacebookId] = useState<string | null>(null);
  const [postToInstagram, setPostToInstagram] = useState(false);
  const [postToInstagramStory, setPostToInstagramStory] = useState(false);
  const [postingInstagramId, setPostingInstagramId] = useState<string | null>(null);
  const [postingInstagramStoryId, setPostingInstagramStoryId] = useState<string | null>(null);
  const [scheduleFacebookAt, setScheduleFacebookAt] = useState("");
  const [scheduleItemFacebookAt, setScheduleItemFacebookAt] = useState<Record<string, string>>({});
  const [schedulingFacebookId, setSchedulingFacebookId] = useState<string | null>(null);
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
    setPushOnPublish(true);
    setPostToInstagram(false);
    setPostToInstagramStory(false);
    setScheduleFacebookAt("");
  };

  const pushNewsNotification = async (token: string, item: { id: string; slug?: string | null; title?: string | null; summary?: string | null; cover_url?: string | null }) => {
    const url = `/noticias/${encodeURIComponent(item.slug ?? item.id)}`;
    const res = await fetch("/api/admin/notifications/onesignal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        title: item.title ?? "Última hora",
        message: item.summary ?? "Nueva noticia publicada en Sin Pelos en el Micrófono.",
        url,
        imageUrl: item.cover_url ?? null,
        category: "noticias"
      })
    }).catch(() => null);
    const json = (res ? await res.json().catch(() => ({})) : {}) as { ok?: boolean; error?: string };
    if (!res || !res.ok || !json?.ok) {
      throw new Error(json?.error ?? "No se pudo enviar push.");
    }
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
      setCoverUrl(normalizeImageUrl(data.publicUrl) ?? data.publicUrl);
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
    const normalizedCoverUrl = normalizeImageUrl(coverUrl);

    const payload = {
      title,
      summary: summary ? summary : null,
      analysis: analysis ? analysis : null,
      source_url: sourceUrl ? sourceUrl : null,
      cover_url: normalizedCoverUrl ?? null,
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

      if (publishNow) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (token) {
          const canonicalPath = `/noticias/${encodeURIComponent(inserted.slug ?? inserted.id)}`;
          await fetch("/api/seo/enqueue", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ url: canonicalPath, type: "post" })
          }).catch(() => null);
          if (pushOnPublish) {
            await pushNewsNotification(token, {
              id: inserted.id,
              slug: inserted.slug ?? null,
              title,
              summary,
              cover_url: normalizedCoverUrl ?? null
            }).catch((e: any) => {
              toast.error(`Push falló: ${e?.message ?? "error"}`);
            });
          }
        }
      }

      if (publishNow && (postToFacebook || postToInstagram || postToInstagramStory)) {
        const done: string[] = [];
        const failed: string[] = [];
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;

        if (!token) {
          if (postToFacebook) failed.push("Facebook: sesión inválida");
          if (postToInstagram) failed.push("Instagram feed: sesión inválida");
          if (postToInstagramStory) failed.push("Instagram story: sesión inválida");
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
              const fbRes = await fetch("/api/social/meta/facebook/post-news", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                  newsId: inserted.id,
                  newsSlug: inserted.slug ?? null,
                  title,
                  summary,
                  scheduleFor: scheduleIso
                })
              });
              const fbJson = await fbRes.json().catch(() => ({}));
              if (!fbRes.ok) failed.push(`Facebook: ${fbJson?.error ?? "error"}`);
              else done.push(fbJson?.queued ? "Facebook (programado)" : "Facebook");
            }
          }

          if (postToInstagram) {
            const igRes = await fetch("/api/social/meta/instagram/post-news", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({
                  newsId: inserted.id,
                  newsSlug: inserted.slug ?? null,
                  title,
                  summary,
                  coverUrl: normalizedCoverUrl ?? null
                })
              });
            const igJson = await igRes.json().catch(() => ({}));
            if (!igRes.ok) failed.push(`Instagram feed: ${igJson?.error ?? "error"}`);
            else done.push("Instagram feed");
          }

          if (postToInstagramStory) {
            const igStoryRes = await fetch("/api/social/meta/instagram/post-news", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({
                newsId: inserted.id,
                newsSlug: inserted.slug ?? null,
                title,
                summary,
                coverUrl: normalizedCoverUrl ?? null,
                story: true
              })
            });
            const igStoryJson = await igStoryRes.json().catch(() => ({}));
            if (!igStoryRes.ok) failed.push(`Instagram story: ${igStoryJson?.error ?? "error"}`);
            else done.push("Instagram story");
          }
        }

        if (done.length > 0 && failed.length === 0) {
          const msg = `Noticia publicada y posteada en ${done.join(" + ")}.`;
          setStatus(msg);
          toast.success(msg);
        } else if (done.length > 0 && failed.length > 0) {
          const msg = `Noticia publicada. OK: ${done.join(" + ")}. Falló: ${failed.join(" | ")}.`;
          setStatus(msg);
          toast.error(msg);
        } else if (failed.length > 0) {
          const msg = `Noticia publicada, pero falló redes: ${failed.join(" | ")}.`;
          setStatus(msg);
          toast.error(msg);
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
    setCoverUrl(normalizeImageUrl(item.cover_url) ?? item.cover_url ?? "");
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
    if (next === "published") {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (token) {
        const canonicalPath = `/noticias/${encodeURIComponent(item.slug ?? item.id)}`;
        await fetch("/api/seo/enqueue", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ url: canonicalPath, type: "post" })
        }).catch(() => null);
        if (pushOnPublish) {
          await pushNewsNotification(token, {
            id: item.id,
            slug: item.slug ?? null,
            title: item.title,
            summary: item.summary ?? null,
            cover_url: normalizeImageUrl(item.cover_url) ?? null
          }).catch((e: any) => {
            toast.error(`Push falló: ${e?.message ?? "error"}`);
          });
        }
      }
    }
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

  const handleScheduleToFacebook = async (item: NewsItem) => {
    if ((item.publication_state ?? "published") === "draft") {
      const msg = "Publica la noticia primero antes de programarla en Facebook.";
      setStatus(msg);
      toast.error(msg);
      return;
    }

    const localValue = String(scheduleItemFacebookAt[item.id] ?? "").trim();
    if (!localValue) {
      const msg = "Selecciona fecha y hora para programar.";
      setStatus(msg);
      toast.error(msg);
      return;
    }

    const parsed = new Date(localValue);
    if (!Number.isFinite(parsed.getTime())) {
      const msg = "Fecha/hora inválida para programar.";
      setStatus(msg);
      toast.error(msg);
      return;
    }

    setSchedulingFacebookId(item.id);
    setStatus(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      const msg = "Sesión inválida. Inicia sesión de nuevo.";
      setStatus(msg);
      toast.error(msg);
      setSchedulingFacebookId(null);
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
        summary: item.summary ?? "",
        scheduleFor: parsed.toISOString()
      })
    });
    const json = await res.json().catch(() => ({}));
    setSchedulingFacebookId(null);
    if (!res.ok || !json?.ok) {
      const msg = `Schedule Facebook falló: ${json?.error ?? "error"}`;
      setStatus(msg);
      toast.error(msg);
      return;
    }

    const scheduled = json?.scheduledFor ? new Date(json.scheduledFor).toLocaleString("es-PR") : localValue;
    const msg = `Noticia programada en Facebook para ${scheduled}.`;
    setStatus(msg);
    toast.success(msg);
  };

  const handlePostToInstagramNow = async (item: NewsItem, story = false) => {
    if ((item.publication_state ?? "published") === "draft") {
      const msg = "Publica la noticia primero antes de enviarla a Instagram.";
      setStatus(msg);
      toast.error(msg);
      return;
    }
    const normalizedCover = normalizeImageUrl(item.cover_url);
    if (!normalizedCover) {
      const msg = "Instagram requiere portada (URL pública) para publicar.";
      setStatus(msg);
      toast.error(msg);
      return;
    }

    if (story) setPostingInstagramStoryId(item.id);
    else setPostingInstagramId(item.id);
    setStatus(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      const msg = "Sesión inválida. Inicia sesión de nuevo.";
      setStatus(msg);
      toast.error(msg);
      if (story) setPostingInstagramStoryId(null);
      else setPostingInstagramId(null);
      return;
    }

    const res = await fetch("/api/social/meta/instagram/post-news", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        newsId: item.id,
        newsSlug: item.slug ?? null,
        title: item.title,
        summary: item.summary ?? "",
        coverUrl: normalizedCover,
        story
      })
    });
    const json = await res.json().catch(() => ({}));
    if (story) setPostingInstagramStoryId(null);
    else setPostingInstagramId(null);
    if (!res.ok) {
      const msg = `Instagram ${story ? "story" : "feed"} falló: ${json?.error ?? "error"}`;
      setStatus(msg);
      toast.error(msg);
      return;
    }
    const msg = story ? "Noticia publicada en historia de Instagram." : "Noticia publicada en Instagram.";
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
          <input
            className="input"
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
            onBlur={(e) => setCoverUrl(normalizeImageUrl(e.target.value) ?? e.target.value.trim())}
            placeholder="https://..."
          />
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
            Enviar push de noticia al publicar
          </label>
        ) : null}
        {!editingId ? (
          <label className="check-row">
            <input type="checkbox" checked={postToInstagram} onChange={(e) => setPostToInstagram(e.target.checked)} />
            Postear también en Instagram (requiere portada)
          </label>
        ) : null}
        {!editingId ? (
          <label className="check-row">
            <input type="checkbox" checked={postToInstagramStory} onChange={(e) => setPostToInstagramStory(e.target.checked)} />
            Postear también en Instagram Story (requiere portada)
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
                  <button
                    className="button secondary"
                    type="button"
                    disabled={postingInstagramStoryId === item.id}
                    onClick={() => handlePostToInstagramNow(item, true)}
                  >
                    {postingInstagramStoryId === item.id ? "Posteando..." : "Publicar Story IG"}
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
