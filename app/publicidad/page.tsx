import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { AdRequestForm } from "@/components/AdRequestForm";
import { ui } from "@/lib/i18n";
import { getServerLang } from "@/lib/i18nServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function PublicidadPage() {
  const lang = getServerLang();
  void ui[lang]; // Page-specific copy is inside the form (client); keep server lang for consistent SSR.
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
