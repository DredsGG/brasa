// Brasa — v0.6.2 · comentários abertos (ligado de fábrica, pedido do André): ao entrar num feed (Para você; desde a v0.6.5
// também Seguindo e Amigos) com o vídeo na tela, abre o painel de comentários pelo próprio botão "comentar" do TikTok e o
// mantém aberto. Se a PESSOA fechar, fica fechado até ela trocar de página e voltar a um feed (ou religar a opção).
// Medido ao vivo em 2026-11-11 (ferramentas/medir-comentarios.mjs, sem login): o botão é [data-e2e="comment-icon"]
// (div --ButtonActionItemV1); abrir troca a URL para /@perfil/video/<id> sem sair do feed (o core trata como Para você);
// o painel --DivCommentSidebarTransitionWrapper (384 px à direita) empurra o vídeo e as setas para a esquerda e fica aberto
// ao passar de vídeo (a URL acompanha); clicar de novo no ícone fecha e a URL volta a /foryou.
(() => {
  'use strict';
  const M = globalThis.BRASA_MENU;
  if (!M) return;
  const ICO_C = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>';
  M.addSecao({ id: 'coment', ordem: 35, html: (T, ctx) => M.cartao(ctx, 'coment', ICO_C, T['set.coment'], T.featComent_, '') });

  const BRASA = globalThis.BRASA;
  if (!BRASA || BRASA.dead) return;
  const PAINEL = '[class*="--DivCommentSidebarTransitionWrapper"],[class*="--SectionCommentSidebarContainer"],[class*="--DivSidePanelCommentPanelRoot"]';
  // aberto = um desses NA TELA (o site pode deixar um contêiner parecido montado fora da tela ou para outro painel)
  const painelAberto = () => { for (const e of document.querySelectorAll(PAINEL)) { const r = e.getBoundingClientRect(); if (r.width > 100 && r.height > 100 && r.left < innerWidth - 50 && r.right > 50 && r.top < innerHeight && r.bottom > 0 && getComputedStyle(e).visibility !== 'hidden') return true; } return false; };
  function artigoDaTela() {
    const cy = innerHeight / 2;
    for (const a of document.querySelectorAll('[data-e2e="recommend-list-item-container"]')) { const r = a.getBoundingClientRect(); if (r.top <= cy && r.bottom >= cy) return a; }
    // v0.6.5: se um feed (ex.: Amigos, não medido com conta) vier sem esse contêiner, usa o bloco do vídeo que está no meio da tela
    for (const v of document.querySelectorAll('video')) {
      const r = v.getBoundingClientRect();
      if (r.width < 150 || r.height < 150 || r.top > cy || r.bottom < cy || r.right < 0 || r.left > innerWidth) continue;
      let a = v.parentElement;
      for (let i = 0; i < 6 && a && a.parentElement && !a.querySelector('[data-e2e="comment-icon"]'); i++) a = a.parentElement;
      return a && a.querySelector('[data-e2e="comment-icon"]') ? a : v.parentElement;
    }
    return null;
  }
  // Mantém o painel aberto nos feeds. Só respeita quando a PESSOA fecha (clique de verdade no ícone de comentar ou num
  // botão de fechar do painel, ou Esc com ele aberto): aí fica fechado até ela trocar de página e voltar a um feed. Se o próprio site
  // fechar (ex.: clicar em "Para você" na barra recarrega o feed), abre de novo. No máximo 3 tentativas por vídeo.
  let pessoaFechou = false, desde = 0, tentativas = 0, ultima = 0, chaveTent = null;
  const zerar = () => { pessoaFechou = false; desde = 0; tentativas = 0; ultima = 0; };
  const FECHAR = /fechar|close|cerrar|exit|sair|salir/i; // X do painel medido: <button aria-label="exit"> no alto à direita
  const onClique = (e) => {
    if (!e.isTrusted || !painelAberto()) return;
    const t = e.target && e.target.closest ? e.target : null;
    if (!t) return;
    const noIcone = t.closest('[data-e2e="comment-icon"]');
    const fecharDoPainel = t.closest(PAINEL) && t.closest('button,[role=button]') && FECHAR.test((t.closest('button,[role=button]').getAttribute('aria-label') || '') + ' ' + (t.closest('button,[role=button]').getAttribute('data-e2e') || ''));
    if (noIcone || fecharDoPainel) pessoaFechou = true;
  };
  const onTecla = (e) => { if (e.isTrusted && e.key === 'Escape' && painelAberto()) pessoaFechou = true; };
  document.addEventListener('click', onClique, true);
  document.addEventListener('keydown', onTecla, true);
  const iconeNaTela = () => {
    const cy = innerHeight / 2;
    return [...document.querySelectorAll('[data-e2e="comment-icon"]')].map((e) => [e, e.getBoundingClientRect()])
      .filter(([, r]) => r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth)
      .sort((x, y) => Math.abs(x[1].top - cy) - Math.abs(y[1].top - cy)).map(([e]) => e)[0] || null;
  };
  // por que não abriu (diagnóstico, sem dado nenhum): fica no <html data-brasa-coment> para o "Relatar bug" e os testes
  let ultimoPorque = '';
  const porque = (x) => { if (x !== ultimoPorque) { ultimoPorque = x; try { document.documentElement.setAttribute('data-brasa-coment', x); } catch (_) {} } };
  const tick = setInterval(() => {
    if (BRASA.dead) return;
    if (pessoaFechou) return porque('pessoa-fechou');
    if (!BRASA.ativo() || !BRASA.S.coment) return porque('desligado');
    if (!BRASA.ehFeed()) return porque('pagina-' + BRASA.page.kind);
    if (document.hidden) return porque('aba-escondida');
    if (BRASA.menu && BRASA.menu.aberto) return porque('menu-aberto');
    if (painelAberto()) { tentativas = 0; desde = 0; return porque('aberto'); }
    const a = artigoDaTela();
    // até 3 tentativas por vídeo: se o site não deixou abrir (ex.: redesenhando o feed), tenta de novo no próximo vídeo
    const chave = a && (a.querySelector('[id^="xgwrapper-"]') || a).id;
    if (chave !== chaveTent) { chaveTent = chave; tentativas = 0; }
    if (tentativas >= 3) return porque('desistiu');
    // o botão de comentar costuma ficar dentro do vídeo; num layout medido ao vivo ele fica numa coluna única fora dele
    const ci = a && (a.querySelector('[data-e2e="comment-icon"]') || iconeNaTela());
    if (!a) { desde = 0; return porque('sem-video-no-meio'); }
    if (!ci || !a.querySelector('video,img')) { desde = 0; return porque(!ci ? 'sem-icone' : 'montando'); } // vídeo ainda montando
    if (!desde) desde = Date.now();
    if (Date.now() - desde < 1000 || Date.now() - ultima < 2500) return porque('esperando');
    tentativas++; ultima = Date.now();
    porque('clicou-' + tentativas);
    if (tentativas === 3) BRASA.log('coment', ['3 tentativas']);
    (ci.closest('button') || ci).click();
  }, 400);
  const offs = [
    BRASA.on('nav', (d) => { if (d.mudouTipo) { zerar(); chaveTent = null; } }), // trocou de página (ex.: Para você → Seguindo): abre de novo
    BRASA.on('settings', (m) => { if (m.coment === true) zerar(); }),
  ];
  BRASA.onStop(() => { clearInterval(tick); offs.forEach((f) => f()); document.removeEventListener('click', onClique, true); document.removeEventListener('keydown', onTecla, true); });
})();
