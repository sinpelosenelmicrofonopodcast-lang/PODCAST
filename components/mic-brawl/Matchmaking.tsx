"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DEFAULT_SKIN_ID, MIC_BRAWL_TITLE, type MicBrawlProfile } from "@/lib/micBrawl";

type ProfileResponse = {
  ok: boolean;
  authenticated: boolean;
  profile: MicBrawlProfile | null;
};

export function Matchmaking() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [profile, setProfile] = useState<MicBrawlProfile | null>(null);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      const res = await fetch("/api/mic-brawl/profile", { cache: "no-store" }).catch(() => null);
      if (!mounted) return;
      if (!res?.ok) {
        setAuthenticated(false);
        setProfile(null);
        setLoading(false);
        return;
      }
      const json = (await res.json().catch(() => null)) as ProfileResponse | null;
      setAuthenticated(Boolean(json?.authenticated));
      setProfile(json?.profile ?? null);
      setLoading(false);
    };
    run();
    return () => {
      mounted = false;
    };
  }, []);

  const stats = useMemo(() => {
    if (!profile) return null;
    return `${profile.wins}W · ${profile.losses}L · ${profile.kos} KOs · ${profile.matches} matches`;
  }, [profile]);

  const createRoom = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/mic-brawl/room/create", {
      method: "POST"
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const json = await res?.json().catch(() => null);
      setError(json?.error ?? "No se pudo crear sala.");
      return;
    }
    const json = await res.json().catch(() => null);
    if (!json?.room?.id) {
      setError("Respuesta inválida al crear sala.");
      return;
    }
    router.push(`/mic-brawl/play?room=${encodeURIComponent(json.room.id)}`);
  };

  const joinRoom = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/mic-brawl/room/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: roomCode || undefined })
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const json = await res?.json().catch(() => null);
      setError(json?.error ?? "No se pudo entrar a la sala.");
      return;
    }
    const json = await res.json().catch(() => null);
    if (!json?.room?.id) {
      setError("No se recibió sala.");
      return;
    }
    router.push(`/mic-brawl/play?room=${encodeURIComponent(json.room.id)}`);
  };

  return (
    <section className="card mic-brawl-matchmaking">
      <h1 style={{ marginTop: 0 }}>{MIC_BRAWL_TITLE}</h1>
      <p className="muted">SPM ARCADE · BEBO vs BITO · 2 jugadores online</p>

      {loading ? <p className="muted">Cargando perfil...</p> : null}
      {!loading && !authenticated ? (
        <div className="mic-brawl-grid-2">
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Play Online</h3>
            <p className="muted">Inicia sesión para jugar multiplayer, guardar stats y desbloquear skins.</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link className="button" href="/login?next=/mic-brawl">
                Entrar
              </Link>
              <Link className="button secondary" href="/register?next=/mic-brawl">
                Crear cuenta
              </Link>
            </div>
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Practice (Local AI)</h3>
            <p className="muted">Modo local para practicar controles y timing de mic swing.</p>
            <Link className="button" href="/mic-brawl/play?mode=practice">
              Jugar práctica
            </Link>
          </div>
        </div>
      ) : null}

      {!loading && authenticated ? (
        <>
          <div className="mic-brawl-profile-row">
            <div>
              <strong>{profile?.handle ?? "Jugador"}</strong>
              <p className="muted" style={{ margin: "4px 0 0" }}>
                {stats}
              </p>
            </div>
            <span className="badge">Skin: {profile?.equipped_skin ?? DEFAULT_SKIN_ID}</span>
          </div>

          <div className="mic-brawl-grid-2">
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Crear sala</h3>
              <p className="muted">Abre una sala y comparte el código/URL para que entre el segundo jugador.</p>
              <button className="button" disabled={busy} onClick={createRoom} type="button">
                {busy ? "Creando..." : "Crear room"}
              </button>
            </div>
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Unirse</h3>
              <p className="muted">Sin código entra a la primera sala disponible. Con código, entra directo.</p>
              <input
                className="input"
                placeholder="room id (opcional)"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
              />
              <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                <button className="button" disabled={busy} onClick={joinRoom} type="button">
                  {busy ? "Entrando..." : "Join room"}
                </button>
                <Link className="button secondary" href="/mic-brawl/play?mode=practice">
                  Practice
                </Link>
              </div>
            </div>
          </div>
        </>
      ) : null}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
        <Link className="button secondary" href="/mic-brawl/leaderboard">
          Leaderboard
        </Link>
        <Link className="button secondary" href="/mic-brawl/skins">
          Skins
        </Link>
      </div>

      {error ? <p style={{ color: "#ff7a18", marginBottom: 0 }}>{error}</p> : null}
    </section>
  );
}

