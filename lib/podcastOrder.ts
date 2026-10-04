/** Number comes only from the canonical title. Never renumber from RSS or modified dates. */
export function episodeNumber(title: string): number {
  const m = title.match(/\bEP(?:ISODIO)?\.?\s*#?\s*(\d+)\b/i) ?? title.match(/^\s*#\s*(\d+)\b/);
  return m ? Number(m[1]) : 0;
}
export function comparePodcastEpisodes(a: {title:string;published_at?:string|null;publishedAt?:string|null}, b: {title:string;published_at?:string|null;publishedAt?:string|null}): number {
  const an=episodeNumber(a.title),bn=episodeNumber(b.title);
  if(an && bn && an!==bn)return bn-an;
  const ts=(x:string|null|undefined)=>{const n=Date.parse(x??'');return Number.isFinite(n)?n:0;};
  return ts(b.published_at??b.publishedAt)-ts(a.published_at??a.publishedAt);
}
