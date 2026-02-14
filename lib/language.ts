export type AppLang = "es" | "en";

export const APP_LANG_STORAGE_KEY = "sinpelos_app_lang";
export const APP_LANG_EVENT = "sinpelos-language-change";

export function normalizeLang(value?: string | null): AppLang {
  return value?.toLowerCase().startsWith("en") ? "en" : "es";
}

export function detectBrowserLang(): AppLang {
  if (typeof navigator === "undefined") return "es";
  return normalizeLang(navigator.language || navigator.languages?.[0]);
}

export function readStoredLang(): AppLang | null {
  if (typeof window === "undefined") return null;
  const fromStorage = window.localStorage.getItem(APP_LANG_STORAGE_KEY);
  if (fromStorage) return normalizeLang(fromStorage);
  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith("googtrans="))
    ?.split("=")[1];
  if (!cookie) return null;
  const parts = decodeURIComponent(cookie).split("/");
  return normalizeLang(parts[parts.length - 1]);
}

export function writeLangPersistence(lang: AppLang) {
  if (typeof window === "undefined") return;
  const value = `/es/${lang}`;
  const host = window.location.hostname;
  const hostParts = host.split(".");
  const baseDomain = hostParts.length > 2 ? `.${hostParts.slice(-2).join(".")}` : host;

  window.localStorage.setItem(APP_LANG_STORAGE_KEY, lang);
  document.cookie = `googtrans=${value};path=/`;
  document.cookie = `googtrans=${value};path=/;domain=${baseDomain}`;
}

export function emitLanguageChange(lang: AppLang) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(APP_LANG_EVENT, { detail: { lang } }));
}

