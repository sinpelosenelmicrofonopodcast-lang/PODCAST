"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { supabase } from "@/lib/supabaseClient";
import { GAME_CONFIG, type MicBrawlInputPacket, type MicBrawlInputState, type MicBrawlSkin } from "@/lib/micBrawl";

type Mode = "online" | "practice";

type PlayerSpec = {
  id: string;
  handle: string;
  skin: MicBrawlSkin | null;
};

type PlayerState = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  onGround: boolean;
  health: number;
  attackCooldownMs: number;
  attackActiveMs: number;
};

type GameSnapshot = {
  players: Record<string, PlayerState>;
  winnerId: string | null;
  elapsedMs: number;
};

type Props = {
  mode: Mode;
  roomId?: string;
  meId: string;
  players: [PlayerSpec, PlayerSpec];
  hostId?: string;
  canFinalize?: boolean;
  onMatchEnd?: (result: { winnerId: string; durationSeconds: number; winnerKo: boolean }) => void;
};

const BG = "#0a0a0f";
const ARENA = "#11131d";
const FLOOR = "#1e2332";
const HUD = "#ff3b30";

function defaultInputs(): MicBrawlInputState {
  return { left: false, right: false, jump: false, attack: false };
}

function emptyPacket(playerId: string): MicBrawlInputPacket {
  return { playerId, seq: 0, t: Date.now(), inputs: defaultInputs() };
}

function parsePalette(skin: MicBrawlSkin | null) {
  const palette = (skin?.palette ?? {}) as Record<string, string>;
  return {
    body: palette.body || "#e4e4e4",
    accent: palette.accent || "#ff3b30",
    mic: palette.mic || "#c7c7c7"
  };
}

