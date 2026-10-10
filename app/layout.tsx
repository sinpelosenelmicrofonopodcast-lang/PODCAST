import "./globals.css";
import "./spm-rebrand.css";
import "./home-rebrand.css";
import "./spm-polish.css";
import "./site-refresh.css";
import "./news-refresh.css";
import "./audit-fixes.css";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import Script from "next/script";
import { Bebas_Neue, Manrope } from "next/font/google";
import { CANONICAL_SITE_URL } from "@/lib/seo/constants";

const displayFont = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-spm-display",
  display: "swap"
});

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-spm-body",
  display: "swap"
});

const PageViewTracker = dynamic(() => import("@/components/PageViewTracker").then((m) => m.PageViewTracker), { ssr: false });
const OneSignalInit = dynamic(() => import("@/components/OneSignalInit").then((m) => m.OneSignalInit), { ssr: false });
const OneSignalAutoPrompt = dynamic(() => import("@/components/OneSignalAutoPrompt").then((m) => m.OneSignalAutoPrompt), {
  ssr: false
});
const Toaster = dynamic(() => import("@/components/Toaster").then((m) => m.Toaster), { ssr: false });
const BottomStickyPromo = dynamic(
  () => import("@/components/promotions/BottomStickyPromo").then((m) => m.BottomStickyPromo),
  { ssr: false }
);
const PromoPopup = dynamic(() => import("@/components/promotions/PromoPopup").then((m) => m.PromoPopup), { ssr: false });
const TermsConsentPopup = dynamic(() => import("@/components/TermsConsentPopup").then((m) => m.TermsConsentPopup), {
  ssr: false
});

const siteUrl = CANONICAL_SITE_URL;
const iconImage = `${siteUrl}/logo.png`;
const socialImage = `${siteUrl}/og-share.png`;
const oneSignalAppId = String(process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? process.env.ONESIGNAL_APP_ID ?? "").trim();
const oneSignalSafariWebId = String(
  process.env.NEXT_PUBLIC_ONESIGNAL_SAFARI_WEB_ID ?? process.env.ONESIGNAL_SAFARI_WEB_ID ?? ""
).trim();

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${siteUrl}/#organization`,
  name: "Sin Pelos en el Micrófono",
  legalName: "B&B Entertainment Hub LLC",
  url: siteUrl,
  logo: {
    "@type": "ImageObject",
    url: iconImage
  },
  sameAs: [
    "https://www.facebook.com/sinpelosenelmicrofono",
    "https://www.instagram.com/sinpelosenelmicrofono",
    "https://www.tiktok.com/@sinpelosenelmicrofono",
    "https://www.youtube.com/@SinPelosEnElMicrofono"
  ]
};

const structuredData = [
  organizationSchema,
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    url: siteUrl,
    name: "Sin Pelos en el Micrófono",
    inLanguage: "es",
    publisher: { "@id": `${siteUrl}/#organization` }
  },
  {
    "@context": "https://schema.org",
    "@type": "PodcastSeries",
    "@id": `${siteUrl}/podcast#series`,
    name: "Sin Pelos en el Micrófono",
    url: `${siteUrl}/podcast`,
    description: "Conversaciones de Bebo y Bito con historias de Puerto Rico y Texas.",
    inLanguage: "es",
    publisher: { "@id": `${siteUrl}/#organization` }
  }
];

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Sin Pelos en el Micrófono | Podcast de Bebo y Bito",
  description: "Podcast de Bebo y Bito con conversaciones reales, invitados, música, cultura y noticias. Historias de Puerto Rico y Texas, sin libreto.",
  applicationName: "Sin Pelos en el Micrófono",
  // Site ownership for the existing AdSense publisher. This does NOT enable ads.
  other: { "google-adsense-account": "ca-pub-4245621675541095" },
  category: "entertainment",
  openGraph: {
    title: "Sin Pelos en el Micrófono",
    description: "Podcast, historias, noticias y comunidad. Conversación real, sin libreto y sin filtros.",
    url: siteUrl,
    siteName: "Sin Pelos en el Micrófono",
    type: "website",
    locale: "es_PR",
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
    description: "Podcast, historias, noticias y comunidad. Conversación real, sin libreto y sin filtros.",
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
    <html lang="es" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <head>
        {/* Verification requires the literal ad script in the server-rendered HTML <head>.
            Next Script beforeInteractive only serialized a preload + bootstrap entry. */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4245621675541095"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <a className="skip-link" href="#main-content">Saltar al contenido</a>
        <PageViewTracker />
        <OneSignalInit appId={oneSignalAppId} safariWebId={oneSignalSafariWebId} />
        <OneSignalAutoPrompt appId={oneSignalAppId} safariWebId={oneSignalSafariWebId} />
        <TermsConsentPopup />
        <BottomStickyPromo />
        <PromoPopup />
        <Toaster />
        <Script
          id="sin-pelos-tawk-chat"
          src="https://embed.tawk.to/6ac6d67906b5f534c9ea43f2/1k4cbbig4"
          strategy="afterInteractive"
        />
        <div id="main-content">{children}</div>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </body>
    </html>
  );
}
