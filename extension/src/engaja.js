// Brasa — v0.6.5 · Auto curtir e Auto seguir (pedido do André; DESLIGADOS de fábrica, cada um com a sua chave).
// Em cada vídeo que entra na tela de um feed (Para você, Seguindo, Amigos), inclusive pelo Auto, depois de 2 s:
//  - curtir: clica no coração do próprio TikTok SÓ se ele diz que ainda não está curtido;
//  - seguir: clica no "Seguir" do próprio TikTok SÓ se você ainda não segue quem postou.
// Nunca desfaz nada: clicar de novo no coração ou no "Seguindo" DESFAZ, então a Brasa só clica quando as DUAS fontes dizem
// "ainda não": a página (coração aria-pressed="false", o mesmo que o código do site lê; botão "Seguir" com o rótulo de seguir)
// e a resposta do feed (digged === true → curtido; author.relation 0 = não segue, 1 = segue, 2 = amigos, -1 = não sabe).
// Na dúvida (sem dado, rótulo desconhecido, outro idioma), não clica. Também não age em anúncio, LIVE, sem conta, aba
// escondida ou com o menu aberto. Ritmo e teto por dia para o TikTok não travar a conta: curtir 1 a cada 3 s e até 500 por
// dia; seguir 1 a cada 20 s e até 150 por dia.
// Medido (código do site e DOM sem login, 2026-11-12): coração = [data-e2e="like-icon"] (div role=button, aria-pressed);
// seguir = button[data-e2e="cinema-video-info-follow"] (aria-label "Seguir"; quem já segue: o site esconde o botão ou mostra
// "Seguindo"/"Amigos"). ⚠️ Não medido com conta (seria preciso curtir/seguir de verdade): provado no TikTok simulado.
(() => {
  'use strict';
  const M = globalThis.BRASA_MENU, C = globalThis.BRASA_COMUM, DEF = globalThis.BRASA_DEF;
  if (!M || !C || !DEF) return;
  const { esc } = C;
  const K_ENG = 'br.engaja'; // { dia, curtidas, seguidos, ids: [vídeos curtidos hoje], autores: [seguidos hoje] }
  const TETO = { curtir: 500, seguir: 150 }, RITMO = { curtir: 3000, seguir: 20000 }, ESPERA = 2000;
  const ICO_CURTIR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';
  const ICO_SEGUIR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M19 8v6M16 11h6"/></svg>';

  let cont = null;
  const ler = () => { try { globalThis.chrome.storage.local.get(K_ENG).then((l) => { cont = l[K_ENG] || null; }, () => {}); } catch (_) {} };
  ler();
  try { globalThis.chrome.storage.onChanged.addListener((ch, area) => { if (area === 'local' && ch[K_ENG]) cont = ch[K_ENG].newValue || null; }); } catch (_) {}
  const hoje = () => (cont && cont.dia === DEF.hoje() ? cont : { dia: DEF.hoje(), curtidas: 0, seguidos: 0, ids: [], autores: [] });

  M.addSecao({ id: 'curtir', ordem: 32, html: (T, ctx) => M.cartao(ctx, 'autoCurtir', ICO_CURTIR, T['set.autoCurtir'], T.featCurtir_,
    `<div class="cont">${esc(T.engHoje(hoje().curtidas, TETO.curtir))}</div>`) });
  M.addSecao({ id: 'seguir', ordem: 33, html: (T, ctx) => M.cartao(ctx, 'autoSeguir', ICO_SEGUIR, T['set.autoSeguir'], T.featSeguir_,
    `<div class="cont">${esc(T.engHoje(hoje().seguidos, TETO.seguir))}</div>`) });

  const BRASA = globalThis.BRASA;
  if (!BRASA || BRASA.dead || !BRASA.acoes) return;
  const ext = BRASA.ext, L = () => BRASA.L();

  // ───────────────────────── leitura da tela ─────────────────────────
  const logado = () => (BRASA.conta ? BRASA.conta.logado() : !document.querySelector('#header-login-button'));
  function artigoDaTela() {
    const cy = innerHeight / 2;
    for (const a of document.querySelectorAll('[data-e2e="recommend-list-item-container"]')) { const r = a.getBoundingClientRect(); if (r.top <= cy && r.bottom >= cy) return a; }
    return null;
  }
  const idDe = (a) => { const w = a && a.querySelector('[id^="xgwrapper-"]'); const m = w && w.id.match(/(\d{8,})$/); return m ? m[1] : ''; };
  const ehPropaganda = (a) => !!a.querySelector('[data-e2e="sponsored-tag"],[data-e2e="ad-tag"],[data-e2e="ttam-ads-cta"],[data-e2e="anchoring-live-frame"],[class*="--DivRecommendLivePlayer"]');
  const visivel = (e) => { if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
  // rótulo de "Seguir" (quem ainda não segue) nos idiomas do TikTok mais usados aqui; qualquer outro rótulo = não clica
  const SEGUIR_RE = /^(seguir|seguir de volta|follow|follow back|seguir también|suivre|folgen|segui)$/i;
  const coracao = (a) => a.querySelector('[data-e2e="like-icon"]');
  const botaoSeguir = (a) => [...a.querySelectorAll('[data-e2e="cinema-video-info-follow"]')].find(visivel) || null;

  // ───────────────────────── contagem do dia ─────────────────────────
  let fila = Promise.resolve();
  function somar(tipo, chave) {
    fila = fila.then(async () => {
      try {
        let c = (await ext.storage.local.get(K_ENG))[K_ENG];
        if (!c || c.dia !== DEF.hoje()) c = { dia: DEF.hoje(), curtidas: 0, seguidos: 0, ids: [], autores: [] };
        if (tipo === 'curtir') { c.curtidas++; c.ids = c.ids.concat(chave).slice(-TETO.curtir); }
        else { c.seguidos++; c.autores = c.autores.concat(chave).slice(-TETO.seguir); }
        cont = c;
        await ext.storage.local.set({ [K_ENG]: c });
      } catch (_) {}
    });
    return fila;
  }

  // ───────────────────────── o laço ─────────────────────────
  let tela = '', chegou = 0, feito = { curtir: false, seguir: false }, ocupado = false;
  const ultimo = { curtir: 0, seguir: 0 }, avisouTeto = { curtir: '', seguir: '' };
  let ultimoPorque = '';
  const porque = (x) => { if (x !== ultimoPorque) { ultimoPorque = x; try { document.documentElement.setAttribute('data-brasa-engaja', x); } catch (_) {} } };
  const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
  const esperar = async (f, ms) => { const fim = Date.now() + ms; while (Date.now() < fim) { if (f()) return true; await pausa(150); } return !!f(); };

  function noTeto(tipo) {
    const h = hoje(), n = tipo === 'curtir' ? h.curtidas : h.seguidos;
    if (n < TETO[tipo]) return false;
    if (avisouTeto[tipo] !== h.dia) { avisouTeto[tipo] = h.dia; BRASA.toast(tipo === 'curtir' ? L().engTetoCurtir(TETO.curtir) : L().engTetoSeguir(TETO.seguir), 7000); BRASA.log('engaja', ['teto', tipo]); }
    return true;
  }

  async function curtir(a, id, dado) {
    feito.curtir = true;
    const h = hoje();
    if (h.ids.includes(id)) return porque('curtir-ja-feito');
    if (dado && dado.curtido === true) return porque('curtir-ja-curtido-api');
    const li = coracao(a);
    if (!li) return porque('curtir-sem-coracao');
    if (li.getAttribute('aria-pressed') !== 'false') return porque('curtir-ja-curtido'); // "true" ou sem estado: não mexe
    if (noTeto('curtir')) return porque('curtir-teto');
    ultimo.curtir = Date.now();
    li.click();
    const ok = await esperar(() => li.getAttribute('aria-pressed') === 'true', 2500);
    if (ok) { await somar('curtir', id); porque('curtiu'); BRASA.log('engaja', ['curtiu']); }
    else { porque('curtir-nao-pegou'); BRASA.log('engaja', ['curtirFalhou'], false); }
  }

  async function seguir(a, id, dado) {
    const autor = dado && dado.autor && dado.autor.uniqueId;
    if (!dado || dado.relacao === null || !autor) { feito.seguir = true; return porque('seguir-sem-dado'); }
    if (dado.relacao !== 0) { feito.seguir = true; return porque('seguir-ja-segue'); }
    if (hoje().autores.includes(autor)) { feito.seguir = true; return porque('seguir-ja-feito'); }
    const b = botaoSeguir(a);
    if (!b) { feito.seguir = true; return porque('seguir-sem-botao'); } // o site esconde o botão de quem você já segue
    const rot = (b.getAttribute('aria-label') || b.textContent || '').trim();
    if (!SEGUIR_RE.test(rot)) { feito.seguir = true; return porque('seguir-rotulo-' + (rot ? 'outro' : 'vazio')); }
    if (noTeto('seguir')) { feito.seguir = true; return porque('seguir-teto'); }
    if (Date.now() - ultimo.seguir < RITMO.seguir) return porque('seguir-ritmo'); // tenta de novo enquanto o vídeo estiver na tela
    feito.seguir = true;
    ultimo.seguir = Date.now();
    b.click();
    const ok = await esperar(() => !b.isConnected || !visivel(b) || !SEGUIR_RE.test((b.getAttribute('aria-label') || b.textContent || '').trim()), 3000);
    if (ok) { await somar('seguir', autor); porque('seguiu'); BRASA.log('engaja', ['seguiu']); }
    else { porque('seguir-nao-pegou'); BRASA.log('engaja', ['seguirFalhou'], false); }
  }

  async function passo() {
    if (BRASA.dead || ocupado) return;
    const S = BRASA.S;
    if (!S.autoCurtir && !S.autoSeguir) return porque('desligado');
    if (!BRASA.ativo() || !BRASA.ehFeed()) return porque('pagina-' + BRASA.page.kind);
    if (document.hidden) return porque('aba-escondida');
    if (BRASA.menu && BRASA.menu.aberto) return porque('menu-aberto');
    if (!logado()) return porque('sem-conta');
    const a = artigoDaTela(), id = idDe(a);
    if (!a || !id) { tela = ''; return porque('sem-video'); }
    if (id !== tela) { tela = id; chegou = Date.now(); feito = { curtir: false, seguir: false }; }
    if (Date.now() - chegou < ESPERA) return porque('esperando');
    if (ehPropaganda(a)) { feito = { curtir: true, seguir: true }; return porque('propaganda'); }
    const quer = { curtir: S.autoCurtir && !feito.curtir && Date.now() - ultimo.curtir >= RITMO.curtir, seguir: S.autoSeguir && !feito.seguir };
    if (!quer.curtir && !quer.seguir) return;
    ocupado = true;
    try {
      const dado = await BRASA.bridge('item', id);
      if (artigoDaTela() !== a) return; // passou de vídeo enquanto lia
      if (quer.curtir) await curtir(a, id, dado);
      if (quer.seguir && artigoDaTela() === a) await seguir(a, id, dado);
    } finally { ocupado = false; }
  }
  const tick = setInterval(() => { passo().catch(() => { ocupado = false; }); }, 500);

  // ───────────────────────── botões "Curtir" e "Seguir" no bloco da Brasa (= as chaves do menu) ─────────────────────────
  const BOTOES = [['curtir', 30, 'autoCurtir', ICO_CURTIR, 'acaoCurtir', 'curtirLigado', 'curtirDesligado'], ['seguir', 40, 'autoSeguir', ICO_SEGUIR, 'acaoSeguir', 'seguirLigado', 'seguirDesligado']];
  function garantirBotoes() {
    if (BRASA.dead) return;
    const T = L();
    for (const [chave, ordem, aj, ico, rot] of BOTOES) {
      if (!BRASA.ativo() || !BRASA.ehFeed()) { BRASA.acoes.tirar(chave); continue; }
      BRASA.acoes.item(chave, ordem, T[rot], () => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'brasa-' + chave; b.innerHTML = ico;
        b.addEventListener('click', async (e) => { e.preventDefault(); e.stopPropagation(); const novo = !BRASA.S[aj]; await BRASA.setAj(aj, novo); BRASA.log('chave', [L()['set.' + aj], novo]); pintar(); if (novo) BRASA.toast(chave === 'curtir' ? L().curtirAviso : L().seguirAviso, 6000); });
        return b;
      });
    }
    pintar();
  }
  function pintar() {
    const T = L();
    for (const [chave, , aj, , , lig, des] of BOTOES) {
      const on = !!BRASA.S[aj];
      for (const b of document.querySelectorAll('.brasa-' + chave)) {
        if (b.getAttribute('aria-pressed') !== String(on)) b.setAttribute('aria-pressed', String(on));
        const t = on ? T[lig] : T[des]; if (b.title !== t) { b.title = t; b.setAttribute('aria-label', t); }
      }
    }
  }
  const tBtn = setInterval(garantirBotoes, 800);
  const offs = [BRASA.on('settings', garantirBotoes), BRASA.on('ativo', garantirBotoes), BRASA.on('lang', pintar), BRASA.on('nav', () => setTimeout(garantirBotoes, 300))];
  BRASA.onStop(() => { clearInterval(tick); clearInterval(tBtn); offs.forEach((f) => f()); for (const [chave] of BOTOES) BRASA.acoes.tirar(chave); });
})();
