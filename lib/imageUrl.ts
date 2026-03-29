function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function safeTitle(value: unknown) {
  return cleanText(value).replace(/\s+/g, " ").slice(0, 120);
}

function extractGoogleDriveFileId(url: URL) {
  const path = cleanText(url.pathname);
  const fromFile = path.match(/\/file\/d\/([a-zA-Z0-9_-]+)/i)?.[1];
  const fromDirect = path.match(/\/d\/([a-zA-Z0-9_-]+)/i)?.[1];
  const fromUcPath = path.match(/\/uc\/([a-zA-Z0-9_-]+)/i)?.[1];
  const fromQuery = url.searchParams.get("id") || url.searchParams.get("file_id");
  return cleanText(fromFile || fromDirect || fromUcPath || fromQuery || "") || null;
}

function normalizeGoogleDriveImageUrl(url: URL) {
  const fileId = extractGoogleDriveFileId(url);
  if (!fileId) return null;
  const safeId = encodeURIComponent(fileId);

  // Most compatible direct image URL for public Drive files.
  return `https://drive.google.com/uc?export=view&id=${safeId}`;
}

export function normalizeImageUrl(raw: unknown) {
  let value = cleanText(raw);
  if (!value) return null;

  // Fix malformed scheme like "https:/example.com"
  value = value.replace(/^https?:\/(?!\/)/i, (m) => `${m}/`);
  if (/^www\./i.test(value)) {
    value = `https://${value}`;
  }

  try {
    const url = new URL(value);
    const host = cleanText(url.hostname).toLowerCase();
    const normalizedHost = host.replace(/^www\./, "");
    const isGoogleDrive =
      normalizedHost === "drive.google.com" ||
      normalizedHost === "docs.google.com" ||
      normalizedHost === "drive.usercontent.google.com";

    if (isGoogleDrive) {
      return normalizeGoogleDriveImageUrl(url) ?? value;
    }

    return value;
  } catch {
    if (/^data:image\//i.test(value) || value.startsWith("/")) return value;
    return value;
  }
}

export function shouldProxyImageUrl(raw: unknown) {
  const normalized = normalizeImageUrl(raw);
  if (!normalized) return false;
  if (normalized.startsWith("/") || /^data:image\//i.test(normalized)) return false;

  try {
    const url = new URL(normalized);
    const host = cleanText(url.hostname).toLowerCase().replace(/^www\./, "");
    return (
      host === "drive.google.com" ||
      host === "docs.google.com" ||
      host === "drive.usercontent.google.com" ||
      host.endsWith(".fbcdn.net") ||
      host === "lookaside.fbsbx.com"
    );
  } catch {
    return false;
  }
}

export function buildImageFallbackUrl(title: unknown) {
  const text = safeTitle(title) || "Sin Pelos";
  return `/api/image-proxy?title=${encodeURIComponent(text)}`;
}

export function buildRenderableImageUrl(raw: unknown, title?: unknown) {
  const normalized = normalizeImageUrl(raw);
  if (!normalized) return buildImageFallbackUrl(title);
  if (!shouldProxyImageUrl(normalized)) return normalized;
  const text = safeTitle(title);
  const qs = new URLSearchParams({ url: normalized });
  if (text) qs.set("title", text);
  return `/api/image-proxy?${qs.toString()}`;
}

export function buildImageFallbackSvg(title: unknown) {
  const text = safeTitle(title) || "Sin Pelos en el Microfono";
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="675" viewBox="0 0 1200 675" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="675" fill="#0D0A0B"/>
  <rect width="1200" height="675" fill="url(#bg)"/>
  <rect x="36" y="36" width="1128" height="603" rx="28" fill="url(#panel)" stroke="rgba(255,255,255,0.12)"/>
  <circle cx="1030" cy="155" r="210" fill="url(#glow1)" fill-opacity="0.65"/>
  <circle cx="190" cy="110" r="220" fill="url(#glow2)" fill-opacity="0.28"/>
  <rect x="84" y="88" width="248" height="54" rx="27" fill="#151214" stroke="rgba(255,255,255,0.14)"/>
  <text x="124" y="123" fill="#F8E4DB" font-size="28" font-weight="700" font-family="Arial, Helvetica, sans-serif">SIN PELOS</text>
  <text x="84" y="250" fill="#FFF4EF" font-size="62" font-weight="800" font-family="Arial, Helvetica, sans-serif">${escaped}</text>
  <text x="84" y="564" fill="#F7C6B3" font-size="28" font-weight="600" font-family="Arial, Helvetica, sans-serif">Imagen no disponible. Mostrando portada generada.</text>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="675" gradientUnits="userSpaceOnUse">
      <stop stop-color="#120D10"/>
      <stop offset="0.5" stop-color="#0A0A0A"/>
      <stop offset="1" stop-color="#161011"/>
    </linearGradient>
    <radialGradient id="glow1" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1030 155) rotate(90) scale(210)">
      <stop stop-color="#FF6A1A"/>
      <stop offset="1" stop-color="#FF6A1A" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(190 110) rotate(90) scale(220)">
      <stop stop-color="#7A0D0D"/>
      <stop offset="1" stop-color="#7A0D0D" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="panel" x1="36" y1="36" x2="1164" y2="639" gradientUnits="userSpaceOnUse">
      <stop stop-color="#1B1013" stop-opacity="0.96"/>
      <stop offset="1" stop-color="#1C181A" stop-opacity="0.88"/>
    </linearGradient>
  </defs>
</svg>`;
}
