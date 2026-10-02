"use client";

import { useMemo, useState } from "react";
import { authApiRequest } from "@/lib/clientApi";

type Mode = "podcast" | "news";

type Evidence = { label: string; detail: string; evidence: string; timestamp?: string | null };
type Result = {
  mode: Mode;
  score: number;
  scoreReason: string;
  summary: string;
  facts: string[];
  teachings: Evidence[];
  impacts: Evidence[];
  quotes: Array<{ quote: string; timestamp: string | null; context: string; verified: boolean }>;
  whyItMatters: string;
  plainLanguage: string;
  spmAngle: string;
  articleIdeas: Array<{ title: string; angle: string; searchIntent: string; score: number }>;
  draft: {
    title: string;
    dek: string;
    excerpt: string;
    body: string;
    seoTitle: string;
    metaDescription: string;
    slug: string;
    keywords: string[];
    tags: string[];
    category: string;
  };
  social: { facebook: string; youtubeCommunity: string; reelHooks: string[] };
  review: {
    claimsNeedingReview: string[];
    missingContext: string[];
    publicationRecommendation: "draft" | "review" | "ready";
  };
  model: string;
};

const emptyPodcast = {
  episode: "",
  title: "",
  guest: "",
  sourceUrl: "",
  metadata: "",
  transcript: ""
};

const emptyNews = {
  title: "",
  sourceName: "",
  sourceUrl: "",
  region: "PR",
  sourceText: "",
  additionalSources: ""
};

function RecommendationBadge({ value }: { value: Result["review"]["publicationRecommendation"] }) {
  const label = value === "ready" ? "LISTO PARA REVISIÓN FINAL" : value === "review" ? "REQUIERE REVISIÓN" : "BORRADOR";
  return <span className={`editorial-status editorial-status-${value}`}>{label}</span>;
}

