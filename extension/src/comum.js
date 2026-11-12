// Brasa — peças comuns à página do TikTok (content script) e ao popup: ícones, estilos no visual do TikTok web,
// quadros (tutorial, novidades, versão nova, apoiar) e o rodapé padrão (regras 9, 12, 13, 14 e 16 do hub).
// Tokens medidos ao vivo em 2026-11-11: Jarvis/02-projetos/extensoes/role/pesquisa/2026-11-11-design-tiktok.md
(() => {
  const REPO = 'DredsGG/brasa';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cmpVer = (a, b) => {
    const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0), pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length, 3); i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d > 0 ? 1 : -1; }
    return 0;
  };
  const baseVer = (v) => String(v || '').split('.').slice(0, 3).join('.');

  // Ícones de contorno, 24 px, traço 2 (como os da barra lateral do TikTok). Nada de emoji na interface (fora as bandeiras do Apoiar).
  const sv = (d, extra) => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra || ''}>${d}</svg>`;
  const FLAME = '<path d="M12 21.5c3.9 0 6.8-2.6 6.8-6.5 0-3-1.7-5.2-3.5-7-.3 1.8-1.1 2.9-2.3 3.4.4-3.1-.9-6-3.5-8.2-.2 3.2-1.8 5-3.3 6.8C4.9 11.4 5.2 13.2 5.2 15c0 3.9 2.9 6.5 6.8 6.5z"/><path d="M12 21.5c-1.6 0-2.8-1.1-2.8-2.8 0-1.5 1.1-2.5 2.1-3.4.3 1 .8 1.5 1.5 1.7.2-.9.7-1.5 1.3-2 .5 1 .7 1.9.7 2.8 0 2.2-1.2 3.7-2.8 3.7z"/>';
  const ICO = {
    app: sv(FLAME),
    x: sv('<path d="M6 6l12 12M18 6L6 18"/>'),
    gift: sv('<path d="M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z"/>'),
    alert: sv('<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>'),
    star: sv('<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>'),
    heart: sv('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>'),
    copy: sv('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
    help: sv('<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>'),
    chev: sv('<path d="M9 18l6-6-6-6"/>'),
    trash: sv('<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/>'),
  };

  function navegador() {
    const ua = navigator.userAgent, m = ua.match(/(Edg|OPR|Chrome)\/(\d+)/);
    const nome = !m ? 'unknown' : m[1] === 'Edg' ? 'Edge' : m[1] === 'OPR' ? 'Opera' : navigator.brave ? 'Brave' : 'Chrome';
    const os = /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'other';
    return `${nome} ${m ? m[2] : ''} · ${os}`;
  }
  const relatoUrl = (T, diag) => `https://github.com/${REPO}/issues/new?title=${encodeURIComponent(T.bugTitle)}&body=${encodeURIComponent(`${T.bugBody}\n---\n\`\`\`\n${diag}\n\`\`\``)}&labels=bug`;
  async function copiar(txt) {
    try { await navigator.clipboard.writeText(txt); return true; } catch (_) {}
    try {
      const t = document.createElement('textarea'); t.value = txt; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.appendChild(t); t.select(); const ok = document.execCommand('copy'); t.remove(); return ok;
    } catch (_) { return false; }
  }

  // ───────────────────────── estilos ─────────────────────────
  // Uma família de cinzas (a do texto do TikTok, #161823 no claro / branco translúcido no escuro), um destaque (o rosa-vermelho
  // primário do TikTok: #fe2c55 claro, #ff3b5c escuro), fonte do próprio site (TikTokFont). Raios: ações em pílula (como os botões
  // do "Entrar" e as setas do feed), painéis 8, quadros 16, campos 8.
  const CSS = `
:host, .brasa-root { all: initial; }
.brasa { --bg:#121212; --menu:#252525; --raised:#2e2e2e; --tx:rgba(255,255,255,.9); --tx2:rgba(255,255,255,.75); --tx3:rgba(255,255,255,.5);
  --add:rgba(255,255,255,.08); --hov:rgba(255,255,255,.16); --line:rgba(255,255,255,.12); --acc:#ff3b5c; --accbg:rgba(255,59,92,.14); --err:#ff4c3a; --onacc:#fff;
  font: 400 14px/20px TikTokFont, Arial, Tahoma, PingFangSC, sans-serif; color: var(--tx); -webkit-font-smoothing: antialiased; }
.brasa[data-theme=light] { --bg:#fff; --menu:#fff; --raised:#fff; --tx:#161823; --tx2:rgba(22,24,35,.75); --tx3:rgba(22,24,35,.5);
  --add:rgba(22,24,35,.06); --hov:rgba(22,24,35,.12); --line:rgba(22,24,35,.12); --acc:#fe2c55; --accbg:rgba(254,44,85,.08); --err:#da3123; --onacc:#fff; }
:where(.brasa) *, :where(.brasa) *::before, :where(.brasa) *::after { box-sizing: border-box; }
:where(.brasa) button { font: inherit; color: inherit; background: none; border: 0; margin: 0; padding: 0; cursor: pointer; }
:where(.brasa) svg { display: block; flex: none; }
:where(.brasa) b { font-weight: 600; }
.brasa :focus-visible { outline: 2px solid var(--acc); outline-offset: 2px; }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 36px; padding: 0 16px; border-radius: 18px; font-weight: 600 !important; white-space: nowrap; transition: background .1s ease-out, opacity .1s ease-out; }
.btn svg { width: 18px; height: 18px; }
.btn.pri { background: var(--acc); color: var(--onacc); }
.btn.pri:hover { opacity: .9; }
.btn.sec { background: var(--add); }
.btn.sec:hover { background: var(--hov); }
.btn[disabled] { opacity: .5; cursor: default; }
.lk { color: var(--acc); font-weight: 600 !important; padding: 8px 4px !important; }
.lk:hover { text-decoration: underline; }
/* chave: trilho 36×20, bolinha 16 */
.sw { position: relative; width: 36px; height: 20px; border-radius: 10px; background: var(--hov); flex: none; transition: background .12s ease-out; }
.sw::after { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 8px; background: #fff; transition: transform .12s ease-out; box-shadow: 0 1px 2px rgba(0,0,0,.3); }
[aria-checked=true] > .sw, .sw[aria-checked=true] { background: var(--acc); }
[aria-checked=true] > .sw::after, .sw[aria-checked=true]::after { transform: translateX(16px); }
/* quadro no meio da tela (tutorial, novidades, versão nova, apoiar) */
.card { position: fixed; left: 50%; top: 50%; z-index: 2147483646; width: min(440px, calc(100vw - 32px)); max-height: calc(100vh - 48px); overflow: auto;
  transform: translate(-50%, -48%); opacity: 0; transition: opacity .15s ease-out, transform .15s ease-out;
  background: var(--menu); color: var(--tx); border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,.35); border: 1px solid var(--line); }
.card.on { opacity: 1; transform: translate(-50%, -50%); }
.card .top { display: flex; align-items: flex-start; gap: 12px; padding: 20px 16px 4px 20px; }
.card .top .app { color: var(--acc); padding-top: 2px; }
.card .ttl { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.card .kick { font-size: 12px; line-height: 18px; color: var(--tx2); }
.card .ttl b { font-size: 20px; line-height: 26px; font-weight: 700 !important; }
.card .ttl small { font-size: 12px; line-height: 18px; color: var(--tx2); }
.card .x { width: 40px; height: 40px; border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: -8px -4px 0 0; color: var(--tx2); }
.card .x:hover { background: var(--add); color: var(--tx); }
.card .bd { padding: 8px 20px 4px 20px; }
.card h3 { margin: 4px 0 6px; font-size: 16px; line-height: 22px; font-weight: 600; }
.card p { margin: 0 0 8px; color: var(--tx); }
.card ul { margin: 4px 0 8px; padding-left: 20px; } .card li { margin: 0 0 6px; }
.card .ft { display: flex; align-items: center; gap: 8px; padding: 12px 16px 16px 20px; }
.card .ft .sp { flex: 1; }
.card .dots { display: flex; gap: 6px; } .card .dots i { width: 6px; height: 6px; border-radius: 3px; background: var(--hov); } .card .dots i.on { background: var(--acc); }
.card .warn { display: inline-block; margin: 0 0 8px; padding: 2px 8px; border-radius: 4px; background: var(--acc); color: #fff; font-size: 12px; font-weight: 600; }
.card .note { margin: 8px 0; padding: 10px 12px; border-radius: 8px; background: var(--accbg); font-size: 13px; }
.card .langs { padding: 0 20px; }
/* idiomas PT · EN · ES */
.langs { display: flex; gap: 2px; align-items: center; }
.langs button { height: 28px; padding: 0 8px !important; border-radius: 14px; font-size: 12px !important; font-weight: 600 !important; color: var(--tx2); }
.langs button:hover { background: var(--add); }
.langs button.on { color: var(--tx); background: var(--add); }
/* Apoiar */
.apg { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 4px 0 12px; }
.apc { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 14px !important; border-radius: 8px; background: var(--add); text-align: left; border: 1px solid transparent !important; }
.apc:hover { background: var(--hov); } .apc.hl { border-color: var(--acc) !important; }
.apc .fl { font-size: 24px; line-height: 30px; } .apc small { color: var(--tx2); font-size: 12px; line-height: 16px; }
.apn, .aph { font-size: 12px; line-height: 18px; color: var(--tx2) !important; }
.apvs { display: flex; flex-wrap: wrap; gap: 8px; margin: 4px 0 10px; }
.apv { height: 32px; padding: 0 14px !important; border-radius: 16px; background: var(--add); font-weight: 600 !important; }
.apv[aria-pressed=true] { background: var(--tx); color: var(--bg); }
.apo input { width: 100%; height: 36px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--line); background: transparent; color: var(--tx); font: inherit; }
.apo small { display: block; margin: 4px 0 8px; font-size: 12px; color: var(--tx2); } .apo small.bad { color: var(--err); }
.qrw { display: flex; justify-content: center; margin: 4px 0; } .qr { background: #fff; padding: 8px; border-radius: 8px; }
.qrv { text-align: center; font-weight: 600; margin: 4px 0 10px; }
.apcp { width: 100%; }
.apk { display: flex; align-items: center; gap: 8px; margin: 10px 0 4px; padding: 8px 12px; border-radius: 8px; background: var(--add); }
.apk span { flex: 1; min-width: 0; display: flex; flex-direction: column; } .apk small { font-size: 11px; color: var(--tx2); } .apk code { font: 12px/16px monospace; overflow-wrap: anywhere; }
.apk button { width: 36px; height: 36px; border-radius: 18px; display: flex; align-items: center; justify-content: center; } .apk button:hover { background: var(--hov); }
.apk svg { width: 18px; height: 18px; }
/* rodapé padrão (regra 9) */
.foot { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 2px; padding: 8px 10px; font-size: 12px; line-height: 18px; color: var(--tx2); border-top: 1px solid var(--line); }
.foot > button, .foot .dreds { height: 28px; padding: 0 8px !important; border-radius: 14px; display: inline-flex; align-items: center; gap: 4px; color: var(--tx2); font-size: 12px !important; text-decoration: none; }
.foot > button:hover { background: var(--add); color: var(--tx); }
.foot > button svg { width: 16px; height: 16px; }
.foot .sig { display: inline-flex; align-items: center; padding: 0 8px; } .foot .sig a { color: var(--tx); font-weight: 600; text-decoration: none; margin: 0 3px; } .foot .sig a:hover { text-decoration: underline; }
.foot .fill { flex: 1; }
.foot .msg { flex-basis: 100%; padding: 2px 8px; color: var(--tx); }
.foot .msg.bad { color: var(--err); }
`;

  // ───────────────────────── rodapé ─────────────────────────
  // data-act: check | bug | help | apoio ; data-l: idioma
  function langsHtml(T, lang, LANGS) {
    return `<div class="langs" role="radiogroup" aria-label="${esc(T.lang)}">${LANGS.map((l) => `<button type="button" data-l="${l}" role="radio" aria-checked="${lang === l}" class="${lang === l ? 'on' : ''}">${l.toUpperCase()}</button>`).join('')}</div>`;
  }
  function footerHtml(T, lang, LANGS, version, msg) {
    return `<div class="foot">
      <button type="button" data-act="check">${esc(T.check)}</button>
      <button type="button" data-act="bug">${esc(T.report)}</button>
      <button type="button" data-act="help" title="${esc(T.howto)}" aria-label="${esc(T.howto)}">${ICO.help}</button>
      <button type="button" data-act="apoio">${esc(T.apoiar)}</button>
      <span class="sig">${esc(T.madeBy)} <a class="dreds" href="https://github.com/DredsGG" target="_blank" rel="noopener noreferrer">Dreds</a> · v${esc(version)}</span>
      <span class="fill"></span>${langsHtml(T, lang, LANGS)}
      ${msg ? `<span class="msg${msg.bad ? ' bad' : ''}" role="status">${esc(msg.t)}</span>` : ''}</div>`;
  }

  // ───────────────────────── quadros ─────────────────────────
  // makeCards({ card: elemento .card, root: ShadowRoot|document, T: () => textos, lang: () => idioma, setLang(l), LANGS, version,
  //             NOV: novidades, upd: () => estado da atualização, updCmd(cmd, data), onClosed(tipo, porX) })
  function makeCards(o) {
    let open = null, step = 0, newsFrom = '', updBusy = false, updDone = null;
    const c = o.card, T = () => o.T();
    const ap = { pais: null, valor: 10, outro: '' };
    const urgente = () => { const u = o.upd() || {}; return !!(u.disponivel && u.urgente && u.ultima && cmpVer(u.ultima, o.version) > 0); };
    const show = () => { c.hidden = false; requestAnimationFrame(() => requestAnimationFrame(() => c.classList.add('on'))); };
    const hide = () => { c.classList.remove('on'); setTimeout(() => { if (!c.classList.contains('on')) c.hidden = true; }, 160); };
    function head(icon, kick, title, sub, noX) {
      return `<div class="top"><span class="app">${icon}</span><span class="ttl"><span class="kick">${esc(kick)}</span><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span>
        ${noX ? '' : `<button class="x" type="button" title="${esc(T().close)}" aria-label="${esc(T().close)}">${ICO.x}</button>`}</div>`;
    }
    function wire(redraw) {
      const x = c.querySelector('.x'); if (x) x.addEventListener('click', () => close(true));
      for (const b of c.querySelectorAll('.langs button')) b.addEventListener('click', async () => { await o.setLang(b.dataset.l); redraw(); });
    }
    function close(byX) {
      const was = open;
      if (was === 'update' && urgente()) return;
      open = null; hide();
      if (o.onClosed) o.onClosed(was, !!byX);
    }
    function tutorial() {
      if (urgente()) return;
      open = 'tutorial'; step = 0; renderTut(); show();
    }
    function renderTut() {
      const L = T(), n = L.steps.length, [h, p] = L.steps[step], last = step === n - 1;
      c.setAttribute('aria-label', L.tutTitle);
      c.innerHTML = `${head(ICO.app, L.name, L.tutTitle, L.step(step + 1, n))}<div class="bd"><h3>${esc(h)}</h3><p>${p}</p></div>${langsHtml(L, o.lang(), o.LANGS)}
        <div class="ft"><span class="dots">${L.steps.map((_, i) => `<i class="${i === step ? 'on' : ''}"></i>`).join('')}</span><span class="sp"></span>
          ${last ? '' : `<button class="lk skip" type="button">${esc(L.skip)}</button>`}
          ${step ? `<button class="btn sec back" type="button">${esc(L.back)}</button>` : ''}
          <button class="btn pri go" type="button">${esc(last ? L.ok : L.nextBtn)}</button></div>`;
      wire(renderTut);
      const sk = c.querySelector('.skip'); if (sk) sk.addEventListener('click', () => close(false));
      const bk = c.querySelector('.back'); if (bk) bk.addEventListener('click', () => { step--; renderTut(); });
      c.querySelector('.go').addEventListener('click', () => { if (last) close(false); else { step++; renderTut(); } });
    }
    const itensDe = (from, to) => {
      const N = (o.NOV[o.lang()] || o.NOV.en || {});
      const vs = Object.keys(N).filter((x) => cmpVer(x, to) <= 0 && (!from || cmpVer(x, from) > 0)).sort((a, b) => cmpVer(b, a));
      return [].concat(...vs.map((x) => N[x] || [])).slice(0, 8);
    };
    function news(from) {
      if (from !== undefined) newsFrom = from;
      const items = itensDe(newsFrom, o.version);
      if (!items.length || urgente()) return false;
      open = 'news';
      const L = T(), base = baseVer(o.version);
      c.setAttribute('aria-label', L.newsTitle(base));
      c.innerHTML = `${head(ICO.star, L.name, L.newsTitle(base))}<div class="bd"><ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>${langsHtml(L, o.lang(), o.LANGS)}
        <div class="ft"><span class="sp"></span><button class="btn pri go" type="button">${esc(L.ok)}</button></div>`;
      wire(() => news());
      c.querySelector('.go').addEventListener('click', () => close(false));
      show();
      return true;
    }
    const noteItems = (md) => String(md || '').split(/\r?\n/).filter((l) => !/^\s*#/.test(l))
      .map((l) => l.replace(/^\s*([-*+]|\d+\.)\s*/, '').replace(/[*_`]/g, '').trim())
      .filter((l) => l && !/^(install|download|works on|chrome, edge|open .?chrome|drag the zip)/i.test(l)).slice(0, 4);
    function update() {
      const u = o.upd() || {}, L = T(), items = noteItems(u.notas), urg = urgente();
      open = 'update';
      const note = updDone === 'loja' ? L.updStore : updDone ? L.updZip : '';
      c.setAttribute('aria-label', urg ? L.urgTitle(u.ultima) : L.updTitle(u.ultima));
      c.innerHTML = `${head(urg ? ICO.alert : ICO.gift, urg ? L.urgKick : L.name, urg ? L.urgTitle(u.ultima) : L.updTitle(u.ultima), `v${o.version} → v${u.ultima}`, urg)}
        <div class="bd">${urg ? `<span class="warn">${esc(L.urgPaused)}</span><p>${esc(L.urgSub)}</p>` : ''}
          ${items.length ? `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}${note ? `<div class="note">${esc(note)}</div>` : ''}</div>${langsHtml(L, o.lang(), o.LANGS)}
        <div class="ft"><span class="sp"></span><button class="lk how" type="button">${esc(L.updHow)}</button>
          <button class="btn pri go" type="button"${updBusy ? ' disabled' : ''}>${esc(updBusy ? '…' : L.updGo)}</button></div>`;
      wire(update);
      c.querySelector('.how').addEventListener('click', () => o.updCmd('guide', '#atualizar'));
      c.querySelector('.go').addEventListener('click', async () => {
        updBusy = true; update();
        const r = await o.updCmd('apply');
        updBusy = false; updDone = (r && r.modo) || 'download';
        if (open === 'update') update();
      });
      show();
    }
    // Apoiar ♥ (regra 16): nunca abre sozinho; sem rede (BR Code e QR gerados aqui)
    async function apoio() {
      if (urgente() || !globalThis.BRASA_APOIO) return;
      try { const g = await o.loadApoio(); if (g) Object.assign(ap, g); } catch (_) {}
      open = 'apoio'; renderApoio(); show();
      setTimeout(() => { const f = c.querySelector('.apc.hl, .apv[aria-pressed="true"], .go'); if (f) f.focus({ preventScroll: true }); }, 60);
    }
    const fmtReais = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', o.lang() === 'en' ? '.' : ','));
    function qrSvg(text, px, alt) {
      const q = qrcode(0, 'M'); q.addData(text); q.make();
      const n = q.getModuleCount(), m = 2, N = n + 2 * m;
      let d = '';
      for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) d += `M${k + m} ${r + m}h1v1h-1z`;
      return `<svg viewBox="0 0 ${N} ${N}" width="${px}" height="${px}" shape-rendering="crispEdges" role="img" aria-label="${esc(alt)}"><title>${esc(alt)}</title><rect width="${N}" height="${N}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
    }
    function valorPix() {
      if (ap.valor !== 'outro') return ap.valor;
      const v = globalThis.BRASA_APOIO.lerValor(ap.outro);
      return Number.isNaN(v) ? undefined : v;
    }
    const salvarApoio = () => { try { o.saveApoio({ pais: ap.pais, valor: ap.valor }); } catch (_) {} };
    function renderApoio() {
      const L = T(), A = globalThis.BRASA_APOIO, lang = o.lang();
      c.setAttribute('aria-label', L.apoiar);
      let body;
      if (ap.pais === 'br') {
        const v = valorPix(), code = A.brcode(v == null ? null : v), alt = L.apQrAlt(v == null ? '' : fmtReais(v));
        body = `<div class="bd"><div class="apvs" role="group" aria-label="${esc(L.apBr)}">${A.DADOS.valores.map((x) => `<button class="apv" type="button" data-v="${x}" aria-pressed="${ap.valor === x}">R$ ${x}</button>`).join('')}
            <button class="apv" type="button" data-v="outro" aria-pressed="${ap.valor === 'outro'}">${esc(L.apOther)}</button></div>
          ${ap.valor === 'outro' ? `<div class="apo"><input type="text" inputmode="decimal" autocomplete="off" placeholder="R$ 0,00" value="${esc(ap.outro)}" aria-label="${esc(L.apOther)}">
            <small class="${v === undefined ? 'bad' : ''}">${esc(v === undefined ? L.apOtherBad : L.apOtherHint)}</small></div>` : ''}
          <div class="qrw"><div class="qr">${qrSvg(code, 200, alt)}</div></div>
          <div class="qrv">${esc(v == null ? L.apFree : 'R$ ' + fmtReais(v))}</div>
          <button class="btn pri apcp" type="button" data-cp="code" data-pix="${esc(code)}">${ICO.copy}<span>${esc(L.apCopy)}</span></button>
          <div class="apk"><span><small>${esc(L.apKey)}</small><code>${esc(A.DADOS.chave)}</code></span><button type="button" data-cp="key" title="${esc(L.apCopyKey)}" aria-label="${esc(L.apCopyKey)}">${ICO.copy}</button></div>
          <p class="aph">${esc(L.apHow)}</p></div>`;
        c._code = code;
      } else if (ap.pais === 'int') {
        body = `<div class="bd"><p>${esc(L.apIntText)}</p></div><div class="ft"><span class="sp"></span><button class="btn pri go" type="button" data-sp="1">${esc(L.apOpen)}</button></div>`;
      } else {
        body = `<div class="bd"><div class="apg">
            <button class="apc${lang === 'pt' ? ' hl' : ''}" type="button" data-ap="br"><span class="fl" aria-hidden="true">🇧🇷</span><b>${esc(L.apBr)}</b><small>${esc(L.apBrSub)}</small></button>
            <button class="apc${lang !== 'pt' ? ' hl' : ''}" type="button" data-ap="int"><span class="fl" aria-hidden="true">🌎</span><b>${esc(L.apInt)}</b><small>${esc(L.apIntSub)}</small></button></div>
          <p class="apn">${esc(L.apNote)}</p></div>`;
      }
      c.innerHTML = `${head(ICO.heart, L.apKick, ap.pais === 'br' ? L.apBr : ap.pais === 'int' ? L.apInt : L.apTitle)}${body}${langsHtml(L, lang, o.LANGS)}
        <div class="ft">${ap.pais ? `<button class="lk" type="button" data-back="1">${esc(L.apBack)}</button>` : ''}</div>`;
      wire(renderApoio);
      const foco = () => { const f = c.querySelector('.apc.hl, .apv[aria-pressed="true"], .go, [data-back]'); if (f) f.focus({ preventScroll: true }); };
      for (const b of c.querySelectorAll('[data-ap]')) b.addEventListener('click', () => { ap.pais = b.dataset.ap; salvarApoio(); renderApoio(); foco(); });
      const bk = c.querySelector('[data-back]'); if (bk) bk.addEventListener('click', () => { ap.pais = null; salvarApoio(); renderApoio(); foco(); });
      for (const b of c.querySelectorAll('.apv')) b.addEventListener('click', () => { ap.valor = b.dataset.v === 'outro' ? 'outro' : +b.dataset.v; salvarApoio(); renderApoio(); const i = c.querySelector('.apo input'); (i || c.querySelector(`.apv[data-v="${b.dataset.v}"]`)).focus(); });
      const inp = c.querySelector('.apo input');
      if (inp) inp.addEventListener('input', () => { ap.outro = inp.value; const pos = inp.selectionStart; renderApoio(); const j = c.querySelector('.apo input'); j.focus(); try { j.setSelectionRange(pos, pos); } catch (_) {} });
      for (const b of c.querySelectorAll('[data-cp]')) b.addEventListener('click', async () => {
        const ok = await copiar(b.dataset.cp === 'key' ? A.DADOS.chave : c._code), sp = b.querySelector('span');
        if (sp) { sp.textContent = ok ? L.apCopied : L.apCopy; setTimeout(() => { if (sp.isConnected) sp.textContent = T().apCopy; }, 1600); }
        else { b.style.color = ok ? 'var(--acc)' : ''; setTimeout(() => { b.style.color = ''; }, 1600); }
      });
      const sp = c.querySelector('[data-sp]'); if (sp) sp.addEventListener('click', () => window.open(A.DADOS.sponsors, '_blank', 'noopener,noreferrer'));
    }
    // teclado: Esc fecha (menos o urgente); Tab preso no quadro do Apoiar
    function onKey(e) {
      if (!open) return false;
      if (e.key === 'Escape') { if (!(open === 'update' && urgente())) close(open === 'update'); e.stopPropagation(); return true; }
      if (e.key === 'Tab' && open === 'apoio') {
        const f = [...c.querySelectorAll('button, input, [href]')].filter((x) => !x.disabled && x.getClientRects().length);
        if (!f.length) return false;
        const at = o.root.activeElement, i = f.indexOf(at);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && (i === -1 || i === f.length - 1)) { e.preventDefault(); f[0].focus(); }
      }
      return false;
    }
    function redraw() { if (open === 'tutorial') renderTut(); else if (open === 'news') news(); else if (open === 'update') update(); else if (open === 'apoio') renderApoio(); }
    return { tutorial, news, update, apoio, close, onKey, redraw, urgente, get open() { return open; }, hideNow() { open = null; c.classList.remove('on'); c.hidden = true; } };
  }

  globalThis.BRASA_COMUM = { REPO, esc, cmpVer, baseVer, ICO, CSS, navegador, relatoUrl, copiar, footerHtml, langsHtml, makeCards };
})();
