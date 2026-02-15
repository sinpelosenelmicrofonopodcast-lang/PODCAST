import { cookies, headers } from "next/headers";
import { normalizeLang, type AppLang } from "@/lib/language";

// Server-side language resolution (used by Server Components).
// We keep the brand name untranslated; only UI chrome uses this.
export function getServerLang(): AppLang {
  const fromCookie = cookies().get("sp_lang")?.value ?? null;
  if (fromCookie) return normalizeLang(fromCookie);

  const accept = headers().get("accept-language") ?? null;
  return normalizeLang(accept);
}

