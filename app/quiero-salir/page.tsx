import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { GuestRequestForm } from "@/components/GuestRequestForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

