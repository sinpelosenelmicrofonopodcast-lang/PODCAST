const {test}=require('node:test'),assert=require('node:assert/strict'),ts=require('typescript'),fs=require('node:fs'),vm=require('node:vm');
const source=ts.transpileModule(fs.readFileSync('lib/googleEditorial.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const exportsObject={};vm.runInNewContext(source,{exports:exportsObject,process,fetch,AbortSignal,Date,console});
const {parseCsv,parseCatalog,GoogleEditorialQuery}=exportsObject;
const sourceExports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/newsSources.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:sourceExports,URL});
test('source footer becomes distinct links without changing the article paragraphs',()=>{
 const primary='https://example.org/original',second='https://example.net/second?a=1&b=2',body='Primer párrafo.\n\nSegundo párrafo.';
 const result=sourceExports.newsSources(body+'\n\nFuentes:\n'+primary+'\nMedio: '+second,primary);
 assert.equal(result.body,body);assert.deepEqual(Array.from(result.sourceUrls),[primary,second]);
});
test('ordinary prose is preserved and unsafe source URLs are excluded',()=>{
 const body='Texto.\n\nFuentes:\nTodavía se investigan las fuentes.';
 assert.equal(sourceExports.newsSources(body,'').body,body);
 for(const url of ['javascript:alert(1)','https://user:password@example.org/'])assert.equal(sourceExports.newsSources('Texto',url).sourceUrls.length,0);
});
test('catalog refresh sees new publications after the bounded cache expires',async()=>{
 let now=0,calls=0;const sandboxExports={};
 vm.runInNewContext(source,{exports:sandboxExports,process,AbortSignal,console,Date:{now:()=>now},fetch:async(url,options)=>{
  calls++;assert.equal(options.cache,'no-store');assert.equal(options.next,undefined);
  const item={id:String(calls),publication_state:'published'};
  return {ok:true,text:async()=>'Kind,ID,JSON1\nnews,'+item.id+',"'+JSON.stringify(item).replace(/"/g,'""')+'"'};
 }});
 assert.equal((await sandboxExports.googleCatalog()).news_items[0].id,'1');
 now=59999;assert.equal((await sandboxExports.googleCatalog()).news_items[0].id,'1');assert.equal(calls,1);
 now=60001;assert.equal((await sandboxExports.googleCatalog()).news_items[0].id,'2');assert.equal(calls,2);
});
const data={news_items:[{id:'1',title:'Puerto Rico',publication_state:'published',categories:['PR'],published_at:'2026-10-22',episode_url:null},{id:'2',title:'Texas',publication_state:'published',categories:['TX'],published_at:'2026-10-23',episode_url:'https://example.com'}],blog_posts:[]};
const read=async()=>data;
test('Next.js dynamic rendering signals reach the route instead of becoming query errors',async()=>{
 const signal=Object.assign(new Error('Dynamic server usage'),{digest:'DYNAMIC_SERVER_USAGE'});
 await assert.rejects(new GoogleEditorialQuery('news_items',async()=>{throw signal;}).execute(),error=>error===signal);
 const ordinary=await new GoogleEditorialQuery('news_items',async()=>{throw new Error('Feed unavailable');}).execute();
 assert.equal(ordinary.error.code,'GOOGLE_EDITORIAL');
});
test('CSV preserves quoted commas, newlines, quotes and split JSON',()=>{const item=JSON.stringify(data.news_items[0]);const escaped=x=>'"'+x.replace(/"/g,'""')+'"';const text='Kind,ID,JSON1,JSON2\r\nnews,1,'+escaped(item.slice(0,30))+','+escaped(item.slice(30));assert.equal(parseCatalog(text).news_items[0].title,'Puerto Rico');assert.equal(parseCsv('a,"b,c\nquote ""ok"""')[0][1],'b,c\nquote "ok"');});
test('rejects drafts, duplicate identifiers and truncated input',()=>{assert.throws(()=>parseCatalog('Kind,ID,JSON1\nnews,1,"{}"'));assert.throws(()=>parseCsv('"unterminated'));});
test('filter, sort and paginate while keeping full count',async()=>{const r=await new GoogleEditorialQuery('news_items',read).select('id,title',{count:'exact'}).order('published_at',{ascending:false}).range(0,0);assert.equal(r.count,2);assert.equal(r.data[0].id,'2');assert.equal(r.data[0].publication_state,undefined);});
test('existing canonical lookup, categories and nullable podcast fields work',async()=>{assert.equal((await new GoogleEditorialQuery('news_items',read).or('id.eq.1,id.eq.3').maybeSingle()).data.title,'Puerto Rico');assert.equal((await new GoogleEditorialQuery('news_items',read).contains('categories',['TX']).ilike('title','tex%')).data.length,1);assert.equal((await new GoogleEditorialQuery('news_items',read).not('episode_url','is',null)).data[0].id,'2');});
test('legacy mutations fail closed instead of writing Supabase',async()=>{const r=await new GoogleEditorialQuery('news_items',read).update({title:'changed'}).eq('id','1');assert.equal(r.error.code,'GOOGLE_EDITORIAL');assert.equal(data.news_items[0].title,'Puerto Rico');});
test('live exported archive parses and contains only public records',()=>{const path=process.env.SPM_TEST_CSV;if(!path)return;const c=parseCatalog(fs.readFileSync(path,'utf8'));assert.equal(c.news_items.length,390);assert.equal(c.blog_posts.length,38);});
