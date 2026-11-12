// Brasa — interface dentro do TikTok: botão "Brasa" na barra lateral (abaixo dos itens nativos), o menu, os quadros no meio
// da tela (tutorial, novidades, versão nova, apoiar), avisos curtos e o rodapé padrão. Nunca cobre o vídeo sozinho: o menu só
// abre no clique, fecha no clique fora ou no Esc, e cliques e teclas dentro dele não chegam ao TikTok (não pausa, não rola).
(() => {
  'use strict';
  const BRASA = globalThis.BRASA;
  if (!BRASA || BRASA.dead) return;
  const { ext, I, C, DEF } = BRASA;
  const M = globalThis.BRASA_MENU;
  const { ICO } = C;
  const NOV = globalThis.BRASA_NOVIDADES || {};
  const L = () => BRASA.L();
  const ADIA_MS = 60 * 60 * 1000;
  const K = BRASA.K;

  const temaTT = () => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
  let temaSalvo = '';
  function anotarTema() { const t = temaTT(); if (t !== temaSalvo) { temaSalvo = t; try { ext.storage.local.set({ [K.tema]: t }); } catch (_) {} } }

  // ───────────────────────── host da página (quadros, aviso, menu) ─────────────────────────
  let host = null, root = null, wrap = null, cards = null;
  function ui() {
    const alvo = document.fullscreenElement || document.documentElement;
    if (host && host.isConnected) { if (host.parentNode !== alvo) alvo.appendChild(host); return root; }
    host = document.createElement('brasa-ui');
    host.style.cssText = 'position:fixed;inset:0;width:0;height:0;z-index:2147483646;';
    root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${C.CSS}${M.CSS}${CSS_UI}</style><div class="brasa" data-theme="${temaTT()}"><div class="card" role="dialog" aria-modal="false" hidden></div>
      <div class="toast" role="status" hidden><span class="msg"></span></div>
      <div class="menu" hidden></div><div class="conf" role="alertdialog" aria-modal="true" hidden></div><button class="flut" type="button" hidden aria-label="Brasa" title="Brasa">${ICO.app}<span>Brasa</span></button></div>`;
    wrap = root.querySelector('.brasa');
    alvo.appendChild(host);
    cards = C.makeCards({
      card: root.querySelector('.card'), root, T: L, lang: () => BRASA.lang, setLang: (l) => BRASA.setLang(l), LANGS: I.LANGS, version: BRASA.VERSION, NOV,
      upd: () => BRASA.upd, updCmd, onClosed,
      loadApoio: async () => (await ext.storage.local.get(K.apoio))[K.apoio],
      saveApoio: (v) => ext.storage.local.set({ [K.apoio]: v }),
    });
    root.querySelector('.flut').addEventListener('click', () => toggleMenu());
    for (const ev of ['click', 'dblclick', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'keydown', 'keyup', 'keypress', 'wheel', 'contextmenu']) host.addEventListener(ev, (e) => e.stopPropagation());
    return root;
  }
  const updCmd = (cmd, data) => new Promise((ok) => { try { ext.runtime.sendMessage({ type: 'brasa:update', cmd, data }).then(ok, () => ok(null)); } catch (_) { ok(null); } });

  const CSS_UI = `
.toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 2147483646; display: flex; align-items: center; gap: 12px; min-height: 44px; padding: 10px 16px;
  border-radius: 8px; background: rgba(84,84,84,.92); color: #fff; font-size: 14px; opacity: 0; transition: opacity .15s ease-out; max-width: calc(100vw - 32px); }
.toast.on { opacity: 1; }
.menu { position: fixed; z-index: 2147483645; }
.flut { position: fixed; left: 16px; bottom: 16px; z-index: 2147483644; display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 16px 0 12px !important; border-radius: 20px;
  background: var(--menu); color: var(--tx); border: 1px solid var(--line) !important; box-shadow: 0 2px 8px rgba(0,0,0,.15); font-weight: 600 !important; }
.flut svg { width: 22px; height: 22px; color: var(--acc); }
.flut:hover { background: var(--raised); }
.conf { position: fixed; z-index: 2147483646; }
.conf .cf { width: 340px; padding: 16px; gap: 10px; box-shadow: 0 4px 24px rgba(0,0,0,.3); }
.conf .cf h3 { margin: 0; font-size: 17px; font-weight: 700; } .conf .cf p { margin: 0; font-size: 14px; line-height: 20px; color: var(--tx2); }
.conf .cf .acoes { display: flex; gap: 8px; margin-top: 4px; } .conf .cf .acoes .btn { flex: 1; }
.flut[hidden] { display: none !important; } /* v0.6.3: o display:flex acima vencia o [hidden] e o botão solto aparecia junto com o da barra */
`;

  // ───────────────────────── avisos curtos ─────────────────────────
  let toastT = 0;
  function toast(msg, ms) {
    ui();
    const t = root.querySelector('.toast');
    t.querySelector('.msg').textContent = msg;
    t.hidden = false; requestAnimationFrame(() => t.classList.add('on'));
    clearTimeout(toastT); toastT = setTimeout(hideToast, ms || 4000);
  }
  function hideToast() { if (!root) return; const t = root.querySelector('.toast'); t.classList.remove('on'); setTimeout(() => { if (!t.classList.contains('on')) t.hidden = true; }, 160); }
  BRASA.toast = toast;

  // ───────────────────────── confirmação da Brasa (v0.6.4: Trocar de conta) ─────────────────────────
  let confFim = null;
  function confirmar({ titulo, texto, sim, nao }) {
    ui();
    if (confFim) confFim(false);
    return new Promise((ok) => {
      const c = root.querySelector('.conf'), e = C.esc;
      wrap.dataset.theme = temaTT();
      c.innerHTML = `<div class="pn cf"><h3>${e(titulo)}</h3><p>${e(texto)}</p><div class="acoes"><button type="button" class="btn sec" data-r="0">${e(nao)}</button><button type="button" class="btn pri" data-r="1">${e(sim)}</button></div></div>`;
      const nav = document.getElementById(NAV_ID), r = nav && nav.getBoundingClientRect();
      c.style.left = (r && r.width ? Math.max(8, Math.min(r.left, innerWidth - 356)) : 16) + 'px'; c.style.bottom = '16px';
      c.hidden = false;
      const onEsc = (ev) => { if (ev.key === 'Escape') { ev.stopPropagation(); fim(false); } };
      const fim = (v) => { if (confFim !== fim) return; confFim = null; c.hidden = true; c.innerHTML = ''; removeEventListener('keydown', onEsc, true); ok(v); };
      confFim = fim;
      c.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => fim(b.dataset.r === '1')));
      addEventListener('keydown', onEsc, true);
      c.querySelector('[data-r="1"]').focus();
    });
  }
  BRASA.confirmar = confirmar;

  // ───────────────────────── quadros (regras 12 e 14) ─────────────────────────
  let adiado = null, ready = false;
  const PAGE_ID = Math.random().toString(36).slice(2);
  const adiadoAqui = () => { const u = BRASA.upd; return !!(adiado && adiado.ultima === u.ultima && adiado.ate > Date.now()); };
  function onClosed(tipo, porX) {
    if (tipo === 'news') marcarNovLidas();
    if (tipo === 'update' && porX) { // X ou Esc: adia 1 h
      adiado = { ultima: BRASA.upd.ultima, ate: Date.now() + ADIA_MS, pagina: PAGE_ID };
      try { ext.storage.local.set({ [K.adiado]: adiado }); } catch (_) {}
    } else if (tipo !== 'update') setTimeout(maybeUpdate, 400); // o aviso de versão espera o tutorial/novidades
  }
  async function marcarNovLidas() {
    try { const ob = (await ext.storage.local.get(K.onboard))[K.onboard] || {}; await ext.storage.local.set({ [K.onboard]: Object.assign({}, ob, { novLidas: C.baseVer(BRASA.VERSION) }) }); } catch (_) {}
  }
  function maybeUpdate() {
    if (!ready || BRASA.dead) return;
    const u = BRASA.upd, tem = u.disponivel && u.ultima && C.cmpVer(u.ultima, BRASA.VERSION) > 0;
    ui();
    if (!tem) { if (cards.open === 'update') cards.hideNow(); return; }
    if (cards.urgente()) { if (cards.open !== 'update') { fecharMenu(); cards.update(); } return; } // urgente passa na frente de tudo
    if (cards.open || adiadoAqui()) return;
    cards.update();
  }
  const visivel = () => new Promise((ok) => {
    if (document.visibilityState === 'visible') return ok();
    const f = () => { if (document.visibilityState === 'visible') { document.removeEventListener('visibilitychange', f); ok(); } };
    document.addEventListener('visibilitychange', f);
  });
  const versaoAnterior = (v) => Object.keys(NOV.en || NOV.pt || {}).filter((x) => C.cmpVer(x, v) < 0).sort((a, b) => C.cmpVer(b, a))[0] || '';
  async function startBoxes() {
    let ob;
    try { ob = (await ext.storage.local.get(K.onboard))[K.onboard]; adiado = (await ext.storage.local.get(K.adiado))[K.adiado] || null; } catch (_) { return; }
    procurarAgora();
    await new Promise((r) => setTimeout(r, 1500)); // deixa o TikTok desenhar primeiro
    if (BRASA.dead) return;
    ready = true;
    ui();
    if (cards.urgente()) return maybeUpdate();
    await visivel(); // aba em segundo plano (ou a janela do guarda-foguinho) não "gasta" o quadro
    if (BRASA.dead || janelaDoGuarda()) return;
    try { ob = (await ext.storage.local.get(K.onboard))[K.onboard] || ob; } catch (_) {}
    const BASE = C.baseVer(BRASA.VERSION);
    if (!ob || ob.tutorial === 'pendente') {
      await ext.storage.local.set({ [K.onboard]: Object.assign({}, ob || {}, { tutorial: 'visto', visto: BRASA.VERSION, novLidas: BASE }) });
      return cards.tutorial();
    }
    if (ob.visto !== BRASA.VERSION) await ext.storage.local.set({ [K.onboard]: Object.assign({}, ob, { visto: BRASA.VERSION }) });
    if (ob.novLidas !== BASE) {
      let from = ob.novLidas || ob.visto || '';
      if (from && C.cmpVer(C.baseVer(from), BASE) >= 0) from = versaoAnterior(BASE);
      if (cards.news(from)) return;
      marcarNovLidas();
    }
    maybeUpdate();
  }
  // a janela que o guarda-foguinho abre (fase 2) leva #brasa-guarda na URL: nela não aparece quadro nenhum
  const guardaAoAbrir = /brasa-guarda/.test(location.hash);
  const janelaDoGuarda = () => guardaAoAbrir || /brasa-guarda/.test(location.hash);
  const procurarAgora = () => { if (BRASA.alive()) updCmd('check-soft'); };
  const onVis = () => { if (document.visibilityState === 'visible') procurarAgora(); };
  document.addEventListener('visibilitychange', onVis);
  addEventListener('focus', procurarAgora);

  // ───────────────────────── botão na barra lateral ─────────────────────────
  // Medido em 2026-11-11: os itens são <h2><a data-e2e="nav-foryou"><button class="TUXButton …">…</button></a></h2> e o último é
  // <div class="TUXTooltip-reference"><button data-e2e="nav-more-menu" …> (Mais). O botão Brasa é uma cópia do botão "Mais"
  // (mesmas classes, então mesmo visual no claro, no escuro e com a barra recolhida), com o ícone e o texto trocados, logo abaixo dele.
  const NAV_ID = 'brasa-nav';
  let semBarraDesde = 0, avisouSemBarra = false;
  // v0.6.4: medido ao vivo que no Seguindo, perfil, busca e hashtag cada item vem dentro de um <div TUXTooltip-reference> (no
  // Para você vem num <h2>). O contêiner certo é o que tem o "Para você" E o último item (Mais; sem ele, Perfil ou o último nav-*).
  const temCaixa = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  function navInfo() {
    const fys = [...document.querySelectorAll('[data-e2e="nav-foryou"]')];
    const fy = fys.find(temCaixa) || fys[0];
    if (!fy) return null;
    const mais = document.querySelector('[data-e2e="nav-more-menu"]');
    const navs = [...document.querySelectorAll('[data-e2e^="nav-"]')].filter((e) => !e.closest('#' + NAV_ID) && !e.closest('[data-brasa-item]'));
    const fimEl = mais || document.querySelector('[data-e2e="nav-profile"]') || navs[navs.length - 1];
    let cont = fy.parentElement;
    while (cont && fimEl && !cont.contains(fimEl)) cont = cont.parentElement;
    if (!cont || !fimEl || cont === document.body) { const item = fy.closest('h2') || fy; cont = item.parentElement; if (!cont) return null; }
    let ultimo = fimEl;
    while (ultimo && ultimo.parentElement !== cont) ultimo = ultimo.parentElement;
    return { cont, mais, ultimo: ultimo || cont.lastElementChild, modelo: mais || fy.querySelector('button') || fy };
  }
  // cópia do botão "Mais" (mesmo visual nos dois temas e com a barra recolhida), com ícone e texto trocados
  function montarBotao(info, o) {
    o = o || { id: NAV_ID, icone: ICO.app, rotulo: 'Brasa', popup: 'dialog', clique: () => toggleMenu() };
    const w = document.createElement('div');
    w.id = o.id; w.setAttribute('data-brasa-item', '');
    const b = info.modelo.cloneNode(true);
    for (const a of ['data-e2e', 'data-key-interaction', 'aria-pressed', 'aria-disabled', 'id']) b.removeAttribute(a);
    b.type = 'button';
    b.setAttribute('aria-label', o.rotulo); if (o.popup) { b.setAttribute('aria-haspopup', o.popup); b.setAttribute('aria-expanded', 'false'); } else b.removeAttribute('aria-haspopup');
    b.dataset.brasa = info.modelo.className;
    const ic = b.querySelector('svg');
    if (ic) {
      // mesmo tamanho do ícone do botão modelo, medido na tela (o TikTok define pelo CSS dele)
      // (o "Mais" pode estar escondido pelo modo foco: mede o primeiro ícone visível da barra)
      // medido ao vivo: Perfil 24 px, Mais 19, Para você 32 (casinha maior) → o do Perfil primeiro
      const icones = [document.querySelector('[data-e2e="nav-profile"] svg'), info.modelo.querySelector('svg'), document.querySelector('[data-e2e="nav-following"] svg')];
      const r = icones.map((x) => x && x.getBoundingClientRect()).find((x) => x && x.width >= 12 && x.width <= 48);
      const px = r ? Math.round(r.width) + 'px' : '24px';
      const box = ic.parentElement;
      box.innerHTML = o.icone;
      const s = box.querySelector('svg'); s.setAttribute('width', px); s.setAttribute('height', px); s.style.cssText = `width:${px};height:${px};color:var(--tux-colorPrimary,#fe2c55)`;
      box.querySelectorAll('[class*="Badge"],[class*="RedDot"]').forEach((x) => x.remove());
    }
    const lab = b.querySelector('.TUXButton-label');
    if (lab) lab.textContent = o.rotulo;
    else if (!ic) b.textContent = o.rotulo;
    b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); o.clique(b); });
    w.appendChild(b);
    return w;
  }
  function ensureBtn() {
    if (BRASA.dead) return;
    const info = navInfo();
    let w = document.getElementById(NAV_ID);
    ui();
    const flut = root.querySelector('.flut');
    if (!info || !info.modelo) {
      if (w) w.remove();
      if (!semBarraDesde) semBarraDesde = Date.now();
      // sem barra lateral por 4 s (página sem barra, como a de entrar, ou layout novo): botão solto no canto (plano B)
      if (Date.now() - semBarraDesde > 4000) {
        flut.hidden = false;
        if (!avisouSemBarra && ['foryou', 'following', 'friends', 'explore', 'profile', 'video'].includes(BRASA.page.kind)) { avisouSemBarra = true; BRASA.log('semBotao', [], false); }
      }
      return;
    }
    semBarraDesde = 0; flut.hidden = true;
    // recria se sumiu, saiu do lugar ou o TikTok trocou o visual do botão modelo (barra recolhida, tema)
    const b = w && w.querySelector('button');
    if (w && w.isConnected && w.parentElement === info.cont && w.previousElementSibling === info.ultimo && b && b.dataset.brasa === info.modelo.className) {
      b.setAttribute('aria-expanded', String(!!menuAberto));
    } else {
      if (w) w.remove();
      w = montarBotao(info);
      info.ultimo.after(w);
    }
    garantirExtras(info, w);
  }
  // itens da Brasa logo abaixo do botão Brasa (v0.6.4: "Trocar de conta"), na ordem em que foram registrados
  const extras = [];
  function garantirExtras(info, anterior) {
    for (const x of extras) {
      let el = document.getElementById(x.id);
      let mostrar = false; try { mostrar = !!x.mostrar(); } catch (_) {}
      if (!mostrar) { if (el) el.remove(); continue; }
      const rot = x.rotulo(), bt = el && el.querySelector('button');
      if (!(el && el.isConnected && el.parentElement === info.cont && el.previousElementSibling === anterior && bt && bt.dataset.brasa === info.modelo.className && bt.getAttribute('aria-label') === rot)) {
        if (el) el.remove();
        el = montarBotao(info, { id: x.id, icone: x.icone, rotulo: rot, popup: x.popup || null, clique: x.clique });
        anterior.after(el);
      }
      anterior = el;
    }
  }
  BRASA.barraExtra = (x) => { extras.push(x); ensureBtn(); };
  BRASA.barraSair = () => { for (const x of extras) { const el = document.getElementById(x.id); if (el) el.remove(); } };

  // ───────────────────────── menu ─────────────────────────
  let menuAberto = false;
  const st = { aba: 'rec', msg: null, log: [] };
  const ctx = {
    T: L, lang: () => BRASA.lang, LANGS: I.LANGS, S: BRASA.S, setAj: (k, v) => BRASA.setAj(k, v), VERSION: BRASA.VERSION, onde: 'pagina',
    upd: () => BRASA.upd, urgente: () => BRASA.urgente(), setLang: (l) => BRASA.setLang(l),
    acao: (a, el) => acao(a, el), lerLog, limparLog: () => ext.storage.local.set({ [K.log]: [] }), copiar: C.copiar, toast,
    lembrarAba: (a) => { try { ext.storage.local.set({ [K.aba]: a }); } catch (_) {} },
    bridge: BRASA.bridge, page: BRASA.page,
  };
  async function lerLog() { try { return (await ext.storage.local.get(K.log))[K.log] || []; } catch (_) { return []; } }
  function posicionar(el) {
    const btn = document.querySelector(`#${NAV_ID} button`), info = navInfo();
    const pn = el.querySelector('.pn'); if (!pn) return;
    const W = Math.min(360, innerWidth - 16);
    let left = 8;
    if (btn && info) { const r = info.cont.getBoundingClientRect(); left = Math.max(8, Math.min(r.left, innerWidth - W - 8)); }
    el.style.left = left + 'px'; el.style.bottom = '12px'; el.style.top = '';
    pn.style.maxHeight = (innerHeight - 24) + 'px';
    const sc = pn.querySelector('.sc'); if (sc) sc.style.maxHeight = Math.max(140, innerHeight - 24 - 56 - 45 - 110) + 'px';
  }
  // a folha do shadow root é montada quando a página abre; recursos que carregam depois (guarda.js: lista de conversas da aba
  // Foguinho) acrescentam CSS ao M.CSS — sem isso a lista saía sem estilo (achado no print do README da v1.0.0)
  function estiloEmDia() {
    const st = root && root.querySelector('style'), css = C.CSS + M.CSS + CSS_UI;
    if (st && st.textContent.length !== css.length) st.textContent = css;
  }
  function renderMenu() {
    estiloEmDia();
    if (!menuAberto) return;
    ui();
    const el = root.querySelector('.menu');
    wrap.dataset.theme = temaTT();
    el.innerHTML = M.html(ctx, st);
    el.hidden = false;
    posicionar(el);
    M.wire(el, ctx, st, renderMenu);
  }
  async function abrirMenu() {
    menuAberto = true; st.msg = null;
    try { const a = (await ext.storage.local.get(K.aba))[K.aba]; if (a) st.aba = a; } catch (_) {}
    if (st.aba === 'log') st.log = await lerLog();
    renderMenu(); ensureBtn();
  }
  function fecharMenu() {
    if (!menuAberto) return;
    menuAberto = false;
    if (root) { const el = root.querySelector('.menu'); el.innerHTML = ''; el.hidden = true; }
    ensureBtn();
  }
  function toggleMenu() { if (menuAberto) fecharMenu(); else abrirMenu(); }
  BRASA.menu = { abrir: abrirMenu, fechar: fecharMenu, redesenhar: () => menuAberto && renderMenu(), get aberto() { return menuAberto; } };

  async function acao(act) {
    const T = L();
    if (act === 'on') { const novo = !BRASA.S.on; await BRASA.setAj('on', novo); BRASA.log('chave', [T['set.on'], novo]); renderMenu(); }
    else if (act === 'upd') { fecharMenu(); ui(); cards.update(); }
    else if (act === 'help') { fecharMenu(); ui(); ready = true; cards.tutorial(); }
    else if (act === 'apoio') { fecharMenu(); ui(); cards.apoio(); }
    else if (act === 'bug') { await abrirRelato(); }
    else if (act === 'check') {
      st.msg = { t: T.checking }; renderMenu();
      const r = (await updCmd('check')) || {};
      st.msg = r.erro ? { t: T.checkErr, bad: true } : r.disponivel ? { t: T.newVer(r.ultima) } : { t: T.upToDate };
      renderMenu();
    }
  }

  // "Relatar bug" (regra 9): abre o relato nos Issues do repo com a versão e um diagnóstico sem dado pessoal (sem URL, sem nome de
  // perfil, sem conversa: do registro só vão os tipos de evento). Também copia o texto (se o GitHub não abrir, dá para colar).
  async function diagnostico() {
    let loc = {};
    try { loc = await ext.storage.local.get([K.log, K.update, K.disco]); } catch (_) {}
    const d = (await updCmd('diag')) || {}, agora = Date.now(), u = loc[K.update] || {};
    const log = (loc[K.log] || []).slice(-20).map((e) => `- ${Math.round((agora - e.em) / 60000)} min: ${e.k} ${e.ok ? 'ok' : 'FAIL'}`).join('\n') || '- (empty)';
    const chaves = Object.keys(DEF.AJ).filter((k) => typeof DEF.AJ[k] === 'boolean');
    const st2 = BRASA.mainOk ? await BRASA.bridge('stats') : null;
    const bt = document.getElementById(NAV_ID) ? 'sidebar' : root && !root.querySelector('.flut').hidden ? 'float' : '0';
    return [`Brasa v${BRASA.VERSION}`, `Browser: ${C.navegador()}`, `Install: ${d.instalacao || '?'}`, `UI: ${BRASA.lang} / ${navigator.language} · theme=${temaTT()}`,
      `Settings: ${chaves.map((k) => `${k}=${BRASA.S[k] ? 1 : 0}`).join(' ')}`,
      `Page: ${BRASA.page.kind} main=${BRASA.mainOk ? 1 : 0} btn=${bt} fs=${document.fullscreenElement ? 1 : 0}`,
      `Feed: responses=${st2 ? st2.respostas : '-'} items=${st2 ? st2.emMemoria : '-'} routes=${st2 ? Object.keys(st2.porRota || {}).join(',') : '-'}`,
      `Update: latest=${u.ultima || '-'} noRelease=${u.semRelease ? 1 : 0} err=${u.erro || '-'}`,
      loc[K.disco] ? `Disk: ${loc[K.disco].estado || '-'} (${loc[K.disco].noDisco || '-'})` : null, '', 'Last events:', log].filter((x) => x !== null).join('\n');
  }
  async function abrirRelato() {
    const T = L(), diag = await diagnostico();
    await C.copiar(diag);
    window.open(C.relatoUrl(T, diag), '_blank', 'noopener');
    st.msg = { t: T.bugCopied }; renderMenu();
  }
  BRASA.diagnostico = diagnostico;

  // ───────────────────────── teclado, tela cheia, clique fora ─────────────────────────
  const onKey = (e) => {
    if (cards && cards.onKey(e)) return;
    if (e.key === 'Escape' && menuAberto) { fecharMenu(); e.stopPropagation(); }
  };
  addEventListener('keydown', onKey, true);
  const onDocDown = (e) => {
    if (!menuAberto || !e.isTrusted) return;
    const path = e.composedPath ? e.composedPath() : [];
    if (path.includes(host) || path.includes(document.getElementById(NAV_ID))) return;
    fecharMenu();
  };
  document.addEventListener('pointerdown', onDocDown, true);
  const onFs = () => { if (host) ui(); if (menuAberto) renderMenu(); };
  document.addEventListener('fullscreenchange', onFs);
  const onResize = () => { if (menuAberto && root) posicionar(root.querySelector('.menu')); };
  addEventListener('resize', onResize);

  // o TikTok redesenha a barra lateral (navegação, tema, recolher): confere a cada 1 s (barato) e na navegação
  const tBtn = setInterval(() => { ensureBtn(); anotarTema(); if (wrap && wrap.dataset.theme !== temaTT()) wrap.dataset.theme = temaTT(); }, 1000);
  const offs = [
    BRASA.on('nav', () => { ensureBtn(); }),
    BRASA.on('settings', () => { if (menuAberto) renderMenu(); }),
    BRASA.on('lang', () => { if (menuAberto) renderMenu(); if (cards) cards.redraw(); }),
    BRASA.on('log', (l) => { if (menuAberto && st.aba === 'log') { st.log = l; renderMenu(); } }),
    BRASA.on('update', () => { if (cards && cards.open === 'update' && BRASA.upd.disponivel) cards.update(); else maybeUpdate(); if (menuAberto) renderMenu(); }),
    BRASA.on('msg', (m) => {
      if (m.type === 'brasa:menu') toggleMenu();
      if (m.type === 'brasa:tutorial') { ready = true; ui(); cards.tutorial(); }
      if (m.type === 'brasa:news') { ui(); cards.news(''); }
    }),
  ];
  const onAd = (ch, area) => { if (area === 'local' && ch[K.adiado] && BRASA.alive()) { adiado = ch[K.adiado].newValue || null; maybeUpdate(); } };
  ext.storage.onChanged.addListener(onAd);
  const tUpd = setInterval(maybeUpdate, 30000); // o adiamento de 1 h vence → o aviso volta sozinho

  BRASA.onStop(() => {
    offs.forEach((f) => f());
    try { ext.storage.onChanged.removeListener(onAd); } catch (_) {}
    clearInterval(tBtn); clearInterval(tUpd); clearTimeout(toastT);
    removeEventListener('keydown', onKey, true);
    removeEventListener('resize', onResize);
    document.removeEventListener('pointerdown', onDocDown, true);
    document.removeEventListener('fullscreenchange', onFs);
    document.removeEventListener('visibilitychange', onVis);
    removeEventListener('focus', procurarAgora);
    const w = document.getElementById(NAV_ID); if (w) w.remove();
    BRASA.barraSair();
    if (host) host.remove();
  });

  const iniciar = () => BRASA.ready.then(() => { if (BRASA.dead) return; ensureBtn(); anotarTema(); startBoxes(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true }); else iniciar();
})();
