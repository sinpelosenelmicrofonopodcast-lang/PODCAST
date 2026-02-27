export type MicBrawlInputState = {
  left: boolean;
  right: boolean;
  jump: boolean;
  attack: boolean;
};

export type MicBrawlInputPacket = {
  playerId: string;
  seq: number;
  t: number;
  inputs: MicBrawlInputState;
};

export type MicBrawlProfile = {
  id: string;
  handle: string;
  equipped_skin: string;
  wins: number;
  losses: number;
  kos: number;
  matches: number;
  is_admin?: boolean;
  created_at?: string;
};

export type MicBrawlSkin = {
  id: string;
  display_name: string;
  unlock_wins: number | null;
  is_active: boolean;
  palette: Record<string, string> | null;
  created_at?: string;
};

export type MicBrawlRoom = {
  id: string;
  status: "open" | "full" | "closed" | "finished";
  host_id: string;
  guest_id: string | null;
  created_at: string;
  updated_at: string;
  last_activity: string;
};

export type MicBrawlMatchRecord = {
  id: string;
  room_id: string;
  winner_id: string;
  loser_id: string;
  winner_ko: boolean;
  duration_seconds: number;
  created_at: string;
};

export const MIC_BRAWL_TITLE = "Sin Pelos: 8-Bit Mic Brawl";

export const DEFAULT_SKIN_ID = "classic";

export const GAME_CONFIG = {
  width: 320,
  height: 180,
  floorY: 150,
  gravity: 980,
  runSpeed: 120,
  jumpSpeed: 340,
  playerWidth: 14,
  playerHeight: 22,
  maxHealth: 100,
  attackDamage: 10,
  attackCooldownMs: 320,
  attackActiveMs: 120,
  attackRange: 18,
  attackHeight: 16,
  sendRateMs: 55
} as const;

export function canUseSkin(skin: MicBrawlSkin, wins: number) {
  if (!skin.is_active) return false;
  if (skin.unlock_wins == null) return true;
  return wins >= skin.unlock_wins;
}

export function formatMatchKDA(profile: Pick<MicBrawlProfile, "wins" | "losses" | "matches">) {
  return `${profile.wins}-${profile.losses} (${profile.matches})`;
}
