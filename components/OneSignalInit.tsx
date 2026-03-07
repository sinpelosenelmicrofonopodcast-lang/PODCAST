"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  applyDefaultOneSignalInterestTags,
  configureOneSignalRuntime,
  getOneSignalPushState,
  isOneSignalClientConfigured,
  queueOneSignalInit,
  setOneSignalTags
} from "@/lib/onesignalWeb";

function inferSection(pathname: string) {
  if (pathname.startsWith("/noticias")) return "noticias";
  if (pathname.startsWith("/podcast")) return "podcast";
  if (pathname.startsWith("/eventos")) return "eventos";
  if (pathname.startsWith("/feed")) return "feed";
  if (pathname.startsWith("/regiones")) return "regiones";
  if (pathname.startsWith("/blog")) return "blog";
  return "home";
}

function buildRouteTags(pathname: string) {
  const section = inferSection(pathname);
  const tags: Record<string, string> = {
    site: "spm",
    lang: "es",
    last_section: section
  };

  if (section === "noticias") {
    tags.interest_news = "1";
    tags.interest_noticias = "1";
  }
  if (section === "podcast") tags.interest_podcast = "1";
  if (section === "eventos") {
    tags.interest_events = "1";
    tags.interest_eventos = "1";
  }
  if (section === "blog") tags.interest_blog = "1";

  const regionMatch = pathname.match(/^\/regiones\/([^/]+)/i);
  if (regionMatch?.[1]) {
    tags.region = regionMatch[1].toUpperCase();
    tags.interest_region = "1";
  }

  return tags;
}

type OneSignalInitProps = {
  appId?: string | null;
  safariWebId?: string | null;
};

export function OneSignalInit({ appId, safariWebId }: OneSignalInitProps) {
  const pathname = usePathname() ?? "/";

  useEffect(() => {
    configureOneSignalRuntime({ appId, safariWebId });
  }, [appId, safariWebId]);

  const configured = isOneSignalClientConfigured();

  useEffect(() => {
    if (!configured) return;
    // Fallback init path when head bootstrap is unavailable.
    queueOneSignalInit();
  }, [configured]);

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    (async () => {
      try {
        const state = await getOneSignalPushState();
        if (cancelled || !state.optedIn) return;
        await applyDefaultOneSignalInterestTags();
      } catch {
        // Non-blocking; tags will be retried from other entry points.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [configured]);

  useEffect(() => {
    if (!configured) return;
    const tags = buildRouteTags(pathname);
    setOneSignalTags(tags).catch(() => null);
  }, [configured, pathname]);

  return null;
}
