import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sin Pelos en el Micrófono",
  description: "Plataforma adulta independiente para contenido, comunidad y debate sin censura ideológica."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <div className="splash" aria-hidden="true">
          <div className="splash-logo" />
        </div>
        {children}
      </body>
    </html>
  );
}
