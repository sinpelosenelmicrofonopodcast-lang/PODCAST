import { postToFacebookPageFeed } from "@/lib/socialFacebook";

export const SPM_AUTOPOST_TIMEZONE = "America/Chicago";

type Slot = {
  localDate: string;
  localTime: string;
  minuteOfDay: number;
};

export type AutoPostDraft = {
  message: string;
  scheduledForUtc: string;
  localDate: string;
  localTime: string;
};

type SlotMessage = {
  localTime: string;
  message: string;
};

export type GenerateAutoPostsInput = {
  date: string;
  startTime?: string;
  endTime?: string;
  intervalMinutes?: number;
  countOverride?: number | null;
};

const MORNING_HOOKS = [
  "arrancamos con energía y cero filtro.",
  "vamos a poner los temas sobre la mesa sin rodeos.",
  "hoy se habla claro desde temprano."
];

const MORNING_CTA = [
  "¿Qué tema te tiene activo hoy?",
  "Cuéntanos qué está pasando en tu esquina.",
  "Pásate por el feed y prende la conversación."
];

const MIDDAY_HOOKS = [
  "Buen provecho, corillo. Entre bocado y bocado, seguimos pendientes al pulso del día.",
  "Buen provecho. Si estás almorzando, aprovecha para ponerte al día con lo importante.",
  "Buen provecho, familia. Hoy la conversación viene caliente pero con cabeza."
];

const MIDDAY_CTA = [
  "¿Cuál noticia te sorprendió hoy?",
  "Déjanos tu lectura en los comentarios.",
  "Comparte el punto que tú crees que nadie está viendo."
];

const AFTERNOON_OPENERS = [
  "Seguimos activos en Sin Pelos.",
  "La tarde está buena para debatir con criterio.",
  "Aquí seguimos, directos y sin maquillaje."
];

const AFTERNOON_HOOKS = [
  "Hay temas que merecen menos ruido y más análisis.",
  "Hoy toca separar el hype de los hechos.",
  "La conversación del día no se acaba, apenas va calentando."
];

const AFTERNOON_CTA = [
  "¿Qué ángulo falta en la discusión?",
  "Súmate al debate y trae tu punto.",
  "Ven al feed y mete presión con argumentos."
];

const NIGHT_OPENERS = [
  "Cerramos el día con la mente prendida.",
  "Antes de apagar motores, hacemos cierre editorial.",
  "Última vuelta del día por aquí."
];

const NIGHT_HOOKS = [
  "Gracias por mantener la conversación viva y con respeto.",
  "Mañana seguimos con más temas, más contexto y cero cuento.",
  "Nos vemos mañana para seguir hablando claro."
];

