import "./globals.css";
import type { Metadata } from "next";
import { PageViewTracker } from "@/components/PageViewTracker";
import { Toaster } from "@/components/Toaster";
import { BottomStickyPromo } from "@/components/promotions/BottomStickyPromo";
import { PromoPopup } from "@/components/promotions/PromoPopup";
import { TermsConsentPopup } from "@/components/TermsConsentPopup";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.sinpelosenelmicrofono.com").replace(/\/+$/, "");
const ogImage = `${siteUrl}/logo.png`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Sin Pelos en el Micrófono",
  description: "Plataforma adulta independiente para contenido, comunidad y debate sin censura ideológica.",
  openGraph: {
    title: "Sin Pelos en el Micrófono",
    description: "Plataforma adulta independiente para contenido, comunidad y debate sin censura ideológica.",
    url: siteUrl,
    siteName: "Sin Pelos en el Micrófono",
    type: "website",
    images: [
      {
        url: ogImage,
        alt: "Sin Pelos en el Micrófono"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Sin Pelos en el Micrófono",
    description: "Plataforma adulta independiente para contenido, comunidad y debate sin censura ideológica.",
    images: [ogImage]
  },
  icons: {
    icon: [{ url: ogImage }],
    apple: [{ url: ogImage }]
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
