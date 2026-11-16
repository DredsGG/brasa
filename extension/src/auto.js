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
        <input type="number" data-auto="foto" min="2" max="60" step="1" value="${esc(ctx.S.autoFoto)}" aria-label="${esc(T['set.autoFoto'])}" style="width:60px"><span>${esc(T.autoSeg)}</span></div>
        ${M.grupo(T.grpFundo, M.chip(T, ctx, 'autoFundo'))}`);
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
    const nv = BRASA.navegador && BRASA.navegador(); if (nv) return nv.el; // v1.0.2: modo navegador (o quadro do vídeo)
    const cy = innerHeight / 2;
    for (const a of document.querySelectorAll('[data-e2e="recommend-list-item-container"]')) { const r = a.getBoundingClientRect(); if (r.top <= cy && r.bottom >= cy) return a; }
    return null;
  }
  const doQuadro = (a) => { const nv = a && BRASA.navegador && BRASA.navegador(); return nv && nv.el === a ? nv : null; };
  const idDe = (a) => { const w = a && a.querySelector('[id^="xgwrapper-"]'); const m = w && w.id.match(/(\d{8,})$/); if (m) return m[1]; const q = doQuadro(a); return q ? q.id : (a ? a.getAttribute('data-scroll-index') || a.id : ''); };
  const ehFoto = (a) => !!(a && ((a.querySelector('[data-e2e="anchoring-photo-control"]') && !a.querySelector('video')) || (doQuadro(a) || {}).foto));
  // comentários (nomes do código do site): a barra lateral de comentários aberta e visível
  const COMENT = '[class*="--SectionCommentSidebarContainer"],[class*="--DivCommentSidebarTransitionWrapper"],[class*="--DivSidePanelCommentPanelRoot"],[class*="--DivCommentListContainer"]';
  const comentariosAbertos = () => { for (const e of document.querySelectorAll(COMENT)) { const r = e.getBoundingClientRect(); if (r.width > 40 && r.height > 40 && getComputedStyle(e).visibility !== 'hidden') return true; } return false; };
  const digitando = () => { const a = document.activeElement; return !!a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable || a.getAttribute('role') === 'textbox'); };
  let naBarra = false;
  const onMove = (e) => { const p = e.composedPath ? e.composedPath() : []; naBarra = p.some((x) => x && x.matches && x.matches('[data-e2e="anchoring-playback-chrome"]')); };
  const onSai = (e) => { if (!e.relatedTarget) naBarra = false; }; // mouse saiu da janela
  addEventListener('pointermove', onMove, true);
  document.addEventListener('mouseout', onSai);
  const ligadoAqui = () => BRASA.ativo() && !!BRASA.S.auto && BRASA.ehTelaDeVideo();
  let trava = null, ultimoPasso = 0;
  // ── v1.0.3 · aba em segundo plano: só a última aba do TikTok que a pessoa viu continua (sem dois áudios ao mesmo tempo)
  // um código por ABA (sessionStorage é da aba): a cópia reinjetada da Brasa na mesma aba usa o mesmo, sem uma derrubar a outra
  const TOKEN = (() => { try { let t = sessionStorage.getItem('brasa-aba'); if (!t) { t = Math.random().toString(36).slice(2); sessionStorage.setItem('brasa-aba', t); } return t; } catch (_) { return Math.random().toString(36).slice(2); } })(), K_ABA = 'br.abaFundo';
  let escolhida = !document.hidden, fundoMain = null;
  const ext = BRASA.ext;
  const reclamar = () => { if (BRASA.dead) return; escolhida = true; try { ext.storage.local.set({ [K_ABA]: { token: TOKEN, em: Date.now() } }).catch(() => {}); } catch (_) {} };
  if (!document.hidden) reclamar();
  const onAba = (ch, area) => { if (!BRASA.dead && area === 'local' && ch[K_ABA] && ch[K_ABA].newValue && ch[K_ABA].newValue.token !== TOKEN) { escolhida = false; atualizarFundo(); } };
  try { ext.storage.onChanged.addListener(onAba); } catch (_) {}
  // SÓ no quadro (vídeo aberto pelo Explorar, perfil ou busca): lá a seta "próximo" troca o vídeo sem rolar a página e o Auto
  // passa com a aba escondida (medido 2026-11-12, ferramentas/medir-fundo-quadro.mjs: 5 vídeos em ~90 s). No feed a troca depende
  // da rolagem desenhada, que o navegador não faz escondida (medir-fundo-cdp.mjs): lá fingir visível só repetiria o mesmo vídeo.
  const fundoAgora = () => !BRASA.dead && BRASA.ativo() && !!BRASA.S.auto && BRASA.S.autoFundo !== false && escolhida && !!BRASA.navegador();
  // manda à página até ela confirmar (a ponte pode não responder na hora: aí tenta de novo no próximo segundo)
  function atualizarFundo() { if (BRASA.dead) return; const q = fundoAgora(); try { document.documentElement.setAttribute('data-brasa-fundo-pedido', [BRASA.ativo(), !!BRASA.S.auto, BRASA.S.autoFundo !== false, escolhida, !!BRASA.navegador()].map(Number).join('')); } catch (_) {} if (q === fundoMain) return; fundoMain = q; BRASA.bridge('fundo', q).then((r) => { if (!r || r.fundo !== q) fundoMain = null; }, () => { fundoMain = null; }); }
  const onVisib = () => { if (BRASA.dead) return; naBarra = false; if (!document.hidden) reclamar(); atualizarFundo(); };
  document.addEventListener('visibilitychange', onVisib);
  BRASA.fundo = () => document.hidden && fundoAgora(); // escondida, mas seguindo (o Curtir/Seguir também usa)
  const podeAgora = () => ligadoAqui() && (!document.hidden || fundoAgora()) && !digitando() && !naBarra && !trava && !(BRASA.menu && BRASA.menu.aberto);
  BRASA.auto = { podeAgora: () => ({ ligado: ligadoAqui(), escondida: document.hidden, comentarios: comentariosAbertos(), digitando: digitando(), naBarra, trava: !!trava }) };

  function passar(de) {
    const nv = BRASA.navegador && BRASA.navegador();
    const b = (nv && nv.prox && nv.prox.getAttribute('aria-disabled') !== 'true' && !nv.prox.disabled) ? nv.prox : document.querySelector('[data-e2e="feed-navigation-next"]');
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
    const decide = () => {
      const a = artigoDaTela();
      if (!a || a.querySelector('video') !== v || (v.paused && !v.ended) || Date.now() - ultimoPasso < 1000 || Date.now() - chegouEm < 1500) return; // recém-chegado: não é volta
      if (podeAgora()) passar(idDe(a));
    };
    // o player volta ao 0 e toca de novo em ~50 ms; se ficou parado (pausado), não é para passar. Com a aba escondida o navegador
    // segura os timers (até 1 por minuto): aí decide na hora (no "ended" o vídeo já acabou; na volta do tempo ele já está tocando)
    if (document.hidden) decide(); else setTimeout(decide, 200);
  }
  const onEnded = (e) => { const v = e.target; if (v && v.tagName === 'VIDEO' && ligadoAqui()) { const a = artigoDaTela(); if (a && a.querySelector('video') === v) volta(v); } };
  document.addEventListener('ended', onEnded, true);
  let fotoChave = null, fotoDesde = 0, telaK = null, chegouEm = 0;
  function passo() {
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
  }
  const tick = setInterval(passo, 250);
  // escondida: o relógio é o próprio vídeo ("timeupdate" segue com a aba de fundo; os timers não)
  let ultTU = 0;
  const onTU = () => { if (document.hidden && Date.now() - ultTU >= 240) { ultTU = Date.now(); passo(); } };
  document.addEventListener('timeupdate', onTU, true);
  const tFundo = setInterval(atualizarFundo, 1000);

  // ───────────────────────── botão "Auto" na barra do player ─────────────────────────
  const ICO_AUTO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 5l9 7-9 7z"/><path d="M19 5v14"/></svg>';
  function garantirBotoes() {
    if (BRASA.dead || !BRASA.acoes) return;
    if (!BRASA.ativo() || !BRASA.ehTelaDeVideo()) { BRASA.acoes.tirar('auto'); return; }
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
  const offs = [BRASA.on('settings', atualizarFundo), BRASA.on('ativo', atualizarFundo), BRASA.on('nav', () => setTimeout(atualizarFundo, 300)), BRASA.on('settings', garantirBotoes), BRASA.on('ativo', garantirBotoes), BRASA.on('lang', pintar), BRASA.on('nav', () => { trava = null; setTimeout(garantirBotoes, 300); })];
  BRASA.onStop(() => {
    clearInterval(tick); clearInterval(tBtn); clearInterval(tTT); clearInterval(tFundo); offs.forEach((f) => f());
    document.removeEventListener('timeupdate', onTU, true); document.removeEventListener('visibilitychange', onVisib); try { ext.storage.onChanged.removeListener(onAba); } catch (_) {}
    if (fundoMain) BRASA.bridge('fundo', false);
    document.documentElement.removeAttribute('data-brasa-semautott'); const stt = document.getElementById('brasa-semautott-css'); if (stt) stt.remove();
    document.removeEventListener('ended', onEnded, true); removeEventListener('pointermove', onMove, true); document.removeEventListener('mouseout', onSai);
    if (BRASA.acoes) BRASA.acoes.tirar('auto');
  });
})();
