import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { AdRequestForm } from "@/components/AdRequestForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function PublicidadPage() {
  return (
    <main className="app-enter">
      <Navbar />
      <section className="section">
        <div className="container" style={{ maxWidth: 860 }}>
          <AdRequestForm />
        </div>
      </section>
      <Footer />
    </main>
  );
}

