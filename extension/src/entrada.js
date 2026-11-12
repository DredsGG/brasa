// Brasa — v1.0.1 · "Abrir sempre no Para você" (ligado de fábrica). Relato do André (2026-11-12): abrindo o TikTok direto, caía
// num vídeo solto com as abas "Comentários | Você pode gostar" abertas em "Você pode gostar", sem nenhum item da barra marcado.
// Medido (ferramentas/medir-entrada.mjs e medir-video-abas.mjs, sem login): esse é o layout da PÁGINA DE UM VÍDEO
// (/@x/video/id): abas = button[data-testid="tux-web-tab-bar"] dentro de [data-testid="tux-web-tab-bar-container"], sem
// aria-selected; painel "Você pode gostar" = --DivRelatedTabContainer, "Comentários" = --DivTabContainer > --DivCommentMain;
// vídeos da /api/related/item_list/. O "Para você" do próprio site leva ao feed normal em "/" sem recarregar.
// Por que a entrada direta cai lá (com conta; sem conta "/" abre o feed normal): a aba volta numa URL /@x/video/id — desde a
// v0.6.2 a URL do feed com os comentários abertos é a do vídeo, e é ela que o navegador reabre — ou o site leva a entrada para
// um vídeo. As duas coisas se resolvem aqui, SÓ na primeira carga da aba (nunca na reinjeção, nunca em Voltar/Avançar):
//  (a) a aba entrou por "/" ou "/foryou" e o site mostrou a página de um vídeo;
//  (b) a aba entrou por /@x/video/id de um vídeo que a Brasa viu NO FEED (com os comentários abertos) nos últimos 14 dias.
// Nos dois casos, com o layout "Comentários | Você pode gostar" na tela, a Brasa clica uma vez no "Para você" do site (sem laço:
// se não pegar, não tenta de novo). Link de vídeo colado/compartilhado (que a Brasa nunca viu no feed) fica onde está; lá o
// "Comentários abertos" (comentarios.js) só troca a aba da direita para Comentários.
(() => {
  'use strict';
  const M = globalThis.BRASA_MENU;
  if (!M) return;
  const ICO_PV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>';
  M.addSecao({ id: 'paraVoce', ordem: 36, html: (T, ctx) => M.cartao(ctx, 'paraVoce', ICO_PV, T['set.paraVoce'], T.featParaVoce_, '') });

  const BRASA = globalThis.BRASA;
  if (!BRASA || BRASA.dead) return;
  const ext = BRASA.ext, K = BRASA.DEF.K.urlsFeed;
  const DIAS = 14, MAX = 300;
  const idDaUrl = (p) => (String(p || '').match(/^\/@[^/]+\/(?:video|photo)\/(\d+)/) || [])[1] || null;
  const visivel = (e) => { if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden'; };

  // as abas "Comentários | Você pode gostar" da página de um vídeo (também usadas pelo comentarios.js)
  // medido ao vivo: CADA botão fica no seu próprio [data-testid="tux-web-tab-bar-container"], e o bloco que envolve os dois TAMBÉM
  // tem data-testid="tux-web-tab-bar" (por isso só <button>); os dois ficam lado a lado, na direita
  function abasVideo() {
    const rel = document.querySelector('[class*="--DivRelatedTabContainer"]'), com = document.querySelector('[class*="--DivCommentMain"],[class*="--DivCommentListContainer"]');
    if (!rel && !com) return null; // abas de outra coisa (ex.: perfil)
    const bs = [...document.querySelectorAll('button[data-testid="tux-web-tab-bar"]')].filter((b) => visivel(b) && b.getBoundingClientRect().left > innerWidth * 0.4);
    const topo = bs.length && bs[0].getBoundingClientRect().top;
    const par = bs.filter((b) => Math.abs(b.getBoundingClientRect().top - topo) < 6);
    if (par.length !== 2) return null;
    const coment = par.find((b) => /coment|comment/i.test(b.textContent || '')) || par[0];
    return { coment, rel: par.find((b) => b !== coment), ativa: visivel(com) ? 'coment' : visivel(rel) ? 'rel' : null };
  }
  BRASA.abasVideo = abasVideo;
  BRASA.idDaUrl = idDaUrl;

  // ── memória: vídeos cuja URL a Brasa viu no feed (comentários abertos trocam a URL do feed para a do vídeo)
  let pend = {}, tGrava = 0;
  function lembrar() {
    if (BRASA.dead || !BRASA.ehFeed()) return;
    const id = idDaUrl(location.pathname); if (!id) return;
    pend[id] = Date.now(); clearTimeout(tGrava); tGrava = setTimeout(gravar, 1500);
  }
  async function gravar() {
    const novos = pend; pend = {};
    try {
      const m = Object.assign({}, (await ext.storage.local.get(K))[K] || {}, novos);
      await ext.storage.local.set({ [K]: Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, MAX)) });
    } catch (_) {}
  }

  // ── a decisão, só na primeira carga da aba
  const ent = BRASA.entrada || { caminho: location.pathname, tipo: '', em: Date.now() };
  // reinjeção (a Brasa recarregou numa aba já aberta) ou Voltar/Avançar: não é entrada direta
  const primeiraCarga = performance.now() < 15000 && ent.tipo !== 'back_forward';
  const raiz = ent.caminho === '/' || ent.caminho.startsWith('/foryou');
  const idEnt = idDaUrl(ent.caminho);
  let fim = !primeiraCarga || (!raiz && !idEnt), lembrada = null, mexeu = false;
  let ultimoPorque = '';
  const porque = (x) => { if (x !== ultimoPorque) { ultimoPorque = x; try { document.documentElement.setAttribute('data-brasa-entrada', x); } catch (_) {} } };
  porque(fim ? (primeiraCarga ? 'nao-e-entrada' : 'nao-e-primeira-carga') : 'olhando');
  if (idEnt && !fim) ext.storage.local.get(K).then((l) => { const t = (l[K] || {})[idEnt]; lembrada = !!(t && Date.now() - t < DIAS * 864e5); }, () => { lembrada = false; });
  // a pessoa já começou a usar a página: não mexe
  const usou = (e) => { if (e.isTrusted && !fim) { mexeu = true; } };
  addEventListener('pointerdown', usou, true); addEventListener('keydown', usou, true); addEventListener('wheel', usou, { capture: true, passive: true });

  function decidir() {
    if (fim || BRASA.dead) return;
    if (Date.now() - ent.em > 20000) { fim = true; return porque('passou-o-tempo'); }
    if (mexeu) { fim = true; return porque('pessoa-usando'); }
    if (!BRASA.ativo() || !BRASA.S.paraVoce) return porque('desligado');
    if (location.pathname.startsWith('/messages')) { fim = true; return porque('mensagens'); }
    const av = abasVideo();
    if (!av) return porque('sem-pagina-de-video');
    let motivo = null;
    if (raiz) motivo = 'raiz';
    else if (idEnt) { if (lembrada === null) return porque('lendo-memoria'); if (lembrada) motivo = 'lembrada'; }
    if (!motivo) { fim = true; return porque('link-de-video'); } // link aberto de propósito: fica
    const pv = document.querySelector('[data-e2e="nav-foryou"]');
    if (!pv) return porque('sem-para-voce');
    fim = true;
    porque('foi-para-voce-' + motivo);
    (pv.closest('a,button') || pv).click();
    BRASA.log('entrada', [motivo]);
    BRASA.toast(BRASA.L().paraVoceFeito, 4000);
  }
  const tick = setInterval(() => { if (fim) { clearInterval(tick); return; } decidir(); }, 400);
  const offs = [BRASA.on('nav', lembrar)];
  const tLembra = setInterval(lembrar, 3000); // a URL acompanha o vídeo da tela também por replaceState
  BRASA.onStop(() => { clearInterval(tick); clearInterval(tLembra); clearTimeout(tGrava); offs.forEach((f) => f()); removeEventListener('pointerdown', usou, true); removeEventListener('keydown', usou, true); removeEventListener('wheel', usou, { capture: true }); });
})();
