"use client";

import { useEffect, useMemo, useState } from "react";
import { canUseSkin, type MicBrawlProfile, type MicBrawlSkin } from "@/lib/micBrawl";

type SkinsResponse = {
  ok: boolean;
  items: MicBrawlSkin[];
  error?: string;
};

type ProfileResponse = {
  ok: boolean;
  authenticated: boolean;
  profile: MicBrawlProfile | null;
};

export function Skins() {
  const [loading, setLoading] = useState(true);
  const [savingSkinId, setSavingSkinId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skins, setSkins] = useState<MicBrawlSkin[]>([]);
  const [profile, setProfile] = useState<MicBrawlProfile | null>(null);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      const [skinsRes, profileRes] = await Promise.all([
        fetch("/api/mic-brawl/skins", { cache: "no-store" }).catch(() => null),
        fetch("/api/mic-brawl/profile", { cache: "no-store" }).catch(() => null)
      ]);
      if (!mounted) return;

      const skinsJson = (await skinsRes?.json().catch(() => null)) as SkinsResponse | null;
      const profileJson = (await profileRes?.json().catch(() => null)) as ProfileResponse | null;

      if (!skinsRes?.ok) setError(skinsJson?.error ?? "No se pudieron cargar skins.");
      setSkins(skinsJson?.items ?? []);
      setProfile(profileJson?.profile ?? null);
      setAuthenticated(Boolean(profileJson?.authenticated));
      setLoading(false);
    };
    run();
    return () => {
      mounted = false;
    };
  }, []);

  const wins = profile?.wins ?? 0;
  const equipped = profile?.equipped_skin ?? "classic";
  const ordered = useMemo(
    () =>
      [...skins].sort((a, b) => {
        const aw = a.unlock_wins ?? -1;
        const bw = b.unlock_wins ?? -1;
        return aw - bw;
      }),
    [skins]
  );

  const equip = async (skinId: string) => {
    setSavingSkinId(skinId);
    setError(null);
    const res = await fetch("/api/mic-brawl/skin/equip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skinId })
    }).catch(() => null);
    setSavingSkinId(null);
    if (!res?.ok) {
      const json = await res?.json().catch(() => null);
      setError(json?.error ?? "No se pudo equipar la skin.");
      return;
    }
    setProfile((prev) => (prev ? { ...prev, equipped_skin: skinId } : prev));
  };

  return (
    <section className="card">
      <h1 style={{ marginTop: 0 }}>Skins</h1>
      <p className="muted">Classic, Neon y Gold. Neon se desbloquea con 3 wins, Gold con 10.</p>

      {loading ? <p className="muted">Cargando skins...</p> : null}
      {error ? <p style={{ color: "#ff7a18" }}>{error}</p> : null}

      {!loading ? (
        <div className="mic-brawl-skins-grid">
          {ordered.map((skin) => {
            const unlocked = canUseSkin(skin, wins);
            const isEquipped = equipped === skin.id;
            return (
              <article key={skin.id} className="card mic-brawl-skin-card">
                <div className="mic-brawl-skin-swatch" style={{ background: (skin.palette?.body as string) || "#ddd" }}>
                  <span style={{ background: (skin.palette?.accent as string) || "#ff3b30" }} />
                </div>
                <div>
                  <strong>{skin.display_name}</strong>
                  <p className="muted" style={{ margin: "6px 0" }}>
                    {skin.unlock_wins == null ? "Disponible por defecto" : `Requiere ${skin.unlock_wins} victorias`}
                  </p>
                  {!authenticated ? (
                    <span className="badge warn">Login requerido</span>
                  ) : !unlocked ? (
                    <span className="badge warn">Bloqueada</span>
                  ) : isEquipped ? (
                    <span className="badge">Equipada</span>
                  ) : (
                    <button className="button" disabled={savingSkinId === skin.id} onClick={() => equip(skin.id)} type="button">
                      Equipar
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

