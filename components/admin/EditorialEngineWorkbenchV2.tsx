"use client";

import { useEffect, useMemo, useState } from "react";
import { authApiRequest } from "@/lib/clientApi";

type Mode = "podcast" | "news";
type EpisodeSource = {
  id: string;
  episode_code: string;
  title: string;
  guest?: string | null;
  source_url?: string | null;
  source_provider?: string | null;
  drive_file_id?: string | null;
  metadata?: Record<string, unknown> | null;
  transcript_char_count: number;
  updated_at: string;
};
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
  draft: { title: string; dek: string; excerpt: string; body: string; seoTitle: string; metaDescription: string; slug: string; keywords: string[]; tags: string[]; category: string };
  social: { facebook: string; youtubeCommunity: string; reelHooks: string[] };
  review: { claimsNeedingReview: string[]; missingContext: string[]; publicationRecommendation: "draft" | "review" | "ready" };
  model: string;
};
type RunItem = { id: string; mode: Mode; score: number; title: string; status: string; createdAt: string; publicationRecommendation: string };

function EvidenceCards({ items, empty }: { items: Evidence[]; empty: string }) {
  if (!items.length) return <p className="muted">{empty}</p>;
  return <div className="editorial-evidence-grid">{items.map((x, i) => <article className="editorial-evidence-card" key={`${x.label}-${i}`}><div className="editorial-number">{String(i + 1).padStart(2, "0")}</div><div><h3>{x.label}</h3><p>{x.detail}</p><div className="editorial-evidence-source"><strong>EVIDENCIA</strong><span>{x.evidence}</span>{x.timestamp ? <small>{x.timestamp}</small> : null}</div></div></article>)}</div>;
}