function seededInt(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(seed: string, list: T[], salt: string) {
  if (list.length === 0) throw new Error("Lista vacía para selección.");
  const idx = seededInt(`${seed}:${salt}`) % list.length;
  return list[idx];
}

function normalizeMessage(input: string, max = 240) {
  const compact = String(input ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1).trimEnd()}…`;
}

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""));
}

function isValidClock(value: string) {
  return /^\d{2}:\d{2}$/.test(String(value ?? ""));
}

function toMinutes(clock: string) {
  const [hh, mm] = clock.split(":").map((v) => Number(v));
  return hh * 60 + mm;
}

function fromMinutes(value: number) {
  const hh = Math.floor(value / 60);
  const mm = value % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function parseDateParts(date: string) {
  const [y, m, d] = date.split("-").map((v) => Number(v));
  return { year: y, month: m, day: d };
}

function partsInZone(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
  const out: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== "literal") out[part.type] = part.value;
  }
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    hour: Number(out.hour),
    minute: Number(out.minute),
    second: Number(out.second)
  };
}

function zoneOffsetMs(timeZone: string, date: Date) {
  const p = partsInZone(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - date.getTime();
}

export function chicagoLocalToUtcIso(localDate: string, localTime: string) {
  if (!isValidDate(localDate)) throw new Error("Fecha inválida. Usa YYYY-MM-DD.");
  if (!isValidClock(localTime)) throw new Error("Hora inválida. Usa HH:mm.");

  const { year, month, day } = parseDateParts(localDate);
  const [hour, minute] = localTime.split(":").map((v) => Number(v));

  const guessUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  const guessDate = new Date(guessUtcMs);
  const offset1 = zoneOffsetMs(SPM_AUTOPOST_TIMEZONE, guessDate);
  const firstPass = new Date(guessUtcMs - offset1);
  const offset2 = zoneOffsetMs(SPM_AUTOPOST_TIMEZONE, firstPass);
  const finalDate = new Date(guessUtcMs - offset2);

  return finalDate.toISOString();
}

export function chicagoDateInputFromNow(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SPM_AUTOPOST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}

export function chicagoDateTimeLabel(utcIso?: string | null) {
  if (!utcIso) return "—";
  const d = new Date(utcIso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-PR", {
    timeZone: SPM_AUTOPOST_TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function chicagoDayBoundsUtc(date: string) {
  if (!isValidDate(date)) throw new Error("Fecha inválida. Usa YYYY-MM-DD.");

  const { year, month, day } = parseDateParts(date);
  const nextDayUtc = new Date(Date.UTC(year, month - 1, day) + 24 * 60 * 60 * 1000);
  const nextDate = `${nextDayUtc.getUTCFullYear()}-${String(nextDayUtc.getUTCMonth() + 1).padStart(2, "0")}-${String(
    nextDayUtc.getUTCDate()
  ).padStart(2, "0")}`;

  const startUtc = chicagoLocalToUtcIso(date, "00:00");
  const endUtcExclusive = chicagoLocalToUtcIso(nextDate, "00:00");

  return { startUtc, endUtcExclusive };
}

function buildSlots(input: GenerateAutoPostsInput): Slot[] {
  const date = String(input.date ?? "").trim();
  const startTime = String(input.startTime ?? "08:00").trim();
  const endTime = String(input.endTime ?? "22:00").trim();
  const intervalMinutes = Number.isFinite(Number(input.intervalMinutes)) ? Math.max(5, Math.floor(Number(input.intervalMinutes))) : 30;

  if (!isValidDate(date)) throw new Error("Fecha inválida. Usa YYYY-MM-DD.");
  if (!isValidClock(startTime)) throw new Error("Hora inicio inválida. Usa HH:mm.");
  if (!isValidClock(endTime)) throw new Error("Hora fin inválida. Usa HH:mm.");

  const startM = toMinutes(startTime);
  const endM = toMinutes(endTime);
  if (endM < startM) throw new Error("La hora fin debe ser mayor o igual a hora inicio.");

  const all: Slot[] = [];
  for (let m = startM; m <= endM; m += intervalMinutes) {
    all.push({ localDate: date, localTime: fromMinutes(m), minuteOfDay: m });
  }
  if (all.length === 0) return [];

  const countRaw = Number(input.countOverride ?? 0);
  const count = Number.isFinite(countRaw) ? Math.max(0, Math.floor(countRaw)) : 0;
  if (!count || count >= all.length) return all;

  if (count === 1) return [all[0]];

  const selected: Slot[] = [];
  const used = new Set<string>();
  const step = (all.length - 1) / (count - 1);

  for (let i = 0; i < count; i += 1) {
    const idx = Math.round(i * step);
    const slot = all[Math.min(all.length - 1, Math.max(0, idx))];
    const key = `${slot.localDate} ${slot.localTime}`;
    if (used.has(key)) continue;
    used.add(key);
    selected.push(slot);
  }

  if (selected.length >= count) return selected.slice(0, count);
  for (const slot of all) {
    const key = `${slot.localDate} ${slot.localTime}`;
    if (used.has(key)) continue;
    used.add(key);
    selected.push(slot);
    if (selected.length >= count) break;
  }

  return selected;
}

function buildMessage(slot: Slot, index: number) {
  const seed = `${slot.localDate}|${slot.localTime}|${index}`;
  const m = slot.minuteOfDay;

  // Morning: must start with "Buenos días"
  if (m < 11 * 60 + 30) {
    const hook = pick(seed, MORNING_HOOKS, "mh");
    const cta = pick(seed, MORNING_CTA, "mc");
    const msg = normalizeMessage(`Buenos días, corillo: ${hook} ${cta}`);
    return msg.startsWith("Buenos días") ? msg : `Buenos días, ${msg}`;
  }

  // Midday: must include "Buen provecho"
  if (m >= 11 * 60 + 30 && m <= 14 * 60) {
    const hook = pick(seed, MIDDAY_HOOKS, "dh");
    const cta = pick(seed, MIDDAY_CTA, "dc");
    const msg = normalizeMessage(`${hook} ${cta}`);
    if (msg.includes("Buen provecho")) return msg;
    return normalizeMessage(`Buen provecho. ${msg}`);
  }

  // Night: must end with "Buenas noches"
  if (m >= 20 * 60) {
    const opener = pick(seed, NIGHT_OPENERS, "no");
    const hook = pick(seed, NIGHT_HOOKS, "nh");
    const msg = normalizeMessage(`${opener} ${hook} Buenas noches`);
    return msg.endsWith("Buenas noches") ? msg : `${msg} Buenas noches`;
  }

  // Afternoon/general.
  const opener = pick(seed, AFTERNOON_OPENERS, "ao");
  const hook = pick(seed, AFTERNOON_HOOKS, "ah");
  const cta = pick(seed, AFTERNOON_CTA, "ac");
  return normalizeMessage(`${opener} ${hook} ${cta}`);
}

export function generateAutoPostDrafts(input: GenerateAutoPostsInput): AutoPostDraft[] {
  const slots = buildSlots(input);
  return slots.map((slot, index) => ({
    message: buildMessage(slot, index),
    scheduledForUtc: chicagoLocalToUtcIso(slot.localDate, slot.localTime),
    localDate: slot.localDate,
    localTime: slot.localTime
  }));
}

function enforceSlotRules(slot: Slot, messageRaw: string, fallbackIndex: number) {
  const fallback = buildMessage(slot, fallbackIndex);
  const message = normalizeMessage(String(messageRaw ?? "").trim());
  if (!message) return fallback;

  if (slot.minuteOfDay < 11 * 60 + 30) {
    if (message.startsWith("Buenos días")) return message;
    return normalizeMessage(`Buenos días, ${message}`);
  }

  if (slot.minuteOfDay >= 11 * 60 + 30 && slot.minuteOfDay <= 14 * 60) {
    if (message.includes("Buen provecho")) return message;
    return normalizeMessage(`Buen provecho. ${message}`);
  }

  if (slot.minuteOfDay >= 20 * 60) {
    if (message.endsWith("Buenas noches")) return message;
    return normalizeMessage(`${message} Buenas noches`);
  }

  return message;
}

async function generateSlotMessagesWithOpenAI(slots: Slot[]): Promise<SlotMessage[] | null> {
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  if (!apiKey) return null;

  const endpoint = process.env.OPENAI_API_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.OPENAI_NEWS_MODEL ?? "gpt-4o-mini";
  const slotLines = slots.map((slot, idx) => {
    const phase =
      slot.minuteOfDay < 11 * 60 + 30 ? "morning" : slot.minuteOfDay <= 14 * 60 ? "midday" : slot.minuteOfDay >= 20 * 60 ? "night" : "afternoon";
    return `${idx + 1}. ${slot.localDate} ${slot.localTime} (${phase})`;
  });

  const system = [
    "Eres editor de redes de 'Sin Pelos en el Micrófono'.",
    "Genera mensajes para Facebook en español boricua, cortos, directos, jocosos ligeros (no cursi).",
    "No uses odio, violencia explícita, slurs, ni comedia negra.",
    "Responde SOLO JSON válido con forma: {\"messages\":[{\"localTime\":\"HH:mm\",\"message\":\"...\"}]}.",
    "Reglas duras:",
    "- morning: el mensaje debe empezar con 'Buenos días'.",
    "- midday (11:30-14:00): debe incluir 'Buen provecho'.",
    "- night (>=20:00): debe terminar con 'Buenas noches'.",
    "- Máximo 220 caracteres por mensaje."
  ].join("\n");

  const user = [
    "Genera un mensaje por cada horario.",
    "Horarios:",
    ...slotLines
  ].join("\n");

  const payload = {
    model,
    temperature: 0.6,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ]
  };

  const res = await fetch(`${endpoint.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload),
    cache: "no-store"
  });

  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  const content = String(json?.choices?.[0]?.message?.content ?? "").trim();
  if (!content) return null;

  const parsed = JSON.parse(content);
  const rows = Array.isArray(parsed?.messages) ? parsed.messages : [];
  const out: SlotMessage[] = rows
    .map((row: any) => ({
      localTime: String(row?.localTime ?? "").trim(),
      message: String(row?.message ?? "").trim()
    }))
    .filter((row: SlotMessage) => row.localTime && row.message);

  return out.length > 0 ? out : null;
}

