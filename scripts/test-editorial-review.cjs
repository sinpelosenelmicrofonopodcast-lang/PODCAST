const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { webcrypto } = require('node:crypto');

const source = fs.readFileSync('supabase/functions/editorial-drive/index.ts', 'utf8')
  .replace(/^import.*\n/, '').replace(/const db = .*\n/, '');
let handler, uploadedPath, publicUpdates = 0;
const config = { id: true, enabled: true };
const draft = {
  id: '00000000-0000-4000-8000-000000000001', revision: 4,
  status: 'Publicado', content_hash: 'published', published_hash: 'published',
  facebook_selected: false, facebook_caption: '', facebook_approved_hash: 'previous',
  payload: { title: 'Killeen tiene talento: jóvenes destacados', imageUrl: '', summary: 'Resumen',
    body: 'Contenido revisado', sourceUrl: 'https://example.com/noticia', sourceName: 'Fuente',
    category: 'Comunidad', region: 'Texas', scheduledAt: '' }
};
const db = {
  from(table) {
    const row = table === 'editorial_bridge_config' ? config : draft;
    let patch;
    const query = {
      select() { return query; }, eq() { return query; },
      update(value) { patch = value; if (['news_articles', 'news_items'].includes(table)) publicUpdates++; return query; },
      async single() { if (patch) Object.assign(row, patch); return { data: { ...row }, error: null }; }
    };
    return query;
  },
  storage: {
    async getBucket() { return { data: {}, error: null }; },
    from() { return {
      async upload(path) { uploadedPath = path; return { error: null }; },
      getPublicUrl(path) { return { data: { publicUrl: 'https://images.example/' + path } }; }
    }; }
  }
};
const ctx = { db, crypto: webcrypto, TextEncoder, TextDecoder, URL, URLSearchParams, AbortSignal,
  Response, Request, btoa, atob, console, Deno: { env: { get: () => 'test-service-key' }, serve: fn => { handler = fn; } } };
vm.createContext(ctx);
vm.runInContext(ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }), ctx);
vm.runInContext('googleToken=async()=>"test";writeDraft=async()=>{};audit=async()=>{}', ctx);
const call = input => handler(new Request('https://example.com/editorial', { method: 'POST',
  headers: { Authorization: 'Bearer test-service-key', 'Content-Type': 'application/json' }, body: JSON.stringify(input) }));
(async () => {
  const approval = await call({ action: 'decision', id: draft.id, revision: 4, state: 'Aprobado' });
  assert.equal(approval.status, 400);
  assert.match((await approval.json()).error, /portada/);
  const bytes = new Uint8Array(100); bytes.set([137, 80, 78, 71]);
  const response = await call({ action: 'upload_cover', id: draft.id, revision: 4,
    contentType: 'image/png', base64: Buffer.from(bytes).toString('base64') });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'En revisión');
  assert.equal(draft.revision, 5);
  assert.equal(draft.published_hash, 'published');
  assert.equal(draft.facebook_approved_hash, null);
  assert.equal(publicUpdates, 0, 'a new cover must wait for approval before changing the public article');
  assert.match(uploadedPath, /killeen-tiene-talento-jovenes-destacados-sin-pelos/);
  console.log('PASS: server rejects approval without cover; cover replacement waits for review and retains public version; SEO filename');
})().catch(error => { console.error(error); process.exit(1); });
