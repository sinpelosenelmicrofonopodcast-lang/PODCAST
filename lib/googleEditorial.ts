// Only the dedicated published-content sheet is readable here. The private
// editorial tracker, credentials and drafts are never exposed to this client.
type Row = Record<string, any>;
export const GOOGLE_EDITORIAL_SHEET = "1TCTUYlmL9vMGqAk5EhtK8_UtreJPHl51ZBZR6eH_G1A";
const feed = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRQ8nLn3F8I0onSPAi-AFt3iG7KVeQhKVqrctU2pZ6KXmYHcHYHmUHDWa0vENxt77Fi4jXTVKbr-7A5/pub?gid=1297918484&single=true&output=csv";
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { row.push(cell); cell = ""; }
    else if (c === '\n' && !quoted) { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (quoted) throw new Error("Incomplete Google editorial feed");
  if (cell || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
  return rows;
}
export function parseCatalog(text: string) {
  const rows = parseCsv(text);
  if (rows[0]?.[0] !== "Kind" || rows[0]?.[1] !== "ID" || !rows[0]?.[2]?.startsWith("JSON")) throw new Error("Invalid public editorial feed");
  const catalog: Record<string, Row[]> = { news_items: [], blog_posts: [] };
  const seen = new Set<string>();
  for (const [kind, id, ...chunks] of rows.slice(1)) {
    if (!kind && !id) continue;
    if (!['news', 'blog'].includes(kind)) throw new Error("Invalid public content kind");
    const item = JSON.parse(chunks.join(""));
    if (item.id !== id || item.publication_state !== "published" || seen.has(kind + id)) throw new Error("Invalid or duplicate published article");
    seen.add(kind + id); catalog[kind === 'news' ? 'news_items' : 'blog_posts'].push(item);
  }
  return catalog;
}
let cached: { until: number; data: Record<string, Row[]> } | undefined;
let loading: Promise<Record<string, Row[]>> | undefined;
export async function googleCatalog() {
  if (cached && cached.until > Date.now()) return cached.data;
  if (!loading) loading = (async () => {
    const response = await fetch(feed, { next: { revalidate: 60 }, signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error("Google editorial feed unavailable");
    const data = parseCatalog(await response.text());
    cached = { data, until: Date.now() + 60000 }; return data;
  })().finally(() => { loading = undefined; });
  return loading;
}
export class GoogleEditorialQuery {
  private filters: ((row: Row) => boolean)[] = [];
  private orders: { key: string; ascending: boolean }[] = [];
  private offset = 0; private end = Infinity; private singular = false;
  private columns = '*'; private head = false; private write = false;
  constructor(private table: string, private read = googleCatalog) {}
  select(columns = '*', options?: {head?: boolean; count?: string}) { this.columns = columns; this.head = !!options?.head; return this; }
  eq(k: string, v: any) { this.filters.push(r => r[k] === v); return this; }
  neq(k: string, v: any) { this.filters.push(r => r[k] !== v); return this; }
  is(k: string, v: any) { this.filters.push(r => v === null ? r[k] == null : r[k] === v); return this; }
  not(k: string, op: string, v: any) { if(op !== 'is') throw new Error('Unsupported editorial NOT filter'); this.filters.push(r => v === null ? r[k] != null : r[k] !== v); return this; }
  or(expression: string) { const options = expression.split(',').map(part => { const [key, op, ...value] = part.split('.'); if (op !== 'eq') throw new Error('Unsupported editorial OR filter'); return {key,value:value.join('.')}; }); this.filters.push(r => options.some(o => String(r[o.key]) === o.value)); return this; }
  in(k: string, v: any[]) { this.filters.push(r => v.includes(r[k])); return this; }
  contains(k: string, v: any[]) { this.filters.push(r => Array.isArray(r[k]) && v.every(x => r[k].includes(x))); return this; }
  ilike(k: string, v: string) { const re = new RegExp('^' + v.split('%').map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/_/g, '.')).join('.*') + '$', 'i'); this.filters.push(r => re.test(String(r[k] || ''))); return this; }
  lt(k: string, v: any) { this.filters.push(r => r[k] != null && r[k] < v); return this; }
  gt(k: string, v: any) { this.filters.push(r => r[k] != null && r[k] > v); return this; }
  lte(k: string, v: any) { this.filters.push(r => r[k] != null && r[k] <= v); return this; }
  gte(k: string, v: any) { this.filters.push(r => r[k] != null && r[k] >= v); return this; }
  order(key: string, options?: {ascending?: boolean}) { this.orders.push({key, ascending: options?.ascending !== false}); return this; }
  range(start: number, end: number) { this.offset = start; this.end = end; return this; }
  limit(n: number) { this.end = this.offset + n - 1; return this; }
  maybeSingle() { this.singular = true; return this; }
  single() { this.singular = true; return this; }
  insert(..._args: any[]) { this.write = true; return this; }
  update(..._args: any[]) { this.write = true; return this; }
  upsert(..._args: any[]) { this.write = true; return this; }
  delete() { this.write = true; return this; }
  async execute() {
    try {
      if (this.write) throw new Error("Editorial migrated to Google. Use Sin Pelos Social Manager to edit and publish.");
      let rows = (await this.read())[this.table].filter(r => this.filters.every(f => f(r)));
      const count = rows.length;
      rows = rows.slice().sort((a, b) => { for (const o of this.orders) { const d = a[o.key] == b[o.key] ? 0 : a[o.key] == null ? 1 : b[o.key] == null ? -1 : a[o.key] < b[o.key] ? -1 : 1; if (d) return o.ascending ? d : -d; } return 0; }).slice(this.offset, this.end + 1);
      if (this.columns !== '*') { const keys = this.columns.split(',').map(x => x.trim()); rows = rows.map(r => Object.fromEntries(keys.map(k => [k, r[k] ?? null]))); }
      return { data: this.head ? null : this.singular ? rows[0] ?? null : rows, count, error: null };
    } catch (e) { return { data: null, count: null, error: {message: (e as Error).message, code: 'GOOGLE_EDITORIAL'} }; }
  }
  then(onfulfilled?: any, onrejected?: any) { return this.execute().then(onfulfilled, onrejected); }
}
export function withGoogleEditorial<T extends {from: (...args: any[]) => any}>(client: T): T {
  return new Proxy(client, { get(target, key) {
    if (key === 'from') return (table: string) => ['news_items', 'blog_posts'].includes(table) ? new GoogleEditorialQuery(table) : target.from(table);
    const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
  }});
}
