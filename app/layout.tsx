import "./globals.css";
import type { Metadata } from "next";
import { PageViewTracker } from "@/components/PageViewTracker";
import { Toaster } from "@/components/Toaster";
import { BottomStickyPromo } from "@/components/promotions/BottomStickyPromo";
import { PromoPopup } from "@/components/promotions/PromoPopup";

export const metadata: Metadata = {
  title: "Sin Pelos en el Micrófono",
  description: "Plataforma adulta independiente para contenido, comunidad y debate sin censura ideológica.",
  icons: {
    icon: [{ url: "/logo.png" }],
    apple: [{ url: "/logo.png" }]
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
        <BottomStickyPromo />
        <PromoPopup />
        <Toaster />
        {children}
      </body>
    </html>
  );
}
