"use client";

export type OneSignalPermissionState = "default" | "granted" | "denied";

export type OneSignalWebSdk = {
  init: (options: Record<string, unknown>) => Promise<void>;
  Slidedown?: {
    promptPush: (options?: { force?: boolean }) => Promise<void> | void;
    promptPushCategories?: (options?: { force?: boolean }) => Promise<void> | void;
  };
  Notifications: {
    requestPermission: () => Promise<void>;
    isPushSupported?: () => boolean;
    permission?: boolean | OneSignalPermissionState;
    addEventListener?: (event: string, listener: (...args: any[]) => void) => void;
    removeEventListener?: (event: string, listener: (...args: any[]) => void) => void;
  };
  User: {
    addTags: (tags: Record<string, string>) => Promise<void> | void;
    PushSubscription: {
      id: string | null;
      optedIn: boolean;
      optIn: () => Promise<void> | void;
      addEventListener?: (event: string, listener: (...args: any[]) => void) => void;
      removeEventListener?: (event: string, listener: (...args: any[]) => void) => void;
    };
  };
};

declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: OneSignalWebSdk) => void | Promise<void>>;
    __spmOneSignalInitQueued?: boolean;
    __spmOneSignalInitialized?: boolean;
    __spmOneSignalInitError?: string;
    __spmOneSignalAppId?: string;
    __spmOneSignalSafariWebId?: string;
    __spmOneSignalSdkLoadPromise?: Promise<void>;
  }
}

export const ONESIGNAL_WEB_SDK_SRC = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";

function isIosLike() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/i.test(ua);
}

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)")?.matches) return true;
  const nav = navigator as Navigator & { standalone?: boolean };
  return Boolean(nav.standalone);
}

export function oneSignalEnvironmentChecks() {
  const secureContext = typeof window !== "undefined" ? window.isSecureContext : false;
  const notificationApi = typeof window !== "undefined" && "Notification" in window;
  const iosLike = isIosLike();
  const standalone = isStandaloneMode();
  return { secureContext, notificationApi, iosLike, standalone };
}

async function ensureOneSignalSdkScriptLoaded(timeoutMs = 12000) {
  if (typeof window === "undefined") return;
  if (!window.__spmOneSignalSdkLoadPromise) {
    window.__spmOneSignalSdkLoadPromise = new Promise<void>((resolve, reject) => {
      const hasScript = Array.from(document.scripts).some((script) => String(script.src || "").includes("OneSignalSDK.page.js"));
      if (hasScript) {
        const checkReady = () => {
          if (window.OneSignalDeferred) {
            resolve();
            return;
          }
          window.setTimeout(checkReady, 150);
        };
        checkReady();
        return;
      }

      const script = document.createElement("script");
      script.src = ONESIGNAL_WEB_SDK_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("No se pudo cargar el SDK de OneSignal."));
      document.head.appendChild(script);
    });
  }

  let timeoutId = 0;
  const timeoutPromise = new Promise<void>((_resolve, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error("Tiempo agotado cargando SDK de OneSignal.")), timeoutMs);
  });

  try {
    await Promise.race([window.__spmOneSignalSdkLoadPromise, timeoutPromise]);
  } catch (error) {
    window.__spmOneSignalSdkLoadPromise = undefined;
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function ensureDeferredQueue() {
  if (typeof window === "undefined") return null;
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  return window.OneSignalDeferred;
}

function hasClientAppId() {
  return resolveAppId().length > 0;
}

function resolveAppId() {
  if (typeof window !== "undefined" && window.__spmOneSignalAppId) {
    return String(window.__spmOneSignalAppId).trim();
  }
  return String(process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? "").trim();
}

function resolveSafariWebId() {
  if (typeof window !== "undefined" && window.__spmOneSignalSafariWebId) {
    return String(window.__spmOneSignalSafariWebId).trim();
  }
  return String(process.env.NEXT_PUBLIC_ONESIGNAL_SAFARI_WEB_ID ?? "").trim();
}

export function configureOneSignalRuntime(config: { appId?: string | null; safariWebId?: string | null }) {
  if (typeof window === "undefined") return;
  const appId = String(config.appId ?? "").trim();
  const safariWebId = String(config.safariWebId ?? "").trim();
  if (appId) window.__spmOneSignalAppId = appId;
  if (safariWebId) window.__spmOneSignalSafariWebId = safariWebId;
}

export function isOneSignalClientConfigured() {
  return hasClientAppId();
}

export function queueOneSignalInit() {
  if (typeof window === "undefined") return;
  if (!hasClientAppId()) return;
  if (window.__spmOneSignalInitialized) return;

  const appId = resolveAppId();
  const safariWebId = resolveSafariWebId();
  const queue = ensureDeferredQueue();
  if (!queue) return;
  if (window.__spmOneSignalInitQueued) return;
  window.__spmOneSignalInitQueued = true;

  queue.push(async (OneSignal) => {
    if (window.__spmOneSignalInitialized) return;
    try {
      await OneSignal.init({
        appId,
        serviceWorkerPath: "/OneSignalSDKWorker.js",
        serviceWorkerUpdaterPath: "/OneSignalSDKUpdaterWorker.js",
        serviceWorkerParam: { scope: "/" },
        notifyButton: { enable: true, position: "bottom-right" },
        allowLocalhostAsSecureOrigin: process.env.NODE_ENV !== "production",
        ...(safariWebId ? { safari_web_id: safariWebId } : {})
      });
      window.__spmOneSignalInitialized = true;
      window.__spmOneSignalInitError = undefined;
    } catch (error) {
      window.__spmOneSignalInitialized = false;
      window.__spmOneSignalInitQueued = false;
      window.__spmOneSignalInitError = String((error as any)?.message ?? error ?? "OneSignal init failed");
      throw error;
    }
  });
}

export async function withOneSignal<T>(fn: (sdk: OneSignalWebSdk) => Promise<T> | T, timeoutMs = 12000): Promise<T> {
  await ensureOneSignalSdkScriptLoaded(timeoutMs);
  const queue = ensureDeferredQueue();
  if (!queue) throw new Error("OneSignal no está disponible en servidor.");

  return await new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error("OneSignal no respondió a tiempo."));
    }, timeoutMs);

    queue.push(async (sdk) => {
      try {
        const result = await fn(sdk);
        window.clearTimeout(timer);
        resolve(result);
      } catch (e) {
        window.clearTimeout(timer);
        reject(e);
      }
    });
  });
}

