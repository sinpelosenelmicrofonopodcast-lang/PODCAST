import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { PODCAST_RSS_URL } from "@/lib/podcastRss";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Podcast (Audio)",
  description: "Escucha Sin Pelos En El Micrófono en el reproductor oficial."
};

export default function RssPlayerPage() {
  return (
    <main>
      <Navbar />
      <section className="section">
        <div className="container">
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
              <h1 className="section-title" style={{ marginTop: 0 }}>
                Podcast (Audio)
              </h1>
              <a className="button secondary" href={PODCAST_RSS_URL} target="_blank" rel="noreferrer">
                RSS (XML)
              </a>
            </div>

            <p className="muted" style={{ marginTop: 8 }}>
              Reproductor embebido (tema oscuro).
            </p>

            <div className="rss-player" style={{ marginTop: 14 }}>
              <iframe
                src="https://player.rss.com/sin-pelos-en-el-microfono/?theme=dark&v=2"
                title="Sin Pelos En El Micrófono"
                width="100%"
                height="393"
                frameBorder={0}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                scrolling="no"
              >
                <a href="https://rss.com/podcasts/sin-pelos-en-el-microfono/">Sin Pelos En El Micrófono</a>
              </iframe>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}

