import "./globals.css";
import type { Metadata } from "next";
import { PageViewTracker } from "@/components/PageViewTracker";
import { Toaster } from "@/components/Toaster";
import { BottomStickyPromo } from "@/components/promotions/BottomStickyPromo";
import { PromoPopup } from "@/components/promotions/PromoPopup";
import { TermsConsentPopup } from "@/components/TermsConsentPopup";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.sinpelosenelmicrofono.com").replace(/\/+$/, "");
const iconImage = `${siteUrl}/logo.png`;
const socialImage = `${siteUrl}/og-share.png`;

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
      <body>
        <div className="splash" aria-hidden="true">
          <div className="splash-logo" />
        </div>
        <PageViewTracker />
        <TermsConsentPopup />
        <BottomStickyPromo />
        <PromoPopup />
        <Toaster />
        {children}
      </body>
    </html>
  );
}
