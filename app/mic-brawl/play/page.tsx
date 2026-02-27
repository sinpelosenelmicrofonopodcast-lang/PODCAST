import { Suspense } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { PlayClient } from "./PlayClient";

export const metadata = {
  title: "Jugar Mic Brawl | Sin Pelos en el Micrófono",
  description: "Arena retro BEBO vs BITO, online realtime con Supabase."
};

export default function MicBrawlPlayPage() {
  return (
    <>
      <Navbar />
      <main className="section">
        <Suspense fallback={<div className="container muted">Cargando modo de juego...</div>}>
          <PlayClient />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}

