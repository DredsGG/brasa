// Brasa — fase 4 · rolagem automática (desligada de fábrica). Motor do Auto Reels do Salva Stories, adaptado ao TikTok:
// quando o vídeo da tela termina (o player do TikTok repete sozinho: evento 'ended' ou o currentTime voltando do fim para ~0),
// passa UMA vez para o próximo pelo botão nativo "Ir para o próximo vídeo" (plano B: seta para baixo). Foto/carrossel: passa
// depois de N s (padrão 8) contados sem parar. Não passa com o vídeo pausado, campo de texto com foco,
// mouse na barra do player ou aba escondida. Com os comentários abertos CONTINUA passando (v0.6.2, pedido do André).
// Botão "Auto" no bloco da Brasa = a mesma chave do menu.
// Medido em 2026-11-11: Jarvis/02-projetos/extensoes/role/brasa-engenharia-reversa.md (seção Rolagem)
(() => {
  'use strict';
  const M = globalThis.BRASA_MENU, C = globalThis.BRASA_COMUM;
  if (!M || !C) return;
  const { esc } = C;

  const ICO_A = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 5l9 7-9 7z"/><path d="M19 5v14"/></svg>';
  M.addSecao({
    id: 'auto', ordem: 30,
    html(T, ctx) {
      return M.cartao(ctx, 'auto', ICO_A, T['set.auto'], T.featAuto_, `<div class="campo"><span>${esc(T['set.autoFoto'])}</span>
        <input type="number" data-auto="foto" min="2" max="60" step="1" value="${esc(ctx.S.autoFoto)}" aria-label="${esc(T['set.autoFoto'])}" style="width:60px"><span>${esc(T.autoSeg)}</span></div>`);
    },
    wire(el, ctx) {
      const i = el.querySelector('[data-auto="foto"]');
      if (i) i.addEventListener('change', () => { const n = Math.max(2, Math.min(60, Math.round(+i.value || 8))); i.value = n; ctx.setAj('autoFoto', n); });
    },
  });

  const BRASA = globalThis.BRASA;
  if (!BRASA || BRASA.dead) return;
  const L = () => BRASA.L();
  const BTN = 'brasa-auto';

  // ───────────────────────── estado da tela ─────────────────────────
  function artigoDaTela() {
    const cy = innerHeight / 2;
    for (const a of document.querySelectorAll('[data-e2e="recommend-list-item-container"]')) { const r = a.getBoundingClientRect(); if (r.top <= cy && r.bottom >= cy) return a; }
    return null;
  }
  const idDe = (a) => { const w = a && a.querySelector('[id^="xgwrapper-"]'); const m = w && w.id.match(/(\d{8,})$/); return m ? m[1] : (a ? a.getAttribute('data-scroll-index') || a.id : ''); };
  const ehFoto = (a) => !!(a && a.querySelector('[data-e2e="anchoring-photo-control"]') && !a.querySelector('video'));
  // comentários (nomes do código do site): a barra lateral de comentários aberta e visível
  const COMENT = '[class*="--SectionCommentSidebarContainer"],[class*="--DivCommentSidebarTransitionWrapper"],[class*="--DivSidePanelCommentPanelRoot"],[class*="--DivCommentListContainer"]';
  const comentariosAbertos = () => { for (const e of document.querySelectorAll(COMENT)) { const r = e.getBoundingClientRect(); if (r.width > 40 && r.height > 40 && getComputedStyle(e).visibility !== 'hidden') return true; } return false; };
  const digitando = () => { const a = document.activeElement; return !!a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable || a.getAttribute('role') === 'textbox'); };
  let naBarra = false;
  const onMove = (e) => { const p = e.composedPath ? e.composedPath() : []; naBarra = p.some((x) => x && x.matches && x.matches('[data-e2e="anchoring-playback-chrome"]')); };
  const onSai = (e) => { if (!e.relatedTarget) naBarra = false; }; // mouse saiu da janela
  addEventListener('pointermove', onMove, true);
  document.addEventListener('mouseout', onSai);
  const ligadoAqui = () => BRASA.ativo() && !!BRASA.S.auto && BRASA.ehFeed();
  let trava = null, ultimoPasso = 0;
  const podeAgora = () => ligadoAqui() && !document.hidden && !digitando() && !naBarra && !trava && !(BRASA.menu && BRASA.menu.aberto);
  BRASA.auto = { podeAgora: () => ({ ligado: ligadoAqui(), escondida: document.hidden, comentarios: comentariosAbertos(), digitando: digitando(), naBarra, trava: !!trava }) };

  function passar(de) {
    const b = document.querySelector('[data-e2e="feed-navigation-next"]');
    trava = { de, at: Date.now() }; ultimoPasso = Date.now();
    document.dispatchEvent(new Event('brasa:auto-passou')); // sinal sem dados: os testes contam só os passos da Brasa
    if (b) b.click();
    else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, bubbles: true }));
    BRASA.emit('autoPassou', { de });
  }
  // uma volta do vídeo da tela: passa uma vez (ended + volta do currentTime = a mesma volta)
  function volta(v) {
    if (v.__brVolta && Date.now() - v.__brVolta < 1500) return;
    v.__brVolta = Date.now();
    setTimeout(() => { // o player volta ao 0 e toca de novo em ~50 ms; se ficou parado (pausado), não é para passar
      const a = artigoDaTela();
      if (!a || a.querySelector('video') !== v || v.paused || Date.now() - ultimoPasso < 1000 || Date.now() - chegouEm < 1500) return; // recém-chegado: não é volta
      if (podeAgora()) passar(idDe(a));
    }, 200);
  }
  const onEnded = (e) => { const v = e.target; if (v && v.tagName === 'VIDEO' && ligadoAqui()) { const a = artigoDaTela(); if (a && a.querySelector('video') === v) volta(v); } };
  document.addEventListener('ended', onEnded, true);
  let fotoChave = null, fotoDesde = 0, telaK = null, chegouEm = 0;
  const tick = setInterval(() => {
    if (BRASA.dead) return;
    const a = artigoDaTela();
    if (trava && (idDe(a) !== trava.de || Date.now() - trava.at > 2500)) trava = null;
    const kTela = idDe(a); if (kTela !== telaK) { telaK = kTela; chegouEm = Date.now(); }
    if (!ligadoAqui() || !a) { fotoChave = null; return; }
    if (!ehFoto(a)) {
      fotoChave = null;
      const v = a.querySelector('video');
      if (!v) return; // vídeo ainda montando: espera
      // o site pode reaproveitar o mesmo <video> para o próximo item: troca de item ou de arquivo zera a medida (não é "volta")
      const chave = kTela + '|' + (v.currentSrc || v.src); if (v.__brK !== chave) { v.__brK = chave; v.__brT = undefined; }
      const d = v.duration, prev = v.__brT;
      v.__brT = v.currentTime;
      if (prev !== undefined && isFinite(d) && d > 0 && prev - v.currentTime > d / 2 && v.currentTime < 1.5) volta(v);
      return;
    }
    // foto/carrossel: N s contados sem parar (qualquer trava zera)
    const k = idDe(a);
    if (k !== fotoChave || !podeAgora()) { fotoChave = k; fotoDesde = Date.now(); return; }
    if (Date.now() - fotoDesde >= Math.max(2, +BRASA.S.autoFoto || 8) * 1000) { fotoDesde = Date.now(); passar(k); }
  }, 250);

  // ───────────────────────── botão "Auto" na barra do player ─────────────────────────
  const ICO_AUTO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 5l9 7-9 7z"/><path d="M19 5v14"/></svg>';
  function garantirBotoes() {
    if (BRASA.dead || !BRASA.acoes) return;
    if (!BRASA.ativo() || !BRASA.ehFeed()) { BRASA.acoes.tirar('auto'); return; }
    BRASA.acoes.item('auto', 20, L().acaoAuto, () => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = BTN; b.innerHTML = ICO_AUTO;
      b.addEventListener('click', async (e) => { e.preventDefault(); e.stopPropagation(); const novo = !BRASA.S.auto; await BRASA.setAj('auto', novo); BRASA.log('chave', [L()['set.auto'], novo]); pintar(); });
      return b;
    });
    pintar();
  }
  function pintar() {
    const on = !!BRASA.S.auto, T = L();
    for (const b of document.querySelectorAll('.' + BTN)) {
      if (b.getAttribute('aria-pressed') !== String(on)) b.setAttribute('aria-pressed', String(on));
      b.title = on ? T.autoLigado : T.autoDesligado; b.setAttribute('aria-label', b.title);
    }
  }
  const tBtn = setInterval(garantirBotoes, 800);

  // ───────────────────────── v0.6.5: some a "Rolagem automática" do próprio TikTok (pedido do André) ─────────────────────────
  // Medido no código do site (2026-11-12; sem conta o TikTok não desenha nenhuma delas, então ⚠️ não vista na tela):
  //  - chave na barra do player: [data-e2e="cinema-playback-control-autoscroll"] (data-cinema-playback-control="autoscroll",
  //    TUXSwitch name="cinema-mode-autoscroll");
  //  - botão redondo solto com dica "Rolagem automática ligada/desligada": --DivAutoScrollButtonContainer;
  //  - item do menu "…" do player: [data-e2e="more-menu-popover_autoscroll"]; item "desktop-playback-auto-scroll";
  //  - linha da lista de opções do vídeo cujo ícone é [data-e2e="auto-scroll"] (linha = avô do ícone).
  // Com a Brasa ligada todas somem (sem perigo de apertar sem querer). Se a chave estava LIGADA, a Brasa desliga uma vez
  // (escondida, ela passaria vídeo sozinha brigando com o Auto da Brasa).
  const AUTO_TT = '[data-e2e="cinema-playback-control-autoscroll"],[data-cinema-playback-control="autoscroll"],[data-e2e="desktop-playback-auto-scroll"],'
    + '[data-e2e="more-menu-popover_autoscroll"],[class*="--DivAutoScrollButtonContainer"],:has(> * > [data-e2e="auto-scroll"])';
  const CSS_TT = `html[data-brasa-semautott] :is(${AUTO_TT}) { display: none !important; }`;
  let desligouTT = 0;
  function semAutoTT() {
    if (BRASA.dead) return;
    const html = document.documentElement;
    if (!BRASA.ativo()) { html.removeAttribute('data-brasa-semautott'); return; }
    if (!html.hasAttribute('data-brasa-semautott')) html.setAttribute('data-brasa-semautott', '');
    let st = document.getElementById('brasa-semautott-css');
    if (!st || !st.isConnected) { st = document.createElement('style'); st.id = 'brasa-semautott-css'; st.textContent = CSS_TT; (document.head || document.documentElement).appendChild(st); }
    // a chave vale para o feed todo (cada vídeo mostra uma cópia): clica UMA vez e espera 10 s o site redesenhar as outras
    // (clicar numa cópia ainda não redesenhada religaria)
    if (Date.now() - desligouTT < 10000) return;
    for (const c of document.querySelectorAll('[data-e2e="cinema-playback-control-autoscroll"]')) {
      const sw = c.querySelector('input[type="checkbox"],[role="switch"]');
      if (sw && (sw.checked === true || sw.getAttribute('aria-checked') === 'true')) { desligouTT = Date.now(); sw.click(); BRASA.log('auto', ['desligouTT']); return; }
    }
  }
  semAutoTT();
  const tTT = setInterval(semAutoTT, 1000);
  const offs = [BRASA.on('settings', garantirBotoes), BRASA.on('ativo', garantirBotoes), BRASA.on('lang', pintar), BRASA.on('nav', () => { trava = null; setTimeout(garantirBotoes, 300); })];
  BRASA.onStop(() => {
    clearInterval(tick); clearInterval(tBtn); clearInterval(tTT); offs.forEach((f) => f());
    document.documentElement.removeAttribute('data-brasa-semautott'); const stt = document.getElementById('brasa-semautott-css'); if (stt) stt.remove();
    document.removeEventListener('ended', onEnded, true); removeEventListener('pointermove', onMove, true); document.removeEventListener('mouseout', onSai);
    if (BRASA.acoes) BRASA.acoes.tirar('auto');
  });
})();
