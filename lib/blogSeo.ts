export function slugify(input: string) {
  const s = String(input ?? "")
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return s || "post";
}

export function estimateReadingTimeMinutes(text: string) {
  const words = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean).length;
  // Typical adult reading speed: 200-250 wpm. Use 220 to avoid optimistic times.
  const minutes = Math.max(1, Math.round(words / 220));
  return minutes;
}

export function clampMetaDescription(input: string) {
  const s = String(input ?? "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  if (s.length <= 160) return s;
  return s.slice(0, 157).replace(/\s+\S*$/, "").trim() + "...";
}