function CopyButton({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return <button className="editorial-copy" type="button" onClick={async () => { await navigator.clipboard.writeText(value || ""); setDone(true); setTimeout(() => setDone(false), 1200); }} disabled={!value}>{done ? "Copiado" : "Copiar"}</button>;
}

export function EditorialEngineWorkbenchV2() {
  const [mode, setMode] = useState<Mode>("podcast");
  const [episodes, setEpisodes] = useState<EpisodeSource[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [episodesLoading, setEpisodesLoading] = useState(true);
  const [runs, setRuns] = useState<RunItem[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState({ episode: "", title: "", guest: "", sourceUrl: "", metadata: "", transcript: "" });
  const [news, setNews] = useState({ title: "", sourceName: "", sourceUrl: "", region: "PR", sourceText: "", additionalSources: "" });

  const selected = useMemo(() => episodes.find((x) => x.id === selectedId) ?? null, [episodes, selectedId]);

  const loadSources = async () => {
    setEpisodesLoading(true);
    const res = await authApiRequest<{ ok: boolean; items?: EpisodeSource[] }>("/api/admin/editorial-engine/episodes");
    const items = res.json?.items ?? [];
    setEpisodes(items);
    if (!selectedId && items[0]) setSelectedId(items[0].id);
    setEpisodesLoading(false);
  };
  const loadRuns = async () => {
    const res = await authApiRequest<{ ok: boolean; items?: RunItem[] }>("/api/admin/editorial-engine/runs");
    setRuns(res.json?.items ?? []);
  };
  useEffect(() => { void loadSources(); void loadRuns(); }, []);

  const canRun = mode === "podcast" ? Boolean(selectedId || (manual.title.trim().length > 2 && manual.transcript.trim().length >= 120)) : news.title.trim().length > 2 && news.sourceText.trim().length >= 80;

  const analyze = async () => {
    setLoading(true); setError(null); setResult(null); setRunId(null);
    const payload = mode === "podcast"
      ? selectedId ? { mode, episodeSourceId: selectedId } : { mode, ...manual }
      : { mode, ...news };
    const res = await authApiRequest<{ ok: boolean; error?: string; result?: Result; run?: { id: string } }>("/api/admin/editorial-engine/analyze", { method: "POST", jsonBody: payload });
    if (!res.ok || !res.json?.result) {
      setError(res.json?.error ?? `No se pudo correr el agente (HTTP ${res.response.status}).`);
      setLoading(false); return;
    }
    setResult(res.json.result); setRunId(res.json.run?.id ?? null); setLoading(false); void loadRuns();
  };

  return <div className="editorial-workbench editorial-v2">
    <section className="editorial-command card">
      <div className="editorial-command-top"><div><div className="editorial-live-badge"><span /> MODO MANUAL · CERO AUTOPUBLISH</div><p className="page-kicker">SPM EDITORIAL ENGINE 2.0</p><h1>Un episodio. Un arsenal de ideas.</h1><p className="editorial-lead">Selecciona una fuente guardada y el agente trabaja server-side: enseñanzas, impacto, citas, artículos, SEO, social e historial. Nada sale sin aprobación humana.</p></div><div className="editorial-score-shell"><strong>{episodes.length}</strong><span>episodios conectados</span></div></div>
      <div className="editorial-tabs"><button className={mode === "podcast" ? "active" : ""} onClick={() => { setMode("podcast"); setResult(null); }}>PODCAST LAB</button><button className={mode === "news" ? "active" : ""} onClick={() => { setMode("news"); setResult(null); }}>NEWSROOM</button></div>

      {mode === "podcast" ? <>
        <div className="editorial-source-picker">
          <label><span>FUENTE GUARDADA</span><select className="select" value={selectedId} onChange={(e) => setSelectedId(e.target.value)} disabled={episodesLoading}><option value="">Manual / pegar transcript</option>{episodes.map((ep) => <option key={ep.id} value={ep.id}>{ep.episode_code} · {ep.title}</option>)}</select></label>
          {selected ? <div className="editorial-source-health"><div><strong>{selected.episode_code}</strong><span>{selected.guest || "Sin invitado"}</span></div><div><strong>{Number(selected.transcript_char_count || 0).toLocaleString()}</strong><span>caracteres</span></div><div><strong>{String(selected.source_provider || "manual").toUpperCase()}</strong><span>fuente</span></div><div className={Number(selected.transcript_char_count || 0) >= 120 ? "source-ready" : "source-warning"}><strong>{Number(selected.transcript_char_count || 0) >= 120 ? "READY" : "FALTA FUENTE"}</strong><span>estado</span></div></div> : null}
        </div>
        {!selectedId ? <div className="editorial-form-grid"><label><span>Episodio</span><input className="input" value={manual.episode} onChange={(e) => setManual({ ...manual, episode: e.target.value })} placeholder="EP143" /></label><label className="editorial-span-2"><span>Título</span><input className="input" value={manual.title} onChange={(e) => setManual({ ...manual, title: e.target.value })} /></label><label><span>Invitado</span><input className="input" value={manual.guest} onChange={(e) => setManual({ ...manual, guest: e.target.value })} /></label><label className="editorial-span-2"><span>URL</span><input className="input" value={manual.sourceUrl} onChange={(e) => setManual({ ...manual, sourceUrl: e.target.value })} /></label><label className="editorial-span-3"><span>Transcript maestro</span><textarea className="textarea editorial-source-textarea" value={manual.transcript} onChange={(e) => setManual({ ...manual, transcript: e.target.value })} /></label></div> : null}
      </> : <div className="editorial-form-grid"><label className="editorial-span-2"><span>Historia</span><input className="input" value={news.title} onChange={(e) => setNews({ ...news, title: e.target.value })} /></label><label><span>Región</span><select className="select" value={news.region} onChange={(e) => setNews({ ...news, region: e.target.value })}><option>PR</option><option>TX</option><option>USA</option><option>Mundo</option></select></label><label><span>Fuente</span><input className="input" value={news.sourceName} onChange={(e) => setNews({ ...news, sourceName: e.target.value })} /></label><label className="editorial-span-2"><span>URL</span><input className="input" value={news.sourceUrl} onChange={(e) => setNews({ ...news, sourceUrl: e.target.value })} /></label><label className="editorial-span-3"><span>Material verificado</span><textarea className="textarea editorial-source-textarea" value={news.sourceText} onChange={(e) => setNews({ ...news, sourceText: e.target.value })} /></label><label className="editorial-span-3"><span>Fuentes adicionales</span><textarea className="textarea editorial-small-textarea" value={news.additionalSources} onChange={(e) => setNews({ ...news, additionalSources: e.target.value })} /></label></div>}

      <div className="editorial-runbar"><div><strong>Salida</strong><span>{mode === "podcast" ? "Enseñanzas · impacto · evidencia · citas · artículos · SEO · reels" : "Hechos · score · contexto · ángulo · draft · revisión"}</span></div><button className="button editorial-run" onClick={analyze} disabled={!canRun || loading}>{loading ? "ANALIZANDO..." : "CORRER AGENTE"}</button></div>
      {error ? <div className="editorial-error">{error}</div> : null}
    </section>

    {result ? <div className="editorial-results">
      <section className="editorial-result-hero card"><div><p className="page-kicker">ANÁLISIS GUARDADO {runId ? `· ${runId.slice(0, 8)}` : ""}</p><h2>{result.draft.title || "Análisis completado"}</h2><p>{result.summary}</p><div className="editorial-result-meta"><span className={`editorial-status editorial-status-${result.review.publicationRecommendation}`}>{result.review.publicationRecommendation.toUpperCase()}</span><span>{result.model}</span></div></div><div className="editorial-score-card"><strong>{result.score}</strong><span>/100</span><small>valor editorial</small><p>{result.scoreReason}</p></div></section>
      <section className="editorial-result-section"><div className="editorial-section-heading"><span>APRENDIZAJE</span><h2>Qué nos enseñó este episodio</h2></div><EvidenceCards items={result.teachings} empty="No se detectaron enseñanzas suficientes." /></section>
      <section className="editorial-result-section"><div className="editorial-section-heading"><span>IMPACTO</span><h2>Lo que más nos dio en la cara</h2></div><EvidenceCards items={result.impacts} empty="No se detectaron impactos suficientes." /></section>
      <section className="editorial-three-up"><article className="card"><span className="editorial-mini-kicker">POR QUÉ IMPORTA</span><p>{result.whyItMatters}</p></article><article className="card"><span className="editorial-mini-kicker">EN ARROZ Y HABICHUELAS</span><p>{result.plainLanguage}</p></article><article className="card editorial-orange-card"><span className="editorial-mini-kicker">ÁNGULO SIN PELOS</span><p>{result.spmAngle}</p></article></section>
      {result.quotes.length ? <section className="editorial-result-section"><div className="editorial-section-heading"><span>CITAS</span><h2>Frases rastreables</h2></div><div className="editorial-quotes-grid">{result.quotes.map((q, i) => <blockquote className="card" key={i}><p>“{q.quote}”</p><footer>{q.timestamp ? `${q.timestamp} · ` : ""}{q.context}</footer><span className={q.verified ? "verified" : "needs-review"}>{q.verified ? "VERIFICADA" : "REVISAR"}</span></blockquote>)}</div></section> : null}
      <section className="editorial-result-section"><div className="editorial-section-heading"><span>EXPANSIÓN</span><h2>Artículos que salen de aquí</h2></div><div className="editorial-ideas-grid">{result.articleIdeas.map((a, i) => <article className="card editorial-idea" key={i}><div className="editorial-idea-score">{a.score}</div><h3>{a.title}</h3><p>{a.angle}</p><small>{a.searchIntent}</small></article>)}</div></section>
      <section className="editorial-draft card"><div className="editorial-draft-header"><div><span className="editorial-mini-kicker">BORRADOR PERSISTENTE</span><h2>{result.draft.title}</h2><p>{result.draft.dek}</p></div><CopyButton value={result.draft.body} /></div><div className="editorial-draft-body">{result.draft.body}</div></section>
      <section className="editorial-seo-social"><article className="card"><div className="editorial-card-title"><h3>SEO</h3><CopyButton value={`${result.draft.seoTitle}\n${result.draft.metaDescription}\n/${result.draft.slug}`} /></div><dl><dt>Title</dt><dd>{result.draft.seoTitle}</dd><dt>Meta</dt><dd>{result.draft.metaDescription}</dd><dt>Slug</dt><dd>/{result.draft.slug}</dd></dl></article><article className="card"><div className="editorial-card-title"><h3>Facebook</h3><CopyButton value={result.social.facebook} /></div><p className="editorial-prewrap">{result.social.facebook}</p></article><article className="card"><h3>Hooks</h3><ol>{result.social.reelHooks.map((h, i) => <li key={i}>{h}</li>)}</ol></article></section>
      <section className="editorial-review card"><h2>Antes de publicar</h2><div className="editorial-review-columns"><div><h3>Claims</h3><ul>{result.review.claimsNeedingReview.length ? result.review.claimsNeedingReview.map((x, i) => <li key={i}>{x}</li>) : <li>Sin claims marcados.</li>}</ul></div><div><h3>Contexto faltante</h3><ul>{result.review.missingContext.length ? result.review.missingContext.map((x, i) => <li key={i}>{x}</li>) : <li>Sin contexto pendiente.</li>}</ul></div></div></section>
    </div> : null}

    <section className="card editorial-history"><div className="editorial-section-heading"><span>MEMORIA EDITORIAL</span><h2>Últimas corridas guardadas</h2></div>{runs.length ? <div className="editorial-history-list">{runs.map((r) => <div key={r.id}><div><strong>{r.title}</strong><span>{new Date(r.createdAt).toLocaleString("es-PR")} · {r.mode}</span></div><div><b>{r.score}</b><span>{r.status}</span></div></div>)}</div> : <p className="muted">Todavía no hay análisis guardados.</p>}</section>
  </div>;
}
