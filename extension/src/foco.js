// Brasa — fase 1 · modo foco (ligado de fábrica).
//  1. Feed (Para você e Seguindo) sem anúncio, LIVE e loja: quem tira é o page.js, na resposta da API, antes de o site desenhar.
//  2. Plano B: se um desses chegar à tela (outra rota, ajuste atrasado, TikTok mudou o campo), pula sozinho para o próximo
//     pelo botão nativo "Ir para o próximo vídeo", em menos de 1 s, uma vez por vídeo.
//  3. Banners e janelas de LIVE/loja na página somem por CSS. A barra lateral NÃO é mexida (v0.6.4: tudo clicável).
// Desligar devolve os banners na hora (é só um atributo no <html>); o feed volta a vir completo a partir da próxima
// leva que o TikTok baixar (o que já foi tirado da tela só volta recarregando). O mesmo arquivo registra a seção do menu,
// que aparece também no popup. Seletores medidos em 2026-11-11: Jarvis/02-projetos/extensoes/role/brasa-engenharia-reversa.md
(() => {
  'use strict';
  const M = globalThis.BRASA_MENU, C = globalThis.BRASA_COMUM, DEF = globalThis.BRASA_DEF;
  if (!M || !C || !DEF) return;
  const { esc } = C;

  // ───────────────────────── seção do menu (página e popup) ─────────────────────────
  let cont = null; // contador do dia, lido do storage
  const lerCont = () => { try { globalThis.chrome.storage.local.get(DEF.K.contador).then((l) => { cont = l[DEF.K.contador] || null; }, () => {}); } catch (_) {} };
  lerCont();
  const onCont = (ch, area) => { if (area === 'local' && ch[DEF.K.contador]) cont = ch[DEF.K.contador].newValue || null; };
  try { globalThis.chrome.storage.onChanged.addListener(onCont); } catch (_) {}
  const contHoje = () => (cont && cont.dia === DEF.hoje() ? cont : { anuncio: 0, live: 0, loja: 0 });
  const ICO_FOCO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16l-6 7.5V19l-4 2v-8.5z"/></svg>';
  M.addSecao({
    id: 'foco', ordem: 10,
    html(T, ctx) {
      const c = contHoje();
      return M.cartao(ctx, 'foco', ICO_FOCO, T['set.foco'], T.featFoco_, `<div class="cont" data-cont="1">${T.focoHoje(c.anuncio, c.live, c.loja)}</div>
        ${M.grupo(T.grpFeed, M.chip(T, ctx, 'focoAnuncio') + M.chip(T, ctx, 'focoLive') + M.chip(T, ctx, 'focoLoja'))}
        ${M.grupo(T.grpPagina, M.chip(T, ctx, 'escBanners'))}`);
    },
  });

  // ───────────────────────── na página do TikTok ─────────────────────────
  const BRASA = globalThis.BRASA;
  if (!BRASA || BRASA.dead) return;
  const ext = BRASA.ext;

  // CSS na página (fora do shadow root: esconde elementos do próprio TikTok). Só vale com o atributo no <html>.
  // v0.6.4 (pedido do André): a barra lateral fica INTEIRA e clicável (Explorar, LIVE, Loja, Amigos, Carregar, Mais…).
  // O modo foco só tira do feed e esconde os banners de LIVE/loja que aparecem por cima da página.
  // Banners (nomes medidos no código do site: janela flutuante de LIVE, entrada "go live", âncora de evento de LIVE,
  // botão de compra de anúncio). ⚠️ Inferido: não vi esses elementos desenhados sem login.
  const BANNERS = ['[class*="--DivLiveFloatWrapper"]', '[class*="--DivGoLiveEntranceContainer"]', '[data-e2e="live-event-anchor"]', '[class*="--DivAnchoringTTAMAdsCTA"]', '[class*="--DivPromotionContainer"]'];
  const CSS = `html[data-brasa-esc~="banners"] :is(${BANNERS.join(',')}) { display: none !important; }`;
  const ST_ID = 'brasa-foco-css';
  function garantirCss() {
    let st = document.getElementById(ST_ID);
    if (st && st.isConnected) { if (st.textContent !== CSS) st.textContent = CSS; return; }
    st = document.createElement('style'); st.id = ST_ID; st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }
  function aplicar() {
    if (BRASA.dead) return;
    const S = BRASA.S, on = BRASA.ativo() && S.foco;
    const g = on ? [S.escBanners && 'banners'].filter(Boolean) : [];
    const html = document.documentElement;
    if (g.length) { garantirCss(); if (html.getAttribute('data-brasa-esc') !== g.join(' ')) html.setAttribute('data-brasa-esc', g.join(' ')); }
    else html.removeAttribute('data-brasa-esc');
  }
  aplicar();
  const offs = [BRASA.on('settings', aplicar), BRASA.on('ativo', aplicar), BRASA.on('ready', aplicar),
    BRASA.on('settings', () => { if (BRASA.menu) BRASA.menu.redesenhar(); })];
  // o <head> só existe depois: garante o <style> quando a página termina de montar e na navegação interna
  const tCss = setInterval(() => { if (document.documentElement.hasAttribute('data-brasa-esc')) garantirCss(); }, 1000);

  // ───────────────────────── plano B: pular o que escapou do filtro ─────────────────────────
  // Marcadores no DOM (nomes do código do site, 2026-11-11): anúncio = sponsored-tag / ad-tag / ttam-ads-cta;
  // LIVE = anchoring-live-frame / DivRecommendLivePlayer. Loja só pela memória do page.js (id → item).
  const TIPO_DOM = [
    ['anuncio', '[data-e2e="sponsored-tag"],[data-e2e="ad-tag"],[data-e2e="ttam-ads-cta"]'],
    ['live', '[data-e2e="anchoring-live-frame"],[class*="--DivRecommendLivePlayer"]'],
  ];
  const CHAVE = { anuncio: 'focoAnuncio', live: 'focoLive', loja: 'focoLoja' };
  function artigoDaTela() {
    const cy = innerHeight / 2;
    let melhor = null, area = 0;
    for (const a of document.querySelectorAll('[data-e2e="recommend-list-item-container"]')) {
      const r = a.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;
      const vis = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
      if (r.top <= cy && r.bottom >= cy) return a;
      if (vis > area) { area = vis; melhor = a; }
    }
    return melhor;
  }
  const idDe = (a) => { const w = a && a.querySelector('[id^="xgwrapper-"]'); const m = w && w.id.match(/(\d{8,})$/); return m ? m[1] : (a && a.id) || ''; };
  let ultimo = '', ocupado = false;
  async function conferir() {
    if (ocupado || BRASA.dead || document.hidden) return;
    const S = BRASA.S;
    if (!BRASA.ativo() || !S.foco || !BRASA.ehFeed()) return;
    const a = artigoDaTela();
    if (!a) return;
    const id = idDe(a);
    if (!id || id === ultimo) return;
    ocupado = true;
    try {
      let tipo = null;
      for (const [t, sel] of TIPO_DOM) if (a.querySelector(sel)) { tipo = t; break; }
      if (!tipo && /^\d+$/.test(id)) tipo = await BRASA.bridge('tipo', id);
      if (idDe(artigoDaTela()) !== id) return; // a pessoa já rolou
      ultimo = id;
      if (!tipo || !S[CHAVE[tipo]]) return;
      const prox = document.querySelector('[data-e2e="feed-navigation-next"]');
      if (prox) prox.click();
      else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, bubbles: true }));
      DEF.contar([{ id, tipo }]);
      BRASA.emit('pulado', { id, tipo });
    } finally { ocupado = false; }
  }
  const tPula = setInterval(conferir, 300);
  offs.push(BRASA.on('nav', () => { ultimo = ''; }));

  BRASA.foco = { aplicar, conferir, CSS };
  BRASA.onStop(() => {
    offs.forEach((f) => f()); clearInterval(tCss); clearInterval(tPula);
    try { globalThis.chrome.storage.onChanged.removeListener(onCont); } catch (_) {}
    document.documentElement.removeAttribute('data-brasa-esc');
    const st = document.getElementById(ST_ID); if (st) st.remove();
  });
})();