export async function generateAutoPostDraftsSmart(input: GenerateAutoPostsInput): Promise<AutoPostDraft[]> {
  const slots = buildSlots(input);
  if (slots.length === 0) return [];

  let aiRows: SlotMessage[] | null = null;
  try {
    aiRows = await generateSlotMessagesWithOpenAI(slots);
  } catch {
    aiRows = null;
  }

  const byTime = new Map<string, string>();
  for (const row of aiRows ?? []) {
    if (!byTime.has(row.localTime)) byTime.set(row.localTime, row.message);
  }

  return slots.map((slot, index) => ({
    message: enforceSlotRules(slot, byTime.get(slot.localTime) ?? "", index),
    scheduledForUtc: chicagoLocalToUtcIso(slot.localDate, slot.localTime),
    localDate: slot.localDate,
    localTime: slot.localTime
  }));
}

function facebookConfig() {
  return {
    pageId: process.env.FACEBOOK_PAGE_ID ?? process.env.META_PAGE_ID ?? "",
    accessToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN ?? process.env.META_PAGE_ACCESS_TOKEN ?? "",
    graphVersion: process.env.FACEBOOK_GRAPH_VERSION ?? process.env.META_GRAPH_VERSION ?? "v24.0"
  };
}

export async function publishScheduledPostToFacebook(input: { message: string }) {
  const cfg = facebookConfig();
  if (!cfg.pageId || !cfg.accessToken) {
    throw new Error("Faltan FACEBOOK_PAGE_ID/FACEBOOK_PAGE_ACCESS_TOKEN (o META_PAGE_ID/META_PAGE_ACCESS_TOKEN).");
  }

  const message = normalizeMessage(String(input.message ?? ""), 500);
  if (!message) throw new Error("Mensaje vacío para publicar.");

  const posted = await postToFacebookPageFeed({
    pageId: cfg.pageId,
    pageAccessToken: cfg.accessToken,
    graphVersion: cfg.graphVersion,
    message
  });

  return {
    ok: true as const,
    postId: posted.postId
  };
}
