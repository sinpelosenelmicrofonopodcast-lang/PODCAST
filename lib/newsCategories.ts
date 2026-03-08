export const newsCategories = [
  "PR",
  "TX",
  "USA",
  "Mundo",
  "Política",
  "Geopolítica",
  "Guerra",
  "Oriente",
  "Elecciones",
  "Migración",
  "Seguridad",
  "Justicia",
  "Crimen",
  "Medios",
  "Economía",
  "Energía",
  "Salud",
  "Ciencia",
  "Clima",
  "Tecnología",
  "Cultura",
  "Deporte",
  "Entretenimiento",
  "Música",
  "Emprendimiento"
];

const categoryByNormalized = new Map<string, string>(
  newsCategories.map((category) => [normalizeNewsCategoryKey(category), category])
);

function normalizeNewsCategoryKey(value: string) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export function normalizeNewsCategory(value: string | null | undefined) {
  const key = normalizeNewsCategoryKey(String(value ?? ""));
  if (!key) return null;
  return categoryByNormalized.get(key) ?? null;
}

export function cleanNewsCategories(input: Array<string | null | undefined> | null | undefined) {
  if (!Array.isArray(input)) return [] as string[];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    const normalized = normalizeNewsCategory(raw);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}