function initPlayerState(id: string, side: "left" | "right"): PlayerState {
  return {
    id,
    x: side === "left" ? 40 : GAME_CONFIG.width - 54,
    y: GAME_CONFIG.floorY - GAME_CONFIG.playerHeight,
    vx: 0,
    vy: 0,
    facing: side === "left" ? 1 : -1,
    onGround: true,
    health: GAME_CONFIG.maxHealth,
    attackCooldownMs: 0,
    attackActiveMs: 0
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function GameCanvas({ mode, roomId, meId, players, hostId, canFinalize = false, onMatchEnd }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const localInputsRef = useRef<MicBrawlInputState>(defaultInputs());
  const remotePacketRef = useRef<MicBrawlInputPacket>(emptyPacket(players[1].id));
  const localSeqRef = useRef(0);
  const localHistoryRef = useRef<Map<number, MicBrawlInputState>>(new Map());
  const lastAttackPressedRef = useRef<Record<string, boolean>>({});
  const snapshotRef = useRef<GameSnapshot>({
    players: {
      [players[0].id]: initPlayerState(players[0].id, "left"),
      [players[1].id]: initPlayerState(players[1].id, "right")
    },
    winnerId: null,
    elapsedMs: 0
  });
  const finalizedRef = useRef(false);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [presenceCount, setPresenceCount] = useState(1);
  const [connected, setConnected] = useState(mode === "practice");
  const [showTouchControls, setShowTouchControls] = useState(false);

  const me = players.find((p) => p.id === meId) ?? players[0];
  const enemy = players.find((p) => p.id !== meId) ?? players[1];
  const mePalette = useMemo(() => parsePalette(me.skin), [me.skin]);
  const enemyPalette = useMemo(() => parsePalette(enemy.skin), [enemy.skin]);
  const hostPlayerId = hostId || players[0].id;
  const isHost = meId === hostPlayerId;

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setShowTouchControls(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (["ArrowLeft", "ArrowRight", "ArrowUp", " ", "a", "d", "w", "A", "D", "W"].includes(event.key)) {
        event.preventDefault();
      }
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") localInputsRef.current.left = true;
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") localInputsRef.current.right = true;
      if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") localInputsRef.current.jump = true;
      if (event.key === " ") localInputsRef.current.attack = true;
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") localInputsRef.current.left = false;
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") localInputsRef.current.right = false;
      if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") localInputsRef.current.jump = false;
      if (event.key === " ") localInputsRef.current.attack = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    if (mode !== "online" || !roomId) return;
    const channelName = `mic_brawl_room:${roomId}`;
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
        presence: { key: meId }
      }
    });

    channel.on("broadcast", { event: "input" }, ({ payload }) => {
      const incoming = payload as MicBrawlInputPacket;
      if (!incoming || incoming.playerId === meId) return;
      if (incoming.seq <= remotePacketRef.current.seq) return;
      remotePacketRef.current = incoming;
    });

    channel.on("broadcast", { event: "state" }, ({ payload }) => {
      if (isHost) return;
      const incoming = payload as {
        players?: Record<string, Pick<PlayerState, "x" | "y" | "health" | "facing">>;
        winnerId?: string | null;
      };
      if (!incoming?.players) return;
      const next = snapshotRef.current;
      Object.entries(incoming.players).forEach(([id, state]) => {
        const current = next.players[id];
        if (!current) return;
        current.x = state.x;
        current.y = state.y;
        current.facing = state.facing;
        current.health = state.health;
      });
      if (incoming.winnerId && !next.winnerId) {
        next.winnerId = incoming.winnerId;
        setWinnerId(incoming.winnerId);
      }
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const count = Object.keys(state).length;
      setPresenceCount(count);
      setConnected(true);
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ userId: meId, at: Date.now() });
        setConnected(true);
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        setConnected(false);
      }
    });

    const inputTimer = window.setInterval(() => {
      const packet: MicBrawlInputPacket = {
        playerId: meId,
        seq: ++localSeqRef.current,
        t: Date.now(),
        inputs: { ...localInputsRef.current }
      };
      localHistoryRef.current.set(packet.seq, packet.inputs);
      if (localHistoryRef.current.size > 180) {
        const oldest = Math.min(...Array.from(localHistoryRef.current.keys()));
        localHistoryRef.current.delete(oldest);
      }
      channel.send({ type: "broadcast", event: "input", payload: packet });
    }, GAME_CONFIG.sendRateMs);

    const stateTimer = window.setInterval(() => {
      if (!isHost) return;
      const next = snapshotRef.current;
      channel.send({
        type: "broadcast",
        event: "state",
        payload: {
          players: {
            [players[0].id]: {
              x: next.players[players[0].id].x,
              y: next.players[players[0].id].y,
              facing: next.players[players[0].id].facing,
              health: next.players[players[0].id].health
            },
            [players[1].id]: {
              x: next.players[players[1].id].x,
              y: next.players[players[1].id].y,
              facing: next.players[players[1].id].facing,
              health: next.players[players[1].id].health
            }
          },
          winnerId: next.winnerId
        }
      });
    }, 200);

    channelRef.current = channel;
    return () => {
      window.clearInterval(inputTimer);
      window.clearInterval(stateTimer);
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
      setConnected(false);
    };
  }, [isHost, meId, mode, players, roomId]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const stepMs = 1000 / 60;

    const getInputForPlayer = (id: string, elapsedMs: number): MicBrawlInputState => {
      if (mode === "practice" && id === enemy.id) {
        const meState = snapshotRef.current.players[me.id];
        const enemyState = snapshotRef.current.players[enemy.id];
        const dir = meState.x > enemyState.x + 6 ? 1 : meState.x < enemyState.x - 6 ? -1 : 0;
        const jump = Math.sin(elapsedMs / 650) > 0.998 && enemyState.onGround;
        const close = Math.abs(meState.x - enemyState.x) < GAME_CONFIG.attackRange + 4;
        return {
          left: dir < 0,
          right: dir > 0,
          jump,
          attack: close && (Math.floor(elapsedMs / 240) % 2 === 0)
        };
      }
      if (id === me.id) return localInputsRef.current;
      if (mode === "online") return remotePacketRef.current.inputs;
      return defaultInputs();
    };

    const hitBeep = () => {
      try {
        if (!audioRef.current) audioRef.current = new AudioContext();
        const audio = audioRef.current;
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = "square";
        osc.frequency.value = 120;
        gain.gain.value = 0.05;
        osc.connect(gain);
        gain.connect(audio.destination);
        osc.start();
        osc.stop(audio.currentTime + 0.07);
      } catch {
        // noop
      }
    };

    const resolveAttack = (attacker: PlayerState, target: PlayerState) => {
      const sameLane = Math.abs(attacker.y - target.y) < GAME_CONFIG.attackHeight;
      if (!sameLane) return;
      const inFront =
        attacker.facing === 1
          ? target.x >= attacker.x && target.x <= attacker.x + GAME_CONFIG.attackRange
          : target.x <= attacker.x && target.x >= attacker.x - GAME_CONFIG.attackRange;
      if (!inFront) return;
      target.health = clamp(target.health - GAME_CONFIG.attackDamage, 0, GAME_CONFIG.maxHealth);
      hitBeep();
      if (target.health <= 0 && !snapshotRef.current.winnerId) {
        snapshotRef.current.winnerId = attacker.id;
        setWinnerId(attacker.id);
      }
    };

    const physicsStep = (dtSec: number) => {
      const state = snapshotRef.current;
      state.elapsedMs += dtSec * 1000;
      const ids = [players[0].id, players[1].id];
      const p1 = state.players[ids[0]];
      const p2 = state.players[ids[1]];

      ids.forEach((id) => {
        const p = state.players[id];
        if (!p || state.winnerId) return;
        const input = getInputForPlayer(id, state.elapsedMs);

        const right = input.right && !input.left;
        const left = input.left && !input.right;
        p.vx = right ? GAME_CONFIG.runSpeed : left ? -GAME_CONFIG.runSpeed : 0;
        if (p.vx > 0) p.facing = 1;
        if (p.vx < 0) p.facing = -1;

        if (input.jump && p.onGround) {
          p.vy = -GAME_CONFIG.jumpSpeed;
          p.onGround = false;
        }

        p.vy += GAME_CONFIG.gravity * dtSec;
        p.x += p.vx * dtSec;
        p.y += p.vy * dtSec;

        p.x = clamp(p.x, 2, GAME_CONFIG.width - GAME_CONFIG.playerWidth - 2);

        const floor = GAME_CONFIG.floorY - GAME_CONFIG.playerHeight;
        if (p.y >= floor) {
          p.y = floor;
          p.vy = 0;
          p.onGround = true;
        }

        p.attackCooldownMs = Math.max(0, p.attackCooldownMs - dtSec * 1000);
        p.attackActiveMs = Math.max(0, p.attackActiveMs - dtSec * 1000);

        const prevAttack = lastAttackPressedRef.current[id] ?? false;
        const attackPressedNow = Boolean(input.attack);
        if (attackPressedNow && !prevAttack && p.attackCooldownMs <= 0) {
          p.attackCooldownMs = GAME_CONFIG.attackCooldownMs;
          p.attackActiveMs = GAME_CONFIG.attackActiveMs;
          if (id === p1.id) resolveAttack(p1, p2);
          else resolveAttack(p2, p1);
        }
        lastAttackPressedRef.current[id] = attackPressedNow;
      });
    };

    const draw = () => {
      const state = snapshotRef.current;
      ctx.clearRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height);
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height);

      ctx.fillStyle = ARENA;
      ctx.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.floorY);
      ctx.fillStyle = FLOOR;
      ctx.fillRect(0, GAME_CONFIG.floorY, GAME_CONFIG.width, GAME_CONFIG.height - GAME_CONFIG.floorY);

      for (let y = 0; y < GAME_CONFIG.height; y += 3) {
        ctx.fillStyle = "rgba(0,0,0,0.08)";
        ctx.fillRect(0, y, GAME_CONFIG.width, 1);
      }

      const pMe = state.players[me.id];
      const pEnemy = state.players[enemy.id];
      const renderPlayer = (p: PlayerState, palette: ReturnType<typeof parsePalette>) => {
        ctx.fillStyle = palette.body;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), GAME_CONFIG.playerWidth, GAME_CONFIG.playerHeight);
        ctx.fillStyle = palette.accent;
        ctx.fillRect(Math.round(p.x + 4), Math.round(p.y + 4), 6, 6);
        ctx.fillStyle = palette.mic;
        if (p.attackActiveMs > 0) {
          const swingX = p.facing === 1 ? p.x + GAME_CONFIG.playerWidth : p.x - GAME_CONFIG.attackRange;
          ctx.fillRect(Math.round(swingX), Math.round(p.y + 4), GAME_CONFIG.attackRange, 5);
        } else {
          ctx.fillRect(Math.round(p.x + (p.facing === 1 ? GAME_CONFIG.playerWidth : -3)), Math.round(p.y + 8), 3, 8);
        }
      };
      renderPlayer(pMe, mePalette);
      renderPlayer(pEnemy, enemyPalette);

      ctx.fillStyle = "rgba(10,10,14,0.9)";
      ctx.fillRect(8, 8, GAME_CONFIG.width - 16, 20);
      ctx.fillStyle = "#2a2f3f";
      ctx.fillRect(12, 12, 120, 12);
      ctx.fillRect(GAME_CONFIG.width - 132, 12, 120, 12);
      ctx.fillStyle = HUD;
      ctx.fillRect(12, 12, (120 * pMe.health) / GAME_CONFIG.maxHealth, 12);
      ctx.fillRect(
        GAME_CONFIG.width - 132 + (120 * (GAME_CONFIG.maxHealth - pEnemy.health)) / GAME_CONFIG.maxHealth,
        12,
        (120 * pEnemy.health) / GAME_CONFIG.maxHealth,
        12
      );
      ctx.fillStyle = "#f3f4f6";
      ctx.font = "8px monospace";
      ctx.fillText(me.handle.slice(0, 10), 12, 9);
      ctx.fillText(enemy.handle.slice(0, 10), GAME_CONFIG.width - 132, 9);
    };

    const frame = (now: number) => {
      const delta = Math.min(64, now - last);
      last = now;
      acc += delta;

      while (acc >= stepMs) {
        physicsStep(stepMs / 1000);
        acc -= stepMs;
      }
      draw();

      const state = snapshotRef.current;
      if (state.winnerId && !finalizedRef.current && onMatchEnd && canFinalize) {
        finalizedRef.current = true;
        onMatchEnd({
          winnerId: state.winnerId,
          durationSeconds: Math.max(5, Math.floor(state.elapsedMs / 1000)),
          winnerKo: true
        });
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [canFinalize, enemy.id, enemy.handle, enemyPalette, me.handle, me.id, mePalette, mode, onMatchEnd, players]);

  useEffect(() => {
    if (!roomId || mode !== "online") return;
    const timer = window.setInterval(() => {
      fetch("/api/mic-brawl/room/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId })
      }).catch(() => null);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [mode, roomId]);

  const resetMatch = () => {
    snapshotRef.current = {
      players: {
        [players[0].id]: initPlayerState(players[0].id, "left"),
        [players[1].id]: initPlayerState(players[1].id, "right")
      },
      winnerId: null,
      elapsedMs: 0
    };
    finalizedRef.current = false;
    setWinnerId(null);
  };

  const setVirtualInput = (key: keyof MicBrawlInputState, pressed: boolean) => {
    localInputsRef.current[key] = pressed;
  };

  const bindVirtualKey = (key: keyof MicBrawlInputState) => {
    return {
      onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        setVirtualInput(key, true);
      },
      onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        setVirtualInput(key, false);
      },
      onPointerLeave: () => setVirtualInput(key, false),
      onPointerCancel: () => setVirtualInput(key, false)
    };
  };

  return (
    <div className="card mic-brawl-canvas-wrap">
      <div className="mic-brawl-canvas-head">
        <div>
          <h3 style={{ margin: 0 }}>SPM ARCADE</h3>
          <p className="muted" style={{ margin: 0 }}>
            BEBO vs BITO · {mode === "online" ? `Room ${roomId}` : "Practice"}
          </p>
        </div>
        <div className="mic-brawl-pill-row">
          {mode === "online" ? <span className={`badge ${connected ? "" : "warn"}`}>{connected ? "Online" : "Offline"}</span> : null}
          {mode === "online" ? <span className="badge">Jugadores conectados: {presenceCount}/2</span> : null}
          <span className="badge">{winnerId ? "Match ended" : "In match"}</span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={GAME_CONFIG.width}
        height={GAME_CONFIG.height}
        className="mic-brawl-canvas"
        aria-label="Mic Brawl game canvas"
      />

      <p className="muted" style={{ marginTop: 10 }}>
        Controles: A/←, D/→, W/↑, Space.
      </p>
      <p className="muted mic-brawl-mobile-note">Controles táctiles activados.</p>

      {showTouchControls ? (
        <div className="mic-brawl-touch-pad" aria-label="Controles táctiles">
          <div className="mic-brawl-touch-move">
            <button className="mic-brawl-touch-btn" type="button" aria-label="Mover izquierda" {...bindVirtualKey("left")}>
              ←
            </button>
            <button className="mic-brawl-touch-btn" type="button" aria-label="Mover derecha" {...bindVirtualKey("right")}>
              →
            </button>
          </div>
          <div className="mic-brawl-touch-actions">
            <button className="mic-brawl-touch-btn" type="button" aria-label="Saltar" {...bindVirtualKey("jump")}>
              ⤒
            </button>
            <button className="mic-brawl-touch-btn mic-brawl-touch-attack" type="button" aria-label="Atacar" {...bindVirtualKey("attack")}>
              MIC
            </button>
          </div>
        </div>
      ) : null}

      {winnerId ? (
        <div className="mic-brawl-overlay">
          <h2 style={{ margin: 0 }}>{winnerId === me.id ? `${me.handle} gana` : `${enemy.handle} gana`}</h2>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="button" type="button" onClick={resetMatch}>
              Rematch
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
