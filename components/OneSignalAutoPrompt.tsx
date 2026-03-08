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
const PUSH_PROMPT_SESSION_KEY = "spm_push_prompt_forced_session_v3";
const PUSH_PROMPT_LAST_DAY_KEY = "spm_push_prompt_last_day_v1";
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
    let initialDelayTimer: number | null = null;
    let postPromptDelayTimer: number | null = null;

    const today = new Date().toISOString().slice(0, 10);
    const accepted = window.localStorage.getItem(PUSH_CHOICE_STORAGE_KEY) === "accepted";
    if (accepted) return;
    if (window.localStorage.getItem(PUSH_PROMPT_LAST_DAY_KEY) === today) return;
    if (window.sessionStorage.getItem(PUSH_PROMPT_SESSION_KEY) === "1") return;

    queueOneSignalInit();
    const run = () => {
      initialDelayTimer = window.setTimeout(async () => {
        try {
          if (cancelled) return;

          const env = oneSignalEnvironmentChecks();
          if (!env.secureContext || !env.notificationApi) return;
          if (env.iosLike && !env.standalone) return;

          const initial = await getOneSignalPushState();
          if (!initial.supported || initial.optedIn || initial.permission === "denied") {
            window.localStorage.setItem(PUSH_PROMPT_LAST_DAY_KEY, today);
            return;
          }

          const result = await triggerOneSignalPrompt({ force: true });
          window.sessionStorage.setItem(PUSH_PROMPT_SESSION_KEY, "1");
          if (result.shown || result.reason === "already_subscribed") {
            window.localStorage.setItem(PUSH_PROMPT_LAST_DAY_KEY, today);
          }
          postPromptDelayTimer = window.setTimeout(async () => {
            try {
              if (cancelled) return;
              const next = await getOneSignalPushState();
              if (next.optedIn) {
                window.localStorage.setItem(PUSH_CHOICE_STORAGE_KEY, "accepted");
                await applyDefaultOneSignalInterestTags();
              }
            } catch {
              // No-op; next route view will retry lightweight tag sync.
            }
          }, 900);
        } catch {
          // No-op; keep day/session keys free so the user can retry quickly.
        }
      }, 1300);
    };

    run();
    return () => {
      cancelled = true;
      if (initialDelayTimer) window.clearTimeout(initialDelayTimer);
      if (postPromptDelayTimer) window.clearTimeout(postPromptDelayTimer);
    };
  }, [configured, pathname]);

  return null;
}
