"use client";

import { useEffect, useState } from "react";
import type { MicBrawlProfile } from "@/lib/micBrawl";

type LeaderboardResponse = {
  ok: boolean;
  top: MicBrawlProfile[];
  me: MicBrawlProfile | null;
  myRank: number | null;
  error?: string;
};

export function Leaderboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [top, setTop] = useState<MicBrawlProfile[]>([]);
  const [me, setMe] = useState<MicBrawlProfile | null>(null);
  const [myRank, setMyRank] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      const res = await fetch("/api/mic-brawl/leaderboard", { cache: "no-store" }).catch(() => null);
      if (!mounted) return;
      if (!res?.ok) {
        const json = (await res?.json().catch(() => null)) as LeaderboardResponse | null;
        setError(json?.error ?? "No se pudo cargar leaderboard.");
        setLoading(false);
        return;
      }
      const json = (await res.json().catch(() => null)) as LeaderboardResponse | null;
      setTop(json?.top ?? []);
      setMe(json?.me ?? null);
      setMyRank(json?.myRank ?? null);
      setLoading(false);
    };
    run();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="card">
      <h1 style={{ marginTop: 0 }}>Leaderboard</h1>
      <p className="muted">Top 20 jugadores de Sin Pelos: 8-Bit Mic Brawl</p>
      {loading ? <p className="muted">Cargando...</p> : null}
      {error ? <p style={{ color: "#ff7a18" }}>{error}</p> : null}
      {!loading && !error ? (
        <div style={{ overflowX: "auto" }}>
          <table className="mic-brawl-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Handle</th>
                <th>Wins</th>
                <th>Losses</th>
                <th>KOs</th>
                <th>Matches</th>
                <th>Skin</th>
              </tr>
            </thead>
            <tbody>
              {top.map((row, index) => (
                <tr key={row.id}>
                  <td>{index + 1}</td>
                  <td>{row.handle}</td>
                  <td>{row.wins}</td>
                  <td>{row.losses}</td>
                  <td>{row.kos}</td>
                  <td>{row.matches}</td>
                  <td>{row.equipped_skin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {me ? (
        <div className="card" style={{ marginTop: 14 }}>
          <strong>Mi ranking: {myRank ?? "-"}</strong>
          <p className="muted" style={{ margin: "6px 0 0" }}>
            {me.handle} · {me.wins}W / {me.losses}L · {me.kos} KOs · Skin {me.equipped_skin}
          </p>
        </div>
      ) : (
        <p className="muted">Inicia sesión para ver tu posición.</p>
      )}
    </section>
  );
}

