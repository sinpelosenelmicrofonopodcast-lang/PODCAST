import "./globals.css";
import type { Metadata } from "next";
import { PageViewTracker } from "@/components/PageViewTracker";
import { OneSignalInit } from "@/components/OneSignalInit";
import { OneSignalAutoPrompt } from "@/components/OneSignalAutoPrompt";
import { Toaster } from "@/components/Toaster";
import { BottomStickyPromo } from "@/components/promotions/BottomStickyPromo";
import { PromoPopup } from "@/components/promotions/PromoPopup";
import { TermsConsentPopup } from "@/components/TermsConsentPopup";
import { CANONICAL_SITE_URL } from "@/lib/seo/constants";

const siteUrl = CANONICAL_SITE_URL;
const iconImage = `${siteUrl}/logo.png`;
const socialImage = `${siteUrl}/og-share.png`;
const oneSignalAppId = String(process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? process.env.ONESIGNAL_APP_ID ?? "").trim();
const oneSignalSafariWebId = String(
  process.env.NEXT_PUBLIC_ONESIGNAL_SAFARI_WEB_ID ?? process.env.ONESIGNAL_SAFARI_WEB_ID ?? ""
).trim();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Sin Pelos en el Micrófono",
  description: "Noticias, podcast y comunidad en un solo lugar. Sin filtros, sin libreto y con conversación real.",
  openGraph: {
    title: "Sin Pelos en el Micrófono",
    description: "Noticias, podcast y comunidad en un solo lugar. Sin filtros, sin libreto y con conversación real.",
    url: siteUrl,
    siteName: "Sin Pelos en el Micrófono",
    type: "website",
    images: [
      {
        url: socialImage,
        width: 1200,
        height: 630,
        alt: "Sin Pelos en el Micrófono"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Sin Pelos en el Micrófono",
    description: "Noticias, podcast y comunidad en un solo lugar. Sin filtros, sin libreto y con conversación real.",
    images: [socialImage]
  },
  icons: {
    icon: [{ url: iconImage }],
    apple: [{ url: iconImage }]
  },
  manifest: "/manifest.webmanifest"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        {oneSignalAppId ? (
          <>
            <script id="onesignal-sdk-head" src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" defer />
            <script
              id="onesignal-init-head"
              dangerouslySetInnerHTML={{
                __html: `window.OneSignalDeferred = window.OneSignalDeferred || [];
window.__spmOneSignalInitQueued = true;
OneSignalDeferred.push(async function(OneSignal) {
  try {
    await OneSignal.init({
      appId: "${oneSignalAppId}",
      serviceWorkerPath: "/OneSignalSDKWorker.js",
      serviceWorkerUpdaterPath: "/OneSignalSDKUpdaterWorker.js",
      serviceWorkerParam: { scope: "/" },
      notifyButton: { enable: true, position: "bottom-right" }${oneSignalSafariWebId ? `,
      safari_web_id: "${oneSignalSafariWebId}"` : ""}
    });
    window.__spmOneSignalInitialized = true;
    window.__spmOneSignalInitError = undefined;
  } catch (e) {
    window.__spmOneSignalInitialized = false;
    window.__spmOneSignalInitQueued = false;
    window.__spmOneSignalInitError = String((e && e.message) || e || "OneSignal init failed");
  }
});`
              }}
            />
          </>
        ) : null}
      </head>
      <body>
        <div className="splash" aria-hidden="true">
          <div className="splash-logo" />
        </div>
        <PageViewTracker />
        <OneSignalInit appId={oneSignalAppId} safariWebId={oneSignalSafariWebId} />
        <OneSignalAutoPrompt appId={oneSignalAppId} safariWebId={oneSignalSafariWebId} />
        <TermsConsentPopup />
        <BottomStickyPromo />
        <PromoPopup />
        <Toaster />
        {children}
      </body>
    </html>
  );
}
