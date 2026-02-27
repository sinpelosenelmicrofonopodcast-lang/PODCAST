"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { GameCanvas } from "@/components/mic-brawl/GameCanvas";
import type { MicBrawlProfile, MicBrawlSkin } from "@/lib/micBrawl";

type RoomResponse = {
  ok: boolean;
  room: {
    id: string;
    status: "open" | "full" | "closed" | "finished";
    host_id: string;
    guest_id: string | null;
  };
  me: string;
  players: {
    host: { id: string; profile: MicBrawlProfile | null; skin: MicBrawlSkin | null } | null;
    guest: { id: string; profile: MicBrawlProfile | null; skin: MicBrawlSkin | null } | null;
  };
  error?: string;
};

type ProfileResponse = {
  ok: boolean;
  authenticated: boolean;
  profile: MicBrawlProfile | null;
};

function useMicBrawlPlayState(roomId: string | null, practiceMode: boolean) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<MicBrawlProfile | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [roomData, setRoomData] = useState<RoomResponse | null>(null);
  const [finalizeStatus, setFinalizeStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    const load = async () => {
      const profileRes = await fetch("/api/mic-brawl/profile", { cache: "no-store" }).catch(() => null);
      const profileJson = (await profileRes?.json().catch(() => null)) as ProfileResponse | null;
      if (cancelled) return;

      setAuthenticated(Boolean(profileJson?.authenticated));
      setProfile(profileJson?.profile ?? null);

      if (practiceMode) {
        setLoading(false);
        return;
      }

      if (!roomId) {
        setError("Room inválida.");
        setLoading(false);
        return;
      }

      if (!profileJson?.authenticated) {
        setError("Debes iniciar sesión para jugar online.");
        setLoading(false);
        return;
      }

      const roomRes = await fetch(`/api/mic-brawl/room/${encodeURIComponent(roomId)}`, { cache: "no-store" }).catch(() => null);
      const roomJson = (await roomRes?.json().catch(() => null)) as RoomResponse | null;
      if (cancelled) return;

      if (!roomRes?.ok || !roomJson?.ok) {
        setError(roomJson?.error ?? "No se pudo cargar la sala.");
        setLoading(false);
        return;
      }

      setRoomData(roomJson);
      setError(null);
      setLoading(false);

      if (!roomJson.players.guest) {
        timer = window.setTimeout(load, 2000);
      }
    };

    load();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [practiceMode, roomId]);

  return {
    loading,
    error,
    profile,
    authenticated,
    roomData,
    finalizeStatus,
    setFinalizeStatus
  };
}

export function PlayClient() {
  const search = useSearchParams();
  const roomId = search.get("room");
  const practiceMode = search.get("mode") === "practice" || !roomId;
  const { loading, error, profile, authenticated, roomData, finalizeStatus, setFinalizeStatus } = useMicBrawlPlayState(
    roomId,
    practiceMode
  );

  const players = useMemo(() => {
    if (practiceMode) {
      return [
        {
          id: profile?.id ?? "local-player",
          handle: profile?.handle ?? "BEBO",
          skin: { id: profile?.equipped_skin ?? "classic", display_name: "", unlock_wins: null, is_active: true, palette: null }
        },
        {
          id: "cpu-bito",
          handle: "BITO CPU",
          skin: { id: "classic", display_name: "", unlock_wins: null, is_active: true, palette: { body: "#bbb", accent: "#22d3ee", mic: "#ddd" } }
        }
      ] as const;
    }

    if (!roomData?.players.host || !roomData.players.guest) return null;

    return [
      {
        id: roomData.players.host.id,
        handle: roomData.players.host.profile?.handle ?? "BEBO",
        skin: roomData.players.host.skin
      },
      {
        id: roomData.players.guest.id,
        handle: roomData.players.guest.profile?.handle ?? "BITO",
        skin: roomData.players.guest.skin
      }
    ] as const;
  }, [practiceMode, profile, roomData]);

  const finalize = async (payload: { winnerId: string; durationSeconds: number; winnerKo: boolean }) => {
    if (practiceMode || !roomId) return;
    const res = await fetch("/api/mic-brawl/match/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId,
        winnerId: payload.winnerId,
        durationSeconds: payload.durationSeconds,
        winnerKo: payload.winnerKo
      })
    }).catch(() => null);
    if (!res?.ok) {
      const json = await res?.json().catch(() => null);
      setFinalizeStatus(json?.error ?? "No se pudo guardar el resultado.");
      return;
    }
    setFinalizeStatus("Resultado guardado en leaderboard.");
  };

  const waiting = !practiceMode && roomData && !roomData.players.guest;

  return (
    <div className="container" style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link className="button secondary" href="/mic-brawl">
          Volver
        </Link>
        <Link className="button secondary" href="/mic-brawl/leaderboard">
          Ver leaderboard
        </Link>
      </div>

      {loading ? <p className="muted">Cargando partida...</p> : null}
      {error ? (
        <div className="card">
          <p style={{ color: "#ff7a18", marginTop: 0 }}>{error}</p>
          {!authenticated && !practiceMode ? (
            <Link className="button" href={`/login?next=${encodeURIComponent(`/mic-brawl/play?room=${roomId ?? ""}`)}`}>
              Entrar para jugar online
            </Link>
          ) : null}
        </div>
      ) : null}

      {waiting ? (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Esperando segundo jugador...</h3>
          <p className="muted">Comparte este link:</p>
          <code>{typeof window !== "undefined" ? window.location.href : ""}</code>
        </div>
      ) : null}

      {!loading && !error && players ? (
        <GameCanvas
          mode={practiceMode ? "practice" : "online"}
          roomId={roomId ?? undefined}
          meId={practiceMode ? profile?.id ?? "local-player" : roomData?.me ?? profile?.id ?? "unknown"}
          players={[players[0], players[1]]}
          hostId={roomData?.room.host_id}
          canFinalize={Boolean(!practiceMode && roomData?.room.host_id === roomData?.me)}
          onMatchEnd={finalize}
        />
      ) : null}

      {finalizeStatus ? <p className="muted">{finalizeStatus}</p> : null}
    </div>
  );
}

