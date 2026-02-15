"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export function ZonaCrudaComposer() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
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

    const { data: insertedThread, error } = await supabase.from("threads").insert({
      title,
      body,
      author_id: userId,
      space: "zona-cruda",
      visibility: "paid",
      status: "published"
    }).select("id").single();

    if (error) {
      setStatus((error as any)?.message ?? "No se pudo publicar.");
      setLoading(false);
      return;
    }

    const threadId = insertedThread?.id;
    if (!threadId) {
      setStatus("Publicado, pero no se pudo obtener el id del post.");
      setLoading(false);
      return;
    }

    // Upload attachments (optional). Limits: 1 short video OR up to 6 images.
    const selected = files ?? [];
    const videoFiles = selected.filter((f) => f.type.startsWith("video/"));
    const imageFiles = selected.filter((f) => f.type.startsWith("image/"));

    if (videoFiles.length > 1) {
      setStatus("Solo 1 video por post.");
      setLoading(false);
      return;
    }
    if (videoFiles.length === 1 && imageFiles.length > 0) {
      setStatus("No mezcles video e imágenes en el mismo post (por ahora).");
      setLoading(false);
      return;
    }
    if (imageFiles.length > 6) {
      setStatus("Máximo 6 imágenes por post.");
      setLoading(false);
      return;
    }
    const maxVideoBytes = 50 * 1024 * 1024;
    const maxImageBytes = 8 * 1024 * 1024;
    if (videoFiles[0] && videoFiles[0].size > maxVideoBytes) {
      setStatus("Video demasiado grande (máx 50MB).");
      setLoading(false);
      return;
    }
    if (imageFiles.some((f) => f.size > maxImageBytes)) {
      setStatus("Alguna imagen es demasiado grande (máx 8MB).");
      setLoading(false);
      return;
    }

    if (selected.length > 0) {
      const mediaInserts: Array<any> = [];
      for (const file of selected) {
        const ext = file.name.split(".").pop() || "bin";
        const safeExt = ext.toLowerCase().replace(/[^a-z0-9]+/g, "");
        const ts = Date.now();
        const path = `zona-cruda/${userId}/${ts}-${crypto.randomUUID()}.${safeExt}`;

        const upload = await supabase.storage.from("ugc").upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type
        });
        if (upload.error) {
          setStatus(`Error subiendo archivo: ${upload.error.message}`);
          setLoading(false);
          return;
        }

        mediaInserts.push({
          thread_id: threadId,
          storage_path: path,
          kind: file.type.startsWith("video/") ? "video" : "image",
          mime_type: file.type
        });
      }

      if (mediaInserts.length > 0) {
        const { error: mediaErr } = await supabase.from("thread_media").insert(mediaInserts);
        if (mediaErr) {
          setStatus(`Publicado, pero no se pudo guardar media: ${mediaErr.message}`);
        }
      }
    }

    setTitle("");
    setBody("");
    setFiles([]);
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
        <label style={{ display: "grid", gap: 6 }}>
          Adjuntar (imágenes o 1 video corto)
          <input
            className="input"
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          <span className="muted" style={{ fontSize: 12 }}>
            Máx: 6 imágenes (8MB c/u) o 1 video (50MB). No se permite mezclar por ahora.
          </span>
        </label>
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
