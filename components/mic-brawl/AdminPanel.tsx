"use client";

import { useEffect, useMemo, useState } from "react";
import type { MicBrawlProfile, MicBrawlSkin } from "@/lib/micBrawl";

type RoomItem = {
  id: string;
  status: string;
  host_id: string;
  guest_id: string | null;
  host_handle: string | null;
  guest_handle: string | null;
  last_activity: string;
  created_at: string;
};

export function AdminPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<MicBrawlProfile[]>([]);
  const [skins, setSkins] = useState<MicBrawlSkin[]>([]);
  const [saving, setSaving] = useState(false);
  const [newSkin, setNewSkin] = useState({
    id: "",
    display_name: "",
    unlock_wins: "",
    body: "#d9d9d9",
    accent: "#ff3b30",
    mic: "#c7c7c7"
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    const [roomsRes, leaderboardRes, skinsRes] = await Promise.all([
      fetch("/api/admin/mic-brawl/rooms", { cache: "no-store" }).catch(() => null),
      fetch("/api/admin/mic-brawl/leaderboard", { cache: "no-store" }).catch(() => null),
      fetch("/api/admin/mic-brawl/skins", { cache: "no-store" }).catch(() => null)
    ]);

    const roomsJson = await roomsRes?.json().catch(() => null);
    const leaderboardJson = await leaderboardRes?.json().catch(() => null);
    const skinsJson = await skinsRes?.json().catch(() => null);

    if (!roomsRes?.ok || !leaderboardRes?.ok || !skinsRes?.ok) {
      setError(roomsJson?.error || leaderboardJson?.error || skinsJson?.error || "No se pudo cargar panel Mic Brawl.");
      setLoading(false);
      return;
    }

    setRooms((roomsJson?.items ?? []) as RoomItem[]);
    setLeaderboard((leaderboardJson?.items ?? []) as MicBrawlProfile[]);
    setSkins((skinsJson?.items ?? []) as MicBrawlSkin[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const closeRoom = async (roomId: string) => {
    setSaving(true);
    const res = await fetch("/api/admin/mic-brawl/rooms", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, status: "closed" })
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      const json = await res?.json().catch(() => null);
      setError(json?.error ?? "No se pudo cerrar sala.");
      return;
    }
    await load();
  };

  const resetStats = async (userId: string) => {
    if (!window.confirm("Resetear stats de este usuario?")) return;
    setSaving(true);
    const res = await fetch(`/api/admin/mic-brawl/users/${encodeURIComponent(userId)}/reset`, {
      method: "POST"
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      const json = await res?.json().catch(() => null);
      setError(json?.error ?? "No se pudo resetear stats.");
      return;
    }
    await load();
  };

  const createSkin = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      id: newSkin.id,
      display_name: newSkin.display_name,
      unlock_wins: newSkin.unlock_wins ? Number(newSkin.unlock_wins) : null,
      is_active: true,
      palette: {
        body: newSkin.body,
        accent: newSkin.accent,
        mic: newSkin.mic
      }
    };

    const res = await fetch("/api/admin/mic-brawl/skins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      const json = await res?.json().catch(() => null);
      setError(json?.error ?? "No se pudo crear skin.");
      return;
    }
    setNewSkin({ id: "", display_name: "", unlock_wins: "", body: "#d9d9d9", accent: "#ff3b30", mic: "#c7c7c7" });
    await load();
  };

  const roomsSorted = useMemo(() => [...rooms].sort((a, b) => +new Date(b.last_activity) - +new Date(a.last_activity)), [rooms]);

  return (
    <section className="admin-grid">
      <div className="card">
        <h1 style={{ marginTop: 0 }}>Mic Brawl Admin</h1>
        <p className="muted">Salas activas (últimos 30 min), leaderboard y catálogo de skins.</p>
        <button className="button secondary" onClick={load} type="button" disabled={loading || saving}>
          Recargar
        </button>
        {loading ? <p className="muted">Cargando...</p> : null}
        {error ? <p style={{ color: "#ff7a18" }}>{error}</p> : null}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Salas activas</h3>
        <div style={{ display: "grid", gap: 8 }}>
          {roomsSorted.length ? (
            roomsSorted.map((room) => (
              <div key={room.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <strong>{room.id.slice(0, 8)}</strong>
                    <p className="muted" style={{ margin: 0 }}>
                      {room.status} · {room.host_handle ?? "host"} vs {room.guest_handle ?? "waiting"}
                    </p>
                    <p className="muted" style={{ margin: 0 }}>
                      Activa: {new Date(room.last_activity).toLocaleString("es-PR")}
                    </p>
                  </div>
                  <button className="button secondary" disabled={saving || room.status === "closed"} onClick={() => closeRoom(room.id)} type="button">
                    Cerrar room
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="muted">No hay salas activas.</p>
          )}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Leaderboard</h3>
        <div style={{ overflowX: "auto" }}>
          <table className="mic-brawl-table">
            <thead>
              <tr>
                <th>Handle</th>
                <th>Wins</th>
                <th>Losses</th>
                <th>KOs</th>
                <th>Matches</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {leaderboard.slice(0, 50).map((row) => (
                <tr key={row.id}>
                  <td>{row.handle}</td>
                  <td>{row.wins}</td>
                  <td>{row.losses}</td>
                  <td>{row.kos}</td>
                  <td>{row.matches}</td>
                  <td>
                    <button className="button secondary" type="button" onClick={() => resetStats(row.id)} disabled={saving}>
                      Reset
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Skins</h3>
        <ul style={{ marginTop: 0 }}>
          {skins.map((skin) => (
            <li key={skin.id}>
              <strong>{skin.display_name}</strong> ({skin.id}) · unlock: {skin.unlock_wins ?? "starter"} · {skin.is_active ? "active" : "inactive"}
            </li>
          ))}
        </ul>
        <form className="form-stack" onSubmit={createSkin}>
          <input className="input" placeholder="id (ej: midnight)" value={newSkin.id} onChange={(e) => setNewSkin((s) => ({ ...s, id: e.target.value }))} />
          <input
            className="input"
            placeholder="display_name"
            value={newSkin.display_name}
            onChange={(e) => setNewSkin((s) => ({ ...s, display_name: e.target.value }))}
          />
          <input
            className="input"
            placeholder="unlock_wins (opcional)"
            value={newSkin.unlock_wins}
            onChange={(e) => setNewSkin((s) => ({ ...s, unlock_wins: e.target.value }))}
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
            <input className="input" type="color" value={newSkin.body} onChange={(e) => setNewSkin((s) => ({ ...s, body: e.target.value }))} />
            <input className="input" type="color" value={newSkin.accent} onChange={(e) => setNewSkin((s) => ({ ...s, accent: e.target.value }))} />
            <input className="input" type="color" value={newSkin.mic} onChange={(e) => setNewSkin((s) => ({ ...s, mic: e.target.value }))} />
          </div>
          <button className="button" type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Agregar skin"}
          </button>
        </form>
      </div>
    </section>
  );
}

