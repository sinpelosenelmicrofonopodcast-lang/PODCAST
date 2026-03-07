"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  applyDefaultOneSignalInterestTags,
  getOneSignalPushState,
  humanizeOneSignalError,
  isOneSignalClientConfigured,
  oneSignalEnvironmentChecks,
  queueOneSignalInit,
  requestOneSignalPermission,
  triggerOneSignalPrompt,
  type OneSignalPushState
} from "@/lib/onesignalWeb";

const NOT_AVAILABLE = "Push no disponible";
const ENABLE_CTA = "Activar alertas";
const ENABLED = "Alertas activas";
const BLOCKED = "Alertas bloqueadas";
const PUSH_CHOICE_STORAGE_KEY = "spm_push_choice";

export function OneSignalPromptButton() {
  const configured = isOneSignalClientConfigured();
  const [state, setState] = useState<OneSignalPushState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshState = useCallback(async () => {
    if (!configured) return;
    try {
      const next = await getOneSignalPushState();
      setState(next);
      setError(null);
    } catch (e) {
      setError(humanizeOneSignalError(e));
    }
  }, [configured]);

  useEffect(() => {
    if (!configured) return;
    queueOneSignalInit();
    setLoading(true);
    refreshState().finally(() => setLoading(false));
  }, [configured, refreshState]);

  const buttonLabel = useMemo(() => {
    if (!state) return loading ? "Cargando alertas..." : ENABLE_CTA;
    if (!state.supported) return NOT_AVAILABLE;
    if (state.optedIn) return ENABLED;
    if (state.permission === "denied") return BLOCKED;
    return ENABLE_CTA;
  }, [loading, state]);

  const title = useMemo(() => {
    if (!state) return "Recibe alertas de noticias y episodios en tu navegador.";
    if (!state.supported) return "Este navegador o dispositivo no soporta web push.";
    if (state.permission === "denied") return "Debes desbloquear notificaciones en la configuración del navegador.";
    if (state.optedIn) return "Ya estás suscrito a alertas web push.";
    return "Activa alertas para noticias urgentes, podcast y eventos.";
  }, [state]);

  const handleEnable = useCallback(async () => {
    if (!configured) return;
    setLoading(true);
    const env = oneSignalEnvironmentChecks();
    if (env.iosLike && !env.standalone) {
      setError("En iPhone: usa Safari + Agregar a pantalla de inicio para activar notificaciones.");
      setLoading(false);
      return;
    }
    if (!env.secureContext) {
      setError("Push requiere HTTPS.");
      setLoading(false);
      return;
    }
    if (!env.notificationApi) {
      setError("Este navegador no soporta web push.");
      setLoading(false);
      return;
    }
    try {
      await triggerOneSignalPrompt({ force: true });
      await new Promise((resolve) => window.setTimeout(resolve, 1200));
      let next = await getOneSignalPushState();
      if (!next.optedIn && next.permission !== "denied") {
        next = await requestOneSignalPermission();
      }
      setState(next);
      if (next.optedIn) {
        window.localStorage.setItem(PUSH_CHOICE_STORAGE_KEY, "accepted");
        await applyDefaultOneSignalInterestTags();
      }
      if (next.permission === "denied") {
        setError("Notificaciones bloqueadas. Actívalas desde ajustes del navegador.");
      } else {
        setError(null);
      }
    } catch (e) {
      setError(humanizeOneSignalError(e));
    } finally {
      setLoading(false);
    }
  }, [configured]);

  if (!configured) return null;

  const disabled = loading || state?.supported === false || state?.optedIn === true;
  const isActive = Boolean(state?.optedIn);

  return (
    <button
      type="button"
      className={`button secondary nav-push-button${isActive ? " is-active" : ""}`}
      onClick={handleEnable}
      disabled={disabled}
      title={error ?? title}
      aria-label={error ?? title}
    >
      {buttonLabel}
    </button>
  );
}
