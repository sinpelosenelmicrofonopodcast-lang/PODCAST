import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Skins } from "@/components/mic-brawl/Skins";

export const metadata = {
  title: "Mic Brawl Skins | Sin Pelos en el Micrófono",
  description: "Desbloquea y equipa skins en Sin Pelos: 8-Bit Mic Brawl."
};

export default function MicBrawlSkinsPage() {
  return (
    <>
      <Navbar />
      <main className="section">
        <div className="container" style={{ display: "grid", gap: 14 }}>
          <Link className="button secondary" href="/mic-brawl">
            Volver a Mic Brawl
          </Link>
          <Skins />
        </div>
      </main>
      <Footer />
    </>
  );
}

