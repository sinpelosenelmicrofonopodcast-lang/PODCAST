import { PRIVATE_PATH_EXACT, PRIVATE_PATH_PREFIXES } from "@/lib/seo/constants";

function cleanPath(pathname: string) {
  const value = String(pathname || "/").split("?")[0].split("#")[0] || "/";
  if (value === "/") return "/";
  return value.endsWith("/") ? value.replace(/\/+$/, "") : value;
}

export function isPrivateSeoPath(pathname: string) {
  const path = cleanPath(pathname);
  if (PRIVATE_PATH_EXACT.has(path)) return true;
  return PRIVATE_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

