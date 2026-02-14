"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Logo } from "@/components/Logo";
import { supabase } from "@/lib/supabaseClient";

export default function PerfilPage() {
  const [nickname, setNickname] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        setStatus("Debes iniciar sesión para editar tu perfil.");
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("users")
        .select("nickname, bio, avatar_url")
        .eq("id", userId)
        .single();
      if (error) {
        setStatus(error.message);
      } else if (data) {
        setNickname(data.nickname ?? "");
        setBio(data.bio ?? "");
        setAvatarUrl(data.avatar_url ?? "");
      }
      setLoading(false);
    };

    loadProfile();
  }, []);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setStatus(null);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setStatus("Debes iniciar sesión para subir avatar.");
      setUploading(false);
      return;
    }

    const ext = file.name.split(".").pop() ?? "png";
    const filePath = `avatars/${userId}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, {
      upsert: true,
      contentType: file.type
    });

    if (uploadError) {
      setStatus(uploadError.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
    if (data?.publicUrl) {
      setAvatarUrl(data.publicUrl);
      await supabase.from("users").update({ avatar_url: data.publicUrl }).eq("id", userId);
    }

    setUploading(false);
    setStatus("Avatar actualizado.");
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setStatus("Debes iniciar sesión para guardar tu perfil.");
      return;
    }
    const { error } = await supabase
      .from("users")
      .update({ nickname, bio, avatar_url: avatarUrl })
      .eq("id", userId);
    if (error) {
      setStatus(error.message);
      return;
    }
    setStatus("Perfil actualizado.");
  };

  return (
    <main className="app-enter">
      <Navbar />
      <section className="section">
        <div className="container" style={{ maxWidth: 620 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
            <Logo size={84} animated />
          </div>
          <h1 className="section-title" style={{ textAlign: "center" }}>
            Mi Perfil
          </h1>
          <form className="card" onSubmit={handleSave}>
            <label>
              Nickname
              <input className="input" value={nickname} onChange={(e) => setNickname(e.target.value)} required />
            </label>
            <label>
              Bio corta
              <textarea className="textarea" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
            </label>
            <label>
              Avatar actual (URL)
              <input
                className="input"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
              />
            </label>
            <label>
              Subir avatar
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
            <button className="button" type="submit" disabled={loading || uploading}>
              Guardar cambios
            </button>
            {status ? <p className="muted">{status}</p> : null}
          </form>
        </div>
      </section>
    </main>
  );
}
