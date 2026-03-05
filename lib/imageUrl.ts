function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function extractGoogleDriveFileId(url: URL) {
  const path = cleanText(url.pathname);
  const fromFile = path.match(/\/file\/d\/([^/]+)/i)?.[1];
  const fromDirect = path.match(/\/d\/([^/]+)/i)?.[1];
  const fromQuery = url.searchParams.get("id");
  return cleanText(fromFile || fromDirect || fromQuery || "") || null;
}

export function normalizeImageUrl(raw: unknown) {
  const value = cleanText(raw);
  if (!value) return null;

  try {
    const url = new URL(value);
    const host = cleanText(url.hostname).toLowerCase();
    const isGoogleDrive = host === "drive.google.com" || host === "www.drive.google.com";

    if (isGoogleDrive) {
      const fileId = extractGoogleDriveFileId(url);
      if (!fileId) return value;
      return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1600`;
    }

    return value;
  } catch {
    return value;
  }
}
