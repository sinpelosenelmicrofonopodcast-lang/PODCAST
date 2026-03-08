"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  applyDefaultOneSignalInterestTags,
  configureOneSignalRuntime,
  getOneSignalPushState,
  getOneSignalRuntimeDebug,
  humanizeOneSignalError,
  isOneSignalClientConfigured,
  oneSignalEnvironmentChecks,
  queueOneSignalInit,
  requestOneSignalPermission,
  triggerOneSignalPrompt,
  type OneSignalPushState
} from "@/lib/onesignalWeb";
import { toast } from "@/lib/toast";

const PUSH_CHOICE_STORAGE_KEY = "spm_push_choice";

export function OneSignalFloatingBell({ appId, safariWebId }: { appId?: string | null; safariWebId?: string | null }) {
  const hasExplicitConfig = String(appId ?? "").trim().length > 0;
  const configured = hasExplicitConfig || isOneSignalClientConfigured();
  const [state, setState] = useState<OneSignalPushState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasExplicitConfig) return;
    configureOneSignalRuntime({ appId, safariWebId });
  }, [appId, hasExplicitConfig, safariWebId]);

  const refresh = useCallback(async () => {
    if (!configured) return;
    const next = await getOneSignalPushState();
    setState(next);
  }, [configured]);

  useEffect(() => {
    if (!configured) return;
    queueOneSignalInit();
    setLoading(true);
    refresh()
      .catch((e) => setError(humanizeOneSignalError(e)))
      .finally(() => setLoading(false));
  }, [configured, refresh]);

  const onClick = useCallback(async () => {
    if (!configured) return;
    setLoading(true);
    setError(null);
    try {
      const before = await getOneSignalPushState();
      if (before.optedIn) {
        await applyDefaultOneSignalInterestTags();
        toast.success("Ya estás suscrito a alertas.");
        setState(before);
        return;
      }

      await triggerOneSignalPrompt({ force: true });
      await new Promise((resolve) => window.setTimeout(resolve, 900));

      let next = await getOneSignalPushState();
      if (!next.optedIn && next.permission !== "denied") {
        // Fallback to native permission request in the same user interaction flow.
        next = await requestOneSignalPermission();
      }
      setState(next);
      if (next.optedIn) {
        window.localStorage.setItem(PUSH_CHOICE_STORAGE_KEY, "accepted");
        await applyDefaultOneSignalInterestTags();
        toast.success("Alertas activadas correctamente.");
      } else if (next.permission === "denied") {
        toast.error("Notificaciones bloqueadas. Debes habilitarlas en ajustes del navegador.");
      } else if (!next.supported) {
        toast.error("Este dispositivo no soporta web push.");
      } else {
        const debug = getOneSignalRuntimeDebug();
        const reason = debug?.initError ? ` (${debug.initError})` : "";
        toast.error(`No se pudo completar la suscripción${reason}`);
      }
    } catch (e) {
      const message = humanizeOneSignalError(e);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [configured]);

  const statusClass = useMemo(() => {
    if (!state?.supported) return "is-off";
    if (state.optedIn) return "is-on";
    if (state.permission === "denied") return "is-blocked";
    return "is-off";
  }, [state]);

  const title = useMemo(() => {
    if (error) return error;
    if (!configured) return "OneSignal no está configurado todavía.";
    if (!state) return "Activar notificaciones";
    if (!state.supported) return "Este dispositivo no soporta notificaciones web push.";
    if (state.optedIn) return "Notificaciones activas.";
    if (state.permission === "denied") return "Notificaciones bloqueadas en el navegador.";
    return "Activar notificaciones";
  }, [error, state]);

  const isDisabled = loading || !configured;

  return (
    <button
      type="button"
      className={`onesignal-fab ${statusClass}`}
      onClick={onClick}
      disabled={isDisabled}
      aria-label={title}
      title={title}
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 3a6 6 0 0 0-6 6v3.2c0 .9-.3 1.8-.86 2.5L4 16h16l-1.14-1.3a3.8 3.8 0 0 1-.86-2.5V9a6 6 0 0 0-6-6Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M9.5 18a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span>{state?.optedIn ? "Alertas ON" : "Alertas"}</span>
    </button>
  );
}
