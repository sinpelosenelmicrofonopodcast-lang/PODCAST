import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Leaderboard } from "@/components/mic-brawl/Leaderboard";

export const metadata = {
  title: "Mic Brawl Leaderboard | Sin Pelos en el Micrófono",
  description: "Top jugadores de Sin Pelos: 8-Bit Mic Brawl."
};

export default function MicBrawlLeaderboardPage() {
  return (
    <>
      <Navbar />
      <main className="section">
        <div className="container" style={{ display: "grid", gap: 14 }}>
          <Link className="button secondary" href="/mic-brawl">
            Volver a Mic Brawl
          </Link>
          <Leaderboard />
        </div>
      </main>
      <Footer />
    </>
  );
}