export type OneSignalPushState = {
  supported: boolean;
  permission: OneSignalPermissionState;
  optedIn: boolean;
  subscriptionId: string | null;
};

export type OneSignalPromptResult = {
  shown: boolean;
  channel: "slidedown_categories" | "slidedown" | "native" | "none";
  reason?: "unsupported" | "already_subscribed";
};

export const DEFAULT_ONE_SIGNAL_INTEREST_TAGS: Record<string, string> = {
  push_opt_in: "1",
  push_all: "1",
  interest_news: "1",
  interest_noticias: "1",
  interest_blog: "1",
  interest_podcast: "1"
};

function normalizePermission(value: unknown): OneSignalPermissionState {
  if (value === true || value === "granted") return "granted";
  if (value === false || value === "denied") return "denied";
  return "default";
}

function getBrowserPermission(): OneSignalPermissionState {
  if (typeof window === "undefined") return "default";
  if (typeof Notification === "undefined") return "default";
  return normalizePermission(Notification.permission);
}

export async function getOneSignalPushState(): Promise<OneSignalPushState> {
  return await withOneSignal(async (sdk) => {
    const supported = sdk.Notifications?.isPushSupported ? Boolean(sdk.Notifications.isPushSupported()) : "Notification" in window;
    const permission = normalizePermission(sdk.Notifications?.permission ?? getBrowserPermission());
    if (!supported) {
      return { supported: false, permission, optedIn: false, subscriptionId: null };
    }
    return {
      supported: true,
      permission,
      optedIn: Boolean(sdk.User?.PushSubscription?.optedIn),
      subscriptionId: sdk.User?.PushSubscription?.id ?? null
    };
  });
}

export async function requestOneSignalPermission(): Promise<OneSignalPushState> {
  const env = oneSignalEnvironmentChecks();
  if (!env.secureContext) {
    throw new Error("Push requiere HTTPS.");
  }
  if (!env.notificationApi) {
    throw new Error("Este navegador no soporta notificaciones.");
  }
  if (env.iosLike && !env.standalone) {
    throw new Error("En iPhone, agrega el sitio a pantalla de inicio para activar push.");
  }

  return await withOneSignal(async (sdk) => {
    const supported = sdk.Notifications?.isPushSupported ? Boolean(sdk.Notifications.isPushSupported()) : "Notification" in window;
    let permission = normalizePermission(sdk.Notifications?.permission ?? getBrowserPermission());
    if (!supported) {
      return { supported: false, permission, optedIn: false, subscriptionId: null };
    }

    if (permission !== "granted") {
      await sdk.Notifications.requestPermission();
      permission = normalizePermission(sdk.Notifications?.permission ?? getBrowserPermission());
    }
    if (permission === "granted" && !sdk.User.PushSubscription.optedIn) {
      await sdk.User.PushSubscription.optIn();
    }

    return {
      supported: true,
      permission,
      optedIn: Boolean(sdk.User.PushSubscription.optedIn),
      subscriptionId: sdk.User.PushSubscription.id ?? null
    };
  });
}

