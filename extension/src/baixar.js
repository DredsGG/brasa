// Brasa — fase 3 · baixar vídeo com som (desligado de fábrica).
// Botão na barra do player do TikTok e atalho D: baixa o vídeo da tela com som e SEM marca d'água, mais a capa; carrossel de fotos
// baixa as fotos. Tudo sai das respostas que o próprio TikTok já carregou (page.js guarda em memória); nenhum serviço de terceiro.
// Medido em 2026-11-11 (Jarvis/02-projetos/extensoes/role/brasa-engenharia-reversa.md, seção Vídeo):
//   playAddr (H.264) e bitrateInfo[] (até 1080p, HEVC e H.264) vêm sem marca d'água e com som AAC; downloadAddr tem a marca.
//   O CDN de vídeo só entrega com o Referer do site (de fora: 403) → o arquivo é buscado AQUI, na aba (mesma origem e Referer
//   do TikTok), e entregue ao fundo para salvar em Downloads/<pasta>/<autor>/. Fotos e capa o fundo baixa direto.
(() => {
  'use strict';
  const M = globalThis.BRASA_MENU, C = globalThis.BRASA_COMUM, DEF = globalThis.BRASA_DEF;
  if (!M || !C || !DEF) return;
  const { esc } = C;
  const ext = globalThis.chrome;

  // ───────────────────────── seção do menu (página e popup) ─────────────────────────
  const ICO_B = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/></svg>';
  M.addSecao({
    id: 'baixar', ordem: 20,
    html(T, ctx) {
      return M.cartao(ctx, 'baixar', ICO_B, T['set.baixar'], T.featBaixar_, `${M.grupo(T.grpJunto, M.chip(T, ctx, 'baixarCapa') + M.chip(T, ctx, 'baixarHevc'))}
        <div class="cg campo"><span>${esc(T.baixarPastaRot)}</span><input type="text" data-baixar="pasta" value="${esc(ctx.S.baixarPasta || 'Brasa')}" maxlength="40" spellcheck="false" aria-label="${esc(T['set.baixarPasta'])}" style="width:120px"></div>
        ${ctx.S.baixarHevc ? `<p class="dica" style="margin:6px 0 0">${esc(T.baixarHevcDica)}</p>` : ''}`);
    },
    wire(el, ctx) {
      const i = el.querySelector('[data-baixar="pasta"]');
      if (i) i.addEventListener('change', () => { const v = limparPasta(i.value) || 'Brasa'; i.value = v; ctx.setAj('baixarPasta', v); });
    },
  });
  // nome de pasta/arquivo seguro no Windows
  // nomes reservados do Windows (con, nul, aux, prn, com1…, lpt1…) ganham um _ na frente
  const reservado = (s) => (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(s) ? '_' + s : s);
  function limparPasta(s) { return reservado(String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '').replace(/^\.+|\.+$/g, '').trim().slice(0, 40)); }
  function nomeSeguro(s) { return reservado(String(s || '').replace(/[^\w.\-]+/g, '_').replace(/^[._]+|[._]+$/g, '').slice(0, 40) || 'tiktok'); }
  const dois = (n) => String(n).padStart(2, '0');
  function carimbo(seg) { const d = seg ? new Date(seg * 1000) : new Date(); return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}_${dois(d.getHours())}-${dois(d.getMinutes())}-${dois(d.getSeconds())}`; }
  // escolhe a versão: H.264 de maior resolução (abre em qualquer player); com "qualidade máxima", a maior de todas (pode ser HEVC)
  function escolher(versoes, hevc) {
    const v = (versoes || []).filter((x) => x && x.url);
    if (!v.length) return null;
    const h264 = v.filter((x) => /264|avc/i.test(x.codec) || (x.play && !/265|hev/i.test(x.codec)));
    const pool = hevc ? v : (h264.length ? h264 : v);
    return pool.slice().sort((a, b) => (b.h * b.w) - (a.h * a.w) || (b.tam || 0) - (a.tam || 0))[0];
  }
  globalThis.BRASA_BAIXAR = { escolher, nomeSeguro, carimbo, limparPasta };

  // ───────────────────────── na página do TikTok ─────────────────────────
  const BRASA = globalThis.BRASA;
  if (!BRASA || BRASA.dead) return;
  const L = () => BRASA.L();
  const ICO_BAIXAR = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/></svg>';
  const BTN = 'brasa-baixar';

  // vídeo da tela: o artigo do meio (feed) ou o da página de vídeo (/@x/video/<id>)
  function artigoDaTela() {
    const nv = BRASA.navegador && BRASA.navegador(); if (nv) return nv.el; // v1.0.2: modo navegador (o quadro do vídeo)
    const cy = innerHeight / 2;
    for (const a of document.querySelectorAll('[data-e2e="recommend-list-item-container"]')) { const r = a.getBoundingClientRect(); if (r.top <= cy && r.bottom >= cy) return a; }
    return null;
  }
  function idDaTela() {
    const a = artigoDaTela();
    const w = a && a.querySelector('[id^="xgwrapper-"]');
    const m = w && w.id.match(/(\d{8,})$/);
    if (m) return m[1];
    const u = location.pathname.match(/\/(?:video|photo)\/(\d{8,})/);
    return u ? u[1] : null;
  }

  // ── botão na barra do player (grupo da direita, antes do "…") ──
  function garantirBotoes() {
    if (BRASA.dead || !BRASA.acoes) return;
    // v1.0.2: só onde há vídeo na tela (feed, quadro do modo navegador ou página de um vídeo), não solto numa grade
    const on = BRASA.ativo() && BRASA.S.baixar && (BRASA.ehTelaDeVideo() || BRASA.page.kind === 'video');
    if (!on) { BRASA.acoes.tirar('baixar'); return; }
    const T = L();
    BRASA.acoes.item('baixar', 10, T.acaoBaixar, () => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = BTN; b.innerHTML = ICO_BAIXAR;
      b.setAttribute('aria-label', T.baixarBotao); b.title = T.baixarBotao + ' (D)';
      b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); baixar(b.closest('[data-e2e="recommend-list-item-container"]') || artigoDaTela()); });
      return b;
    });
  }
  const tBtn = setInterval(garantirBotoes, 800);
  const offs = [BRASA.on('settings', garantirBotoes), BRASA.on('ativo', garantirBotoes), BRASA.on('nav', () => setTimeout(garantirBotoes, 300))];

  // ── atalho D ──
  const digitando = () => { const a = document.activeElement; return !!a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable || a.getAttribute('role') === 'textbox'); };
  const onKey = (e) => {
    if (e.key !== 'd' && e.key !== 'D') return;
    if (e.ctrlKey || e.altKey || e.metaKey || e.repeat || digitando() || !BRASA.ativo() || !BRASA.S.baixar) return;
    if (e.composedPath && e.composedPath().some((x) => x && x.tagName === 'BRASA-UI')) return;
    e.preventDefault(); e.stopPropagation();
    baixar(artigoDaTela());
  };
  addEventListener('keydown', onKey, true);

  // ── o download ──
  let ocupado = false;
  const paraFundo = (m) => ext.runtime.sendMessage(Object.assign({ type: 'brasa:baixar' }, m)).catch((e) => ({ erro: String(e && e.message || e) }));
  async function buscarAqui(url) {
    const r = await fetch(url, { credentials: 'include', cache: 'no-store' }); // aqui = origem e Referer do TikTok (o CDN exige)
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.blob();
  }
  // imagem: busca pela aba (mesma origem e Referer do site) e entrega blob:; se falhar, o fundo tenta o endereço direto (plano B)
  async function viaAba(u) { try { const b = await buscarAqui(u); const x = URL.createObjectURL(b); setTimeout(() => URL.revokeObjectURL(x), 60000); return x; } catch (_) { return u; } }
  const paraDataUrl = (blob) => new Promise((ok, err) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = () => err(fr.error); fr.readAsDataURL(blob); });
  async function baixar(artigo) {
    if (ocupado) return;
    const T = L();
    let id = null;
    const w = artigo && artigo.querySelector('[id^="xgwrapper-"]');
    const m0 = w && w.id.match(/(\d{8,})$/);
    id = m0 ? m0[1] : idDaTela();
    if (!id) { BRASA.toast(T.baixarSemVideo); return; }
    ocupado = true;
    try {
      const m = await BRASA.bridge('midia', id);
      if (!m) { BRASA.toast(T.baixarSemDados); BRASA.log('baixarFalhou', ['semDados'], false); return; }
      const pasta = limparPasta(BRASA.S.baixarPasta) || 'Brasa', autor = nomeSeguro(m.autor), base = `${pasta}/${autor}/${autor}_${carimbo(m.criado)}_${m.id}`;
      // carrossel de fotos (medido: item de foto não traz endereço de vídeo, só imagePost.images)
      if (m.fotos && m.fotos.length) {
        BRASA.toast(T.baixarFotos(m.fotos.length));
        const itens = [];
        for (let i = 0; i < m.fotos.length; i++) itens.push({ url: await viaAba(m.fotos[i]), nome: `${base}_foto${dois(i + 1)}.jpg` });
        const r = await paraFundo({ cmd: 'arquivos', itens });
        if (r && r.ok) { BRASA.toast(T.baixadoFotos(m.fotos.length)); BRASA.log('baixou', ['fotos', m.fotos.length]); }
        else { BRASA.toast(T.baixarErro); BRASA.log('baixarFalhou', ['fotos'], false); }
        return;
      }
      const v = escolher(m.versoes, !!BRASA.S.baixarHevc);
      if (!v) { BRASA.toast(T.baixarSemDados); BRASA.log('baixarFalhou', ['semVersao'], false); return; }
      BRASA.toast(T.baixando);
      let blob = null;
      try { blob = await buscarAqui(v.url); } catch (_) {
        // plano B: outra versão sem marca d'água (a lista toda, da melhor para a pior)
        for (const o of (m.versoes || []).filter((x) => x.url !== v.url)) { try { blob = await buscarAqui(o.url); break; } catch (__) {} }
      }
      if (!blob) { BRASA.toast(T.baixarErro); BRASA.log('baixarFalhou', ['cdn'], false); return; }
      const extn = /webm/.test(blob.type) ? 'webm' : 'mp4';
      // entrega ao fundo: endereço blob: (rápido); se o navegador recusar, vai como data: (plano B)
      const url = URL.createObjectURL(blob);
      let r = await paraFundo({ cmd: 'arquivos', itens: [{ url, nome: `${base}.${extn}` }] });
      if (!r || !r.ok) r = await paraFundo({ cmd: 'arquivos', itens: [{ url: await paraDataUrl(blob), nome: `${base}.${extn}` }] });
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      if (BRASA.S.baixarCapa && m.capa) paraFundo({ cmd: 'arquivos', itens: [{ url: await viaAba(m.capa), nome: `${base}_capa.jpg` }] });
      if (r && r.ok) { BRASA.toast(T.baixado(`${autor}_${m.id}.${extn}`)); BRASA.log('baixou', ['video', `${Math.min(v.w || v.h, v.h || v.w)}p ${/265|hev/i.test(v.codec) ? 'HEVC' : 'H.264'}`]); }
      else { BRASA.toast(T.baixarErro); BRASA.log('baixarFalhou', ['salvar'], false); }
    } finally { ocupado = false; }
  }
  BRASA.baixar = { baixar, garantirBotoes, idDaTela };
  BRASA.onStop(() => { clearInterval(tBtn); offs.forEach((f) => f()); removeEventListener('keydown', onKey, true); if (BRASA.acoes) BRASA.acoes.tirar('baixar'); });
})();
