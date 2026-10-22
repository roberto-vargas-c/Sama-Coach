/* Sama in Spanish and German.
   The app is written in English. This file swaps the English text on screen for the chosen language as it appears:
   every text node and the placeholder, aria-label, title and alt attributes, including text the app adds later
   (a MutationObserver). Lookups go: exact text → the same text with its numbers taken out → sentence templates
   ({0}, {1} filled from the English, each piece translated too). The English original is kept, so switching back
   is instant. The voice guide stays in English for now. */
(function(){
  const LANGS = {en:'English', es:'Español', de:'Deutsch'};
  const pick = () => {
    try { const v = localStorage.getItem('sama.lang'); if (LANGS[v]) return v; } catch (e) {}
    const n = ((navigator.languages && navigator.languages[0]) || navigator.language || 'en').slice(0, 2).toLowerCase();
    return LANGS[n] ? n : 'en';
  };
  let lang = /[?&]embed=1/.test(location.search) ? 'en' : pick();
  document.documentElement.lang = lang;
  let dict = null, numd = null, tmpls = [], sides = [];
  const esc = p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
  const ORIG = new WeakMap(), SET = new WeakMap(); // text node → English original / the text we last wrote into it
  const norm = s => s.replace(/\s+/g, ' ').trim();
  const NUM = /\d+(?:[.,]\d+)?/g;
  function build(d){
    dict = new Map(Object.entries(d)); numd = new Map(); tmpls = []; sides = [];
    for (const [k, v] of dict){
      if (k.includes('{side}')){ // a left/right word that may be missing ("Straighten the {side} leg." → "Straighten the leg.")
        const parts = k.split(' {side} ');
        if (parts.length === 2) sides.push({re: new RegExp('^' + parts.map(esc).join(' (?:(left|right) )?') + '$'), v});
        continue;
      }
      if (/\{\d+\}/.test(k)){
        const parts = k.split(/(\{\d+\})/), idx = [];
        const re = parts.map(p => { const m = /^\{(\d+)\}$/.exec(p); if (m){ idx.push(+m[1]); return '([\\s\\S]+?)'; } return p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('');
        const lit = parts.filter((p, i) => i % 2 === 0).join('').length;
        if (lit >= 3) tmpls.push({re: new RegExp('^' + re + '$'), idx, v, lit});
      } else if (/\d/.test(k)) numd.set(k.replace(NUM, '#'), v);
    }
    tmpls.sort((a, b) => b.lit - a.lit);
  }
  function tr(s, depth){
    if (!dict || lang === 'en' || !s) return s;
    if (/\n\s*\S/.test(s.trim())) return s.split('\n').map(x => tr(x, depth)).join('\n'); // line by line (e.g. a multi-line placeholder)
    const k = norm(s); if (!k || !/[A-Za-z]/.test(k)) return s;
    let v = dict.get(k);
    if (v == null && /\d/.test(k)){ const nums = k.match(NUM), t = numd.get(k.replace(NUM, '#'));
      if (t){ const tn = t.match(NUM) || []; if (tn.length === nums.length){ let i = 0; v = t.replace(NUM, () => nums[i++]); } } }
    if (v == null && sides.length && /\b(?:the|your)\b/.test(k)){
      for (const t of sides){ const m = t.re.exec(k); if (m){ v = fillSide(t.v, m[1] || ''); break; } }
    }
    if (v == null && (depth || 0) < 2){
      for (const t of tmpls){ const m = t.re.exec(k); if (!m) continue;
        v = t.v.replace(/\{(\d+)\}/g, (_, n) => { const j = t.idx.indexOf(+n); const g = j >= 0 ? m[j + 1] : ''; return tr(g, (depth || 0) + 1); }); break; }
    }
    if (v == null) return s;
    const lead = /^\s*/.exec(s)[0], trail = /\s*$/.exec(s)[0];
    return lead + v + trail;
  }
  // left/right agree with the word around them: Spanish follows the noun before it (pierna izquierda, brazo izquierdo),
  // German the article before it (das linke Bein, den linken Arm)
  function fillSide(v, w){
    if (!w) return v.replace(/ ?\{side\}/, '');
    return v.replace(/(\S*)( ?)\{side\}/, (all, prev, sp) => {
      let word;
      if (lang === 'es'){ const fem = /as?$/i.test(prev); const pl = /s$/i.test(prev); word = (w === 'left' ? (fem ? 'izquierda' : 'izquierdo') : (fem ? 'derecha' : 'derecho')) + (pl ? 's' : ''); }
      else { const n = /^(den|dem|des|der|deinen|deinem|deiner|deines)$/.test(prev); word = (w === 'left' ? 'linke' : 'rechte') + (n ? 'n' : ''); }
      return prev + sp + word;
    });
  }
  const skip = el => { for (let e = el; e && e !== document.body; e = e.parentElement){ const t = e.tagName;
      if (t === 'SCRIPT' || t === 'STYLE' || t === 'CODE' || e.isContentEditable || e.getAttribute('translate') === 'no') return true; } return false; };
  function doText(n){
    const cur = n.nodeValue; if (!cur || !/[A-Za-z]/.test(cur) || (n.parentElement && n.parentElement.tagName === 'TEXTAREA')) return;
    if (SET.get(n) === cur) return; // our own write
    ORIG.set(n, cur); // a new English text from the app
    const out = lang === 'en' ? cur : tr(cur);
    if (out !== cur){ SET.set(n, out); n.nodeValue = out; } else SET.delete(n);
  }
  function doAttrs(el){
    for (const a of ATTRS){ if (!el.hasAttribute(a)) continue; const cur = el.getAttribute(a), key = 'data-en-' + a;
      let en = el.getAttribute(key); if (en == null || (cur !== en && cur !== el.__trA?.[a])) { en = cur; el.setAttribute(key, en); }
      const out = lang === 'en' ? en : tr(en); (el.__trA || (el.__trA = {}))[a] = out; if (out !== cur) el.setAttribute(a, out); }
  }
  function walk(root){
    if (!root) return;
    if (root.nodeType === 3){ if (!skip(root.parentElement)) doText(root); return; }
    if (root.nodeType !== 1 || skip(root)) return;
    doAttrs(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {acceptNode: n => n.nodeType === 1 && skip(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT});
    for (let n = w.nextNode(); n; n = w.nextNode()){ if (n.nodeType === 3) doText(n); else doAttrs(n); }
  }
  function restore(root){ // back to English
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let n = w.currentNode; n; n = w.nextNode()){
      if (n.nodeType === 3){ const o = ORIG.get(n); if (o != null && n.nodeValue !== o){ n.nodeValue = o; } SET.delete(n); }
      else for (const a of ATTRS){ const en = n.getAttribute && n.getAttribute('data-en-' + a); if (en != null) n.setAttribute(a, en); }
    }
  }
  let obs = null;
  function observe(){
    if (obs) return;
    obs = new MutationObserver(list => { for (const m of list){
      if (m.type === 'characterData'){ if (!skip(m.target.parentElement)) doText(m.target); }
      else if (m.type === 'attributes'){ if (!skip(m.target)) doAttrs(m.target); }
      else for (const n of m.addedNodes) walk(n); } });
    obs.observe(document.body, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:ATTRS});
  }
  const ready = (lang === 'en' ? Promise.resolve() : load(lang)).then(() => { if (document.body){ walk(document.body); observe(); } else document.addEventListener('DOMContentLoaded', () => { walk(document.body); observe(); }); });
  function load(l){
    return fetch('/i18n/' + l + '.json').then(r => r.ok ? r.json() : {}).then(build).catch(() => build({}));
  }
  async function setLang(l){
    if (!LANGS[l] || l === lang) return;
    try { localStorage.setItem('sama.lang', l); } catch (e) {}
    lang = l; document.documentElement.lang = l;
    if (l === 'en'){ restore(document.body); }
    else { await load(l); restore(document.body); walk(document.body); }
    observe();
    document.dispatchEvent(new CustomEvent('sama:lang', {detail:l}));
  }
  window.SamaI18n = {tr: s => tr(s), get lang(){ return lang; }, setLang, ready, LANGS,
    names: () => dict ? dict : new Map()};
})();