function EvidenceGrid({ title, eyebrow, items }: { title: string; eyebrow: string; items: Evidence[] }) {
  return (
    <section className="editorial-result-section">
      <div className="editorial-section-heading">
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {items.length ? (
        <div className="editorial-evidence-grid">
          {items.map((item, index) => (
            <article className="editorial-evidence-card" key={`${item.label}-${index}`}>
              <div className="editorial-number">{String(index + 1).padStart(2, "0")}</div>
              <div>
                <h3>{item.label}</h3>
                <p>{item.detail}</p>
                <div className="editorial-evidence-source">
                  <strong>Evidencia</strong>
                  <span>{item.evidence || "Sin evidencia textual suficiente."}</span>
                  {item.timestamp ? <small>Momento: {item.timestamp}</small> : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="muted">El agente no encontró material suficiente para esta sección.</p>
      )}
    </section>
  );
}

function CopyButton({ value, label = "Copiar" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };
  return (
    <button type="button" className="editorial-copy" onClick={copy} disabled={!value}>
      {copied ? "Copiado" : label}
    </button>
  );
}

export function EditorialEngineWorkbench() {
  const [mode, setMode] = useState<Mode>("podcast");
  const [podcast, setPodcast] = useState(emptyPodcast);
  const [news, setNews] = useState(emptyNews);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sourceLength = useMemo(
    () => (mode === "podcast" ? podcast.transcript.length : news.sourceText.length + news.additionalSources.length),
    [mode, podcast.transcript, news.sourceText, news.additionalSources]
  );

  const analyze = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    const payload = mode === "podcast" ? { mode, ...podcast } : { mode, ...news };
    const response = await authApiRequest<{ ok: boolean; error?: string; result?: Result }>("/api/admin/editorial-engine/analyze", {
      method: "POST",
      jsonBody: payload
    });

    if (!response.ok || !response.json?.result) {
      setError(response.json?.error ?? `No se pudo analizar el contenido (HTTP ${response.response.status}).`);
      setLoading(false);
      return;
    }

    setResult(response.json.result);
    setLoading(false);
  };

  const canRun =
    mode === "podcast"
      ? podcast.title.trim().length > 2 && podcast.transcript.trim().length >= 120
      : news.title.trim().length > 2 && news.sourceText.trim().length >= 80;

  return (
    <div className="editorial-workbench">
      <section className="editorial-command card">
        <div className="editorial-command-top">
          <div>
            <div className="editorial-live-badge"><span /> MODO MANUAL · NO PUBLICA</div>
            <p className="page-kicker">SPM Editorial Engine</p>
            <h1>Convierte conversación en propiedad intelectual.</h1>
            <p className="editorial-lead">
              Analiza episodios y noticias, encuentra enseñanzas, impacto, ángulos, artículos, SEO y contenido social. Tú apruebas qué sale.
            </p>
          </div>
          <div className="editorial-score-shell" aria-label="Fuente cargada">
            <strong>{sourceLength.toLocaleString()}</strong>
            <span>caracteres cargados</span>
          </div>
        </div>

        <div className="editorial-tabs" role="tablist" aria-label="Tipo de análisis">
          <button type="button" className={mode === "podcast" ? "active" : ""} onClick={() => { setMode("podcast"); setResult(null); setError(null); }}>
            PODCAST → ARTÍCULOS
          </button>
          <button type="button" className={mode === "news" ? "active" : ""} onClick={() => { setMode("news"); setResult(null); setError(null); }}>
            NEWSROOM
          </button>
        </div>

        {mode === "podcast" ? (
          <div className="editorial-form-grid">
            <label><span>Episodio</span><input className="input" value={podcast.episode} onChange={(e) => setPodcast({ ...podcast, episode: e.target.value })} placeholder="EP142" /></label>
            <label className="editorial-span-2"><span>Título del episodio</span><input className="input" value={podcast.title} onChange={(e) => setPodcast({ ...podcast, title: e.target.value })} placeholder="Nadie nace bandido | Broken Spirit..." /></label>
            <label><span>Invitado</span><input className="input" value={podcast.guest} onChange={(e) => setPodcast({ ...podcast, guest: e.target.value })} placeholder="Bryan Agosto / Good Demon" /></label>
            <label className="editorial-span-2"><span>URL del episodio</span><input className="input" value={podcast.sourceUrl} onChange={(e) => setPodcast({ ...podcast, sourceUrl: e.target.value })} placeholder="https://youtube.com/..." /></label>
            <label className="editorial-span-3"><span>Metadata / contexto opcional</span><textarea className="textarea editorial-small-textarea" value={podcast.metadata} onChange={(e) => setPodcast({ ...podcast, metadata: e.target.value })} placeholder="Temas, invitado, descripción, reels existentes, contexto de producción..." /></label>
            <label className="editorial-span-3"><span>Transcript maestro</span><textarea className="textarea editorial-source-textarea" value={podcast.transcript} onChange={(e) => setPodcast({ ...podcast, transcript: e.target.value })} placeholder="Pega aquí el transcript completo con timestamps cuando estén disponibles..." /></label>
          </div>
        ) : (
          <div className="editorial-form-grid">
            <label className="editorial-span-2"><span>Titular / historia</span><input className="input" value={news.title} onChange={(e) => setNews({ ...news, title: e.target.value })} placeholder="Qué está pasando" /></label>
            <label><span>Región</span><select className="select" value={news.region} onChange={(e) => setNews({ ...news, region: e.target.value })}><option>PR</option><option>TX</option><option>USA</option><option>Mundo</option></select></label>
            <label><span>Fuente principal</span><input className="input" value={news.sourceName} onChange={(e) => setNews({ ...news, sourceName: e.target.value })} placeholder="AP, CPI, medio local..." /></label>
            <label className="editorial-span-2"><span>URL fuente</span><input className="input" value={news.sourceUrl} onChange={(e) => setNews({ ...news, sourceUrl: e.target.value })} placeholder="https://..." /></label>
            <label className="editorial-span-3"><span>Texto / datos de la fuente principal</span><textarea className="textarea editorial-source-textarea" value={news.sourceText} onChange={(e) => setNews({ ...news, sourceText: e.target.value })} placeholder="Pega el material verificado que el agente puede usar como hechos..." /></label>
            <label className="editorial-span-3"><span>Fuentes adicionales / contexto</span><textarea className="textarea editorial-small-textarea" value={news.additionalSources} onChange={(e) => setNews({ ...news, additionalSources: e.target.value })} placeholder="Segunda fuente, comunicado, datos oficiales, notas..." /></label>
          </div>
        )}

        <div className="editorial-runbar">
          <div>
            <strong>{mode === "podcast" ? "Qué va a sacar" : "Qué va a verificar"}</strong>
            <span>{mode === "podcast" ? "Enseñanzas · impacto · citas · artículos · SEO · social" : "Hechos · relevancia · contexto · ángulo SPM · draft · revisión"}</span>
          </div>
          <button className="button editorial-run" type="button" onClick={analyze} disabled={!canRun || loading}>
            {loading ? "ANALIZANDO..." : "CORRER AGENTE"}
          </button>
        </div>
        {error ? <div className="editorial-error">{error}</div> : null}
      </section>

      {result ? (
        <div className="editorial-results">
          <section className="editorial-result-hero card">
            <div>
              <p className="page-kicker">Resultado editorial</p>
              <h2>{result.draft.title || "Análisis completado"}</h2>
              <p>{result.summary}</p>
              <div className="editorial-result-meta">
                <RecommendationBadge value={result.review.publicationRecommendation} />
                <span>Modelo: {result.model}</span>
              </div>
            </div>
            <div className="editorial-score-card">
              <strong>{result.score}</strong><span>/100</span><small>valor editorial</small>
              <p>{result.scoreReason}</p>
            </div>
          </section>

          {result.facts.length ? (
            <section className="editorial-result-section editorial-facts card">
              <div className="editorial-section-heading"><span>BASE</span><h2>Lo que sí podemos sostener</h2></div>
              <ul>{result.facts.map((fact, i) => <li key={`${fact}-${i}`}>{fact}</li>)}</ul>
            </section>
          ) : null}

          <EvidenceGrid eyebrow="APRENDIZAJE" title="Qué nos enseñó esta conversación" items={result.teachings} />
          <EvidenceGrid eyebrow="IMPACTO" title="Lo que más nos dio en la cara" items={result.impacts} />

          <section className="editorial-three-up">
            <article className="card"><span className="editorial-mini-kicker">POR QUÉ IMPORTA</span><p>{result.whyItMatters || "—"}</p></article>
            <article className="card"><span className="editorial-mini-kicker">EN ARROZ Y HABICHUELAS</span><p>{result.plainLanguage || "—"}</p></article>
            <article className="card editorial-orange-card"><span className="editorial-mini-kicker">ÁNGULO SIN PELOS</span><p>{result.spmAngle || "—"}</p></article>
          </section>

          {result.quotes.length ? (
            <section className="editorial-result-section">
              <div className="editorial-section-heading"><span>CITAS</span><h2>Frases que sí están en la fuente</h2></div>
              <div className="editorial-quotes-grid">
                {result.quotes.map((item, i) => (
                  <blockquote className="card" key={`${item.quote}-${i}`}>
                    <p>“{item.quote}”</p>
                    <footer>{item.timestamp ? `${item.timestamp} · ` : ""}{item.context}</footer>
                    <span className={item.verified ? "verified" : "needs-review"}>{item.verified ? "VERIFICADA" : "REVISAR"}</span>
                  </blockquote>
                ))}
              </div>
            </section>
          ) : null}

          <section className="editorial-result-section">
            <div className="editorial-section-heading"><span>EXPANSIÓN</span><h2>Historias que viven más allá del episodio</h2></div>
            <div className="editorial-ideas-grid">
              {result.articleIdeas.map((idea, i) => (
                <article className="card editorial-idea" key={`${idea.title}-${i}`}>
                  <div className="editorial-idea-score">{idea.score}</div>
                  <h3>{idea.title}</h3><p>{idea.angle}</p><small>{idea.searchIntent}</small>
                </article>
              ))}
            </div>
          </section>

          <section className="editorial-draft card">
            <div className="editorial-draft-header">
              <div><span className="editorial-mini-kicker">BORRADOR PRINCIPAL</span><h2>{result.draft.title}</h2><p>{result.draft.dek}</p></div>
              <CopyButton value={result.draft.body} label="Copiar artículo" />
            </div>
            <div className="editorial-draft-body">{result.draft.body || "No se generó cuerpo de artículo."}</div>
          </section>

          <section className="editorial-seo-social">
            <article className="card">
              <div className="editorial-card-title"><h3>SEO</h3><CopyButton value={`${result.draft.seoTitle}\n${result.draft.metaDescription}\n${result.draft.slug}`} /></div>
              <dl><dt>Title</dt><dd>{result.draft.seoTitle}</dd><dt>Meta</dt><dd>{result.draft.metaDescription}</dd><dt>Slug</dt><dd>/{result.draft.slug}</dd><dt>Keywords</dt><dd>{result.draft.keywords.join(" · ")}</dd></dl>
            </article>
            <article className="card">
              <div className="editorial-card-title"><h3>Facebook</h3><CopyButton value={result.social.facebook} /></div><p className="editorial-prewrap">{result.social.facebook || "—"}</p>
            </article>
            <article className="card">
              <div className="editorial-card-title"><h3>YouTube Community</h3><CopyButton value={result.social.youtubeCommunity} /></div><p className="editorial-prewrap">{result.social.youtubeCommunity || "—"}</p>
            </article>
          </section>

          <section className="editorial-review card">
            <div><span className="editorial-mini-kicker">CONTROL HUMANO</span><h2>Antes de publicar</h2><p>El agente no tiene permiso de publicación. Estas banderas son para que el editor decida.</p></div>
            <div className="editorial-review-columns">
              <div><h3>Afirmaciones a revisar</h3>{result.review.claimsNeedingReview.length ? <ul>{result.review.claimsNeedingReview.map((x, i) => <li key={`${x}-${i}`}>{x}</li>)}</ul> : <p className="muted">Ninguna marcada.</p>}</div>
              <div><h3>Contexto que falta</h3>{result.review.missingContext.length ? <ul>{result.review.missingContext.map((x, i) => <li key={`${x}-${i}`}>{x}</li>)}</ul> : <p className="muted">No detectado.</p>}</div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
