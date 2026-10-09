import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { GuestRequestForm } from "@/components/GuestRequestForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Invitados | Participa en Sin Pelos en el Micrófono",
  description: "Propón tu entrevista o historia para el podcast de Bebo y Bito. Comunidad, cultura y negocios de Puerto Rico y Central Texas.",
  alternates: { canonical: "/quiero-salir" }
};

export default function QuieroSalirPage() {
  return (
    <main className="app-enter">
      <Navbar />
      <section className="section">
        <div className="container" style={{ maxWidth: 860 }}>
          <GuestRequestForm />
        </div>
      </section>
      <Footer />
    </main>
  );
}

