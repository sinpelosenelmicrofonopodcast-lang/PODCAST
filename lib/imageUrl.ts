function cleanText(value: unknown) {
  return String(value ?? "").trim();
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
