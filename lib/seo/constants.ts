export const CANONICAL_SITE_URL = "https://www.sinpelosenelmicrofono.com";

export const PRIVATE_PATH_PREFIXES = [
  "/entrar",
  "/unirme",
  "/community",
  "/comunidad",
  "/zona-cruda",
  "/dashboard",
  "/admin",
  "/api"
] as const;

export const PRIVATE_PATH_EXACT = new Set<string>(["/entrar", "/unirme"]);

export const PUBLIC_CORE_PAGES = [
  "/",
  "/feed",
  "/noticias",
  "/podcast",
  "/eventos",
  "/acerca",
  "/contacto"
] as const;

export const DEFAULT_OG_IMAGE = `${CANONICAL_SITE_URL}/og-default.jpg`;
export const SITE_NAME = "Sin Pelos en el Micrófono";
export const PUBLISHER_NAME = "SPM News";

export function canonicalHost() {
  return new URL(CANONICAL_SITE_URL).host.toLowerCase();
}

export function canonicalUrl(pathOrUrl: string) {
  if (!pathOrUrl) return CANONICAL_SITE_URL;
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    const parsed = new URL(pathOrUrl);
    parsed.protocol = "https:";
    parsed.host = canonicalHost();
    if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    }
    return parsed.toString();
  }
  const normalizedPath = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  const noTrailingSlash = normalizedPath !== "/" ? normalizedPath.replace(/\/+$/, "") : normalizedPath;
  return `${CANONICAL_SITE_URL}${noTrailingSlash}`;
}
