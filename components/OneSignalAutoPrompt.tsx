"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  applyDefaultOneSignalInterestTags,
  configureOneSignalRuntime,
  getOneSignalPushState,
  isOneSignalClientConfigured,
  oneSignalEnvironmentChecks,
  queueOneSignalInit,
  triggerOneSignalPrompt
} from "@/lib/onesignalWeb";

const PUSH_CHOICE_STORAGE_KEY = "spm_push_choice";
const PUSH_PROMPT_SESSION_KEY = "spm_push_prompt_forced_session_v2";
const SKIP_PATH_PREFIXES = ["/admin", "/entrar", "/unirme", "/dashboard"];

type OneSignalAutoPromptProps = {
  appId?: string | null;
  safariWebId?: string | null;
};

export function OneSignalAutoPrompt({ appId, safariWebId }: OneSignalAutoPromptProps) {
  const pathname = usePathname() ?? "/";
  const hasExplicitConfig = String(appId ?? "").trim().length > 0;
  const configured = hasExplicitConfig || isOneSignalClientConfigured();

  useEffect(() => {
    if (!hasExplicitConfig) return;
    configureOneSignalRuntime({ appId, safariWebId });
  }, [appId, hasExplicitConfig, safariWebId]);

  useEffect(() => {
    if (!configured) return;
    if (SKIP_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return;

    let cancelled = false;
    queueOneSignalInit();

    const run = async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 1300));
      if (cancelled) return;

      const env = oneSignalEnvironmentChecks();
      if (!env.secureContext || !env.notificationApi) return;
      if (env.iosLike && !env.standalone) return;

      if (window.sessionStorage.getItem(PUSH_PROMPT_SESSION_KEY) === "1") return;
      window.sessionStorage.setItem(PUSH_PROMPT_SESSION_KEY, "1");

      const initial = await getOneSignalPushState();
      if (!initial.supported || initial.optedIn || initial.permission === "denied") {
        return;
      }

      await triggerOneSignalPrompt({ force: true });
      await new Promise((resolve) => window.setTimeout(resolve, 900));

      const next = await getOneSignalPushState();
      if (next.optedIn) {
        window.localStorage.setItem(PUSH_CHOICE_STORAGE_KEY, "accepted");
        await applyDefaultOneSignalInterestTags();
      }
    };

    run().catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [configured, pathname]);

  return null;
}
