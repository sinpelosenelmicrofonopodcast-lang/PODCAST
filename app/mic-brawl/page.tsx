import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Matchmaking } from "@/components/mic-brawl/Matchmaking";

export const metadata = {
  title: "Sin Pelos: 8-Bit Mic Brawl",
  description: "Mini juego retro multiplayer BEBO vs BITO con leaderboard y skins."
};

export default function MicBrawlPage() {
  return (
    <>
      <Navbar />
      <main className="section">
        <div className="container">
          <Matchmaking />
        </div>
      </main>
      <Footer />
    </>
  );
}

