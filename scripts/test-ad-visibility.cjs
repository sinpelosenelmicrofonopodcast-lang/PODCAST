const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const tick = () => new Promise(resolve => setImmediate(resolve));
function harness(name) {
  let cursor = 0, state = [], pending = [], effects = new Map(), observers = [], events = [];
  let resolveBody;
  const react = {
    useState(initial) { const i = cursor++; if (!(i in state)) state[i] = initial;
      return [state[i], value => { state[i] = value; }]; },
    useRef(initial) { const i = cursor++; if (!(i in state)) state[i] = { current: initial }; return state[i]; },
    useEffect(fn, deps) { const i = cursor++; const prior = effects.get(i);
      if (!prior || deps.some((d, j) => d !== prior.deps[j])) pending.push(() => {
        prior?.cleanup?.(); effects.set(i, { deps, cleanup: fn() });
      }); }
  };
  const jsx = (tag, props) => { if (props?.ref) props.ref.current = {}; return { tag, props }; };
  class Observer {
    constructor(callback, options) { this.callback = callback; this.options = options; this.disconnected = false; observers.push(this); }
    observe() {} disconnect() { this.disconnected = true; }
    intersect(ratio) { this.callback([{ isIntersecting: ratio > 0, intersectionRatio: ratio }]); }
  }
  const context = { exports: {}, console, IntersectionObserver: Observer,
    window: { setTimeout, clearTimeout }, sessionStorage: { getItem() { return '1'; }, setItem() {} },
    fetch: async () => ({ ok: true, json: () => new Promise(resolve => { resolveBody = resolve; }) }),
    require(path) {
      if (path === 'react') return react;
      if (path === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (path === 'next/navigation') return { usePathname: () => '/noticias/test' };
      if (path.includes('promoTracking')) return { getSessionId: () => 'test', trackPromoEvent: event => events.push(event) };
      return { promoSectionFromPath: () => 'news' };
    }
  };
  vm.createContext(context);
  vm.runInContext(ts.transpile(fs.readFileSync(`components/promotions/${name}.tsx`, 'utf8'),
    { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }), context);
  return {
    render() { cursor = 0; context.exports[name]({}); pending.splice(0).forEach(fn => fn()); },
    observers, events, state,
    resolve() { resolveBody({ items: [{ id: 'promo-1', title: 'Sponsor', cta_url: null }] }); },
    cleanup() { for (const effect of effects.values()) effect.cleanup?.(); }
  };
}
(async () => {
  for (const name of ['DesktopSideAdSlot', 'MidContentAdSlot']) {
    const h = harness(name); h.render();
    if (name === 'MidContentAdSlot') { h.observers[0].intersect(0.1); h.render(); }
    await tick(); h.resolve(); await tick(); h.render();
    assert.equal(h.events.length, 0, 'loading does not count as a view');
    const visibility = h.observers.at(-1);
    visibility.intersect(0.49); assert.equal(h.events.length, 0);
    visibility.intersect(0.5); visibility.intersect(1);
    assert.equal(h.events.length, 1, 'one impression after the ad is visible');
    assert.equal(h.events[0].promotionId, 'promo-1');
    assert.equal(visibility.disconnected, true);
    h.cleanup();
    const late = harness(name); late.render();
    if (name === 'MidContentAdSlot') { late.observers[0].intersect(0.1); late.render(); }
    await tick(); late.cleanup(); late.resolve(); await tick();
    assert.equal(late.state.some(value => value?.id === 'promo-1'), false, 'unmounted slot ignores a delayed response body');
  }
  console.log('PASS: unseen ads do not count; 50% visibility counts once; unmounted slots ignore delayed JSON');
})().catch(error => { console.error(error); process.exit(1); });
