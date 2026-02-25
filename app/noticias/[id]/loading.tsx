import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export default function LoadingNoticiaDetail() {
  return (
    <main>
      <Navbar />
      <section className="section news-article-page">
        <div className="container news-article-container">
          <div className="card news-article-hero news-article-skeleton">
            <div className="news-article-cover news-skeleton-block" />
            <div className="news-article-meta-row">
              <div className="news-skeleton-line" style={{ width: 220 }} />
              <div className="news-skeleton-line" style={{ width: 130 }} />
            </div>
          </div>

          <div className="news-article-layout">
            <article className="card news-article-main news-article-skeleton">
              <div className="news-skeleton-line" style={{ width: "45%" }} />
              <div className="news-skeleton-line" style={{ width: "100%" }} />
              <div className="news-skeleton-line" style={{ width: "95%" }} />
              <div className="news-skeleton-line" style={{ width: "90%" }} />
              <div className="news-skeleton-line" style={{ width: "88%" }} />
            </article>
            <aside className="news-article-sidebar">
              <div className="card news-article-skeleton">
                <div className="news-skeleton-line" style={{ width: "60%" }} />
                <div className="news-skeleton-line" style={{ width: "100%" }} />
                <div className="news-skeleton-line" style={{ width: "94%" }} />
              </div>
            </aside>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
