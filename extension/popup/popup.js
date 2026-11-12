// Brasa — popup do ícone (aparece quando a aba da frente não é do TikTok). Mesmo menu da página (src/menu.js), mesmos quadros.
(() => {
  'use strict';
  const ext = globalThis.chrome, I = globalThis.BRASA_I18N, C = globalThis.BRASA_COMUM, DEF = globalThis.BRASA_DEF, M = globalThis.BRASA_MENU;
  const K = DEF.K, VERSION = ext.runtime.getManifest().version;
  const S = Object.assign({}, DEF.AJ);
  let lang = I.detect(), upd = {}, tema = 'dark';
  const L = () => I.T[lang] || I.T.en;
  const updCmd = (cmd, data) => new Promise((ok) => { try { ext.runtime.sendMessage({ type: 'brasa:update', cmd, data }).then(ok, () => ok(null)); } catch (_) { ok(null); } });
  const urgente = () => !!(upd.disponivel && upd.urgente && upd.ultima && C.cmpVer(upd.ultima, VERSION) > 0);

  const app = document.getElementById('app');
  const sh = app.attachShadow({ mode: 'open' });
  const CSS_POP = `
.pn { width: 360px; max-width: 360px; border-radius: 0; border: 0; box-shadow: none; }
.pop { display: flex; align-items: center; gap: 10px; margin: 8px 12px; padding: 10px 12px; border-radius: 8px; background: var(--add); font-size: 13px; line-height: 18px; color: var(--tx2); }
.pop span { flex: 1; } .pop .btn { height: 32px; padding: 0 14px; }
.toast { position: fixed; left: 50%; bottom: 12px; transform: translateX(-50%); padding: 8px 14px; border-radius: 8px; background: rgba(84,84,84,.92); color: #fff; font-size: 13px; opacity: 0; transition: opacity .15s ease-out; white-space: nowrap; }
.toast.on { opacity: 1; }
`;
  sh.innerHTML = `<style>${C.CSS}${M.CSS}${CSS_POP}</style><div class="brasa"><div class="menu"></div><div class="card" role="dialog" hidden></div><div class="toast" role="status"></div></div>`;
  const wrap = sh.querySelector('.brasa'), el = sh.querySelector('.menu');
  let toastT = 0;
  function toast(m) { const t = sh.querySelector('.toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2500); }

  const cards = C.makeCards({
    card: sh.querySelector('.card'), root: sh, T: L, lang: () => lang, setLang: (l) => setLang(l), LANGS: I.LANGS, version: VERSION, NOV: globalThis.BRASA_NOVIDADES || {},
    upd: () => upd, updCmd, onClosed: () => { document.body.classList.remove('quadro'); },
    loadApoio: async () => (await ext.storage.local.get(K.apoio))[K.apoio],
    saveApoio: (v) => ext.storage.local.set({ [K.apoio]: v }),
  });
  const abrirQuadro = (f) => { document.body.classList.add('quadro'); f(); };

  let ajQ = Promise.resolve();
  function setAj(k, v) {
    S[k] = v;
    ajQ = ajQ.then(async () => { try { const cur = (await ext.storage.local.get(K.aj))[K.aj] || {}; cur[k] = v; await ext.storage.local.set({ [K.aj]: cur }); } catch (_) {} });
    return ajQ;
  }
  async function setLang(l) { lang = I.LANGS.includes(l) ? l : I.detect(); await setAj('lang', I.LANGS.includes(l) ? l : ''); render(); cards.redraw(); }
  const lerLog = async () => { try { return (await ext.storage.local.get(K.log))[K.log] || []; } catch (_) { return []; } };

  const st = { aba: 'rec', msg: null, log: [] };
  const ctx = {
    T: L, lang: () => lang, LANGS: I.LANGS, S, setAj, VERSION, onde: 'popup', upd: () => upd, urgente, setLang,
    acao: (a) => acao(a), lerLog, limparLog: () => ext.storage.local.set({ [K.log]: [] }), copiar: C.copiar, toast,
    lembrarAba: (a) => { try { ext.storage.local.set({ [K.aba]: a }); } catch (_) {} },
  };
  async function acao(act) {
    const T = L();
    if (act === 'on') { const novo = !S.on; await setAj('on', novo); DEF.logar('chave', [T['set.on'], novo]); render(); }
    else if (act === 'upd') abrirQuadro(() => cards.update());
    else if (act === 'help') abrirQuadro(() => cards.tutorial());
    else if (act === 'apoio') abrirQuadro(() => cards.apoio());
    else if (act === 'bug') {
      const d = (await updCmd('diag')) || {};
      const log = ((await lerLog()).slice(-20)).map((e) => `- ${Math.round((Date.now() - e.em) / 60000)} min: ${e.k} ${e.ok ? 'ok' : 'FAIL'}`).join('\n') || '- (empty)';
      const diag = [`Brasa v${VERSION}`, `Browser: ${C.navegador()}`, `Install: ${d.instalacao || '?'}`, `UI: ${lang} / ${navigator.language} · theme=${tema}`,
        `Settings: ${Object.keys(DEF.AJ).filter((k) => typeof DEF.AJ[k] === 'boolean').map((k) => `${k}=${S[k] ? 1 : 0}`).join(' ')}`, 'Page: popup',
        `Update: latest=${upd.ultima || '-'} noRelease=${upd.semRelease ? 1 : 0} err=${upd.erro || '-'}`, '', 'Last events:', log].join('\n');
      await C.copiar(diag);
      ext.tabs.create({ url: C.relatoUrl(T, diag) });
      st.msg = { t: T.bugCopied }; render();
    } else if (act === 'check') {
      st.msg = { t: T.checking }; render();
      const r = (await updCmd('check')) || {};
      upd = r.erro ? upd : r;
      st.msg = r.erro ? { t: T.checkErr, bad: true } : r.disponivel ? { t: T.newVer(r.ultima) } : { t: T.upToDate };
      render();
    } else if (act === 'tiktok') { ext.tabs.create({ url: 'https://www.tiktok.com/foryou' }); window.close(); }
  }
  function render() {
    const T = L();
    wrap.dataset.theme = tema; document.body.dataset.theme = tema;
    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : lang;
    el.innerHTML = M.html(ctx, st).replace('<div class="tabs"', `<div class="pop"><span>${C.esc(T.popSemAba)}</span><button type="button" class="btn pri" data-act="tiktok">${C.esc(T.popAbrir)}</button></div><div class="tabs"`);
    M.wire(el, ctx, st, render);
  }
  addEventListener('keydown', (e) => { cards.onKey(e); });

  ext.storage.local.get([K.aj, K.update, K.tema, K.aba, K.log]).then(async (l) => {
    const aj = l[K.aj] || {};
    for (const k of Object.keys(DEF.AJ)) if (k in aj) S[k] = aj[k];
    if (I.LANGS.includes(S.lang)) lang = S.lang;
    upd = l[K.update] || {};
    tema = l[K.tema] || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    if (l[K.aba]) st.aba = l[K.aba];
    const q = new URLSearchParams(location.search).get('aba'); if (q) st.aba = q;
    st.log = l[K.log] || [];
    render();
    updCmd('check-soft').then((r) => { if (r && !r.erro) { upd = r; render(); } });
  });
  ext.storage.onChanged.addListener((ch, area) => {
    if (area !== 'local') return;
    if (ch[K.log] && st.aba === 'log') { st.log = ch[K.log].newValue || []; render(); }
    if (ch[K.update]) { upd = ch[K.update].newValue || {}; render(); }
  });
})();