export async function triggerOneSignalPrompt(options?: { force?: boolean }): Promise<OneSignalPromptResult> {
  const env = oneSignalEnvironmentChecks();
  if (!env.secureContext) {
    throw new Error("Push requiere HTTPS.");
  }
  if (!env.notificationApi) {
    throw new Error("Este navegador no soporta notificaciones.");
  }
  if (env.iosLike && !env.standalone) {
    throw new Error("En iPhone, agrega el sitio a pantalla de inicio para activar push.");
  }

  return await withOneSignal(async (sdk) => {
    const supported = sdk.Notifications?.isPushSupported ? Boolean(sdk.Notifications.isPushSupported()) : "Notification" in window;
    const permission = normalizePermission(sdk.Notifications?.permission ?? getBrowserPermission());
    if (!supported) {
      return { shown: false, channel: "none", reason: "unsupported" } as OneSignalPromptResult;
    }
    if (permission === "granted" || sdk.User?.PushSubscription?.optedIn) {
      return { shown: false, channel: "none", reason: "already_subscribed" } as OneSignalPromptResult;
    }

    const force = options?.force === true ? { force: true } : undefined;
    if (typeof sdk.Slidedown?.promptPushCategories === "function") {
      await sdk.Slidedown.promptPushCategories(force);
      return { shown: true, channel: "slidedown_categories" } as OneSignalPromptResult;
    }
    if (typeof sdk.Slidedown?.promptPush === "function") {
      await sdk.Slidedown.promptPush(force);
      return { shown: true, channel: "slidedown" } as OneSignalPromptResult;
    }

    await sdk.Notifications.requestPermission();
    if (normalizePermission(sdk.Notifications?.permission ?? getBrowserPermission()) === "granted" && !sdk.User.PushSubscription.optedIn) {
      await sdk.User.PushSubscription.optIn();
    }
    return { shown: true, channel: "native" } as OneSignalPromptResult;
  });
}

export function humanizeOneSignalError(error: unknown) {
  const raw = String((error as any)?.message ?? error ?? "").trim();
  if (!raw) return "No se pudo activar notificaciones ahora mismo.";
  if (/timed out|tiempo agotado|no respondió/i.test(raw)) {
    return "OneSignal tardó demasiado en responder. Inténtalo de nuevo.";
  }
  if (/https|secure context/i.test(raw)) {
    return "Push requiere entrar por HTTPS.";
  }
  if (/pantalla de inicio|home screen/i.test(raw)) {
    return "En iPhone: abre en Safari y agrega esta web a pantalla de inicio.";
  }
  if (/bloquead|denied/i.test(raw)) {
    return "Notificaciones bloqueadas. Debes habilitarlas en ajustes del navegador.";
  }
  if (/sdk/i.test(raw)) {
    return "No se pudo cargar OneSignal (revisa bloqueadores de contenido).";
  }
  return raw.slice(0, 180);
}

export function getOneSignalRuntimeDebug() {
  if (typeof window === "undefined") return null;
  const env = oneSignalEnvironmentChecks();
  return {
    ...env,
    appId: resolveAppId(),
    initQueued: Boolean(window.__spmOneSignalInitQueued),
    initialized: Boolean(window.__spmOneSignalInitialized),
    initError: String(window.__spmOneSignalInitError ?? "").trim() || null,
    notificationPermission: typeof Notification !== "undefined" ? String(Notification.permission ?? "default") : "unsupported"
  };
}

function sanitizeTag(value: string, fallback = "unknown") {
  const clean = String(value ?? "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_\-]/g, "")
    .slice(0, 64);
  return clean || fallback;
}

export async function setOneSignalTags(tags: Record<string, string>) {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(tags)) {
    const safeKey = sanitizeTag(key, "");
    if (!safeKey) continue;
    const safeValue = sanitizeTag(value);
    clean[safeKey] = safeValue;
  }
  if (Object.keys(clean).length === 0) return;
  await withOneSignal(async (sdk) => {
    await sdk.User.addTags(clean);
  });
}

export async function applyDefaultOneSignalInterestTags(extraTags?: Record<string, string>) {
  await setOneSignalTags({
    ...DEFAULT_ONE_SIGNAL_INTEREST_TAGS,
    ...(extraTags ?? {})
  });
}
