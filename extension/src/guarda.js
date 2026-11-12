// Brasa — fase 2 · guarda-foguinho.
//  1. Aba "Foguinho" do menu (página e popup): conversas recentes com chave por conversa, selo de sequência (dias, quando o TikTok
//     manda o dado) ou "provável", frases, horários, "Continuar com o Chrome fechado", "Mandar agora" e "Ensaio".
//  2. Coleta passiva em tiktok.com/messages: a lista de conversas e, da conversa que a pessoa abre, em que dias houve mensagem
//     de cada lado (para o selo "provável"). Só lê; fica no storage.local.
//  3. Executor: só age por ordem do fundo (sw.js), na janela que o fundo abriu. Abre a conversa marcada, lê, decide pelas regras
//     (src/guarda-regras.js), digita, envia e CONFERE que a mensagem apareceu. No "Ensaio" faz tudo menos apertar enviar.
// Seletores medidos no Chrome do André em 2026-11-11 (só leitura): Jarvis/02-projetos/extensoes/role/brasa-engenharia-reversa.md
(() => {
  'use strict';
  const M = globalThis.BRASA_MENU, C = globalThis.BRASA_COMUM, DEF = globalThis.BRASA_DEF, G = globalThis.BRASA_GUARDA;
  if (!M || !C || !DEF || !G) return;
  const { esc, ICO } = C;
  const ext = globalThis.chrome;
  const K = DEF.K;

  // ───────────────────────── dados (cache do storage) ─────────────────────────
  const dados = { convs: {}, frases: null, dia: null, run: null, marcadas: {} };
  const ler = () => ext.storage.local.get([K.fogConvs, K.fogFrases, K.fogDia, K.fogRun, K.fogMarcadas]).then((l) => {
    dados.marcadas = l[K.fogMarcadas] || {};
    const c = l[K.fogConvs] || {};
    for (const id of Object.keys(c)) c[id] = Object.assign({}, c[id], { marcada: !!dados.marcadas[id] }); // a marcação vem só de br.fog.marcadas
    dados.convs = c; dados.frases = l[K.fogFrases] || null; dados.dia = l[K.fogDia] || null; dados.run = l[K.fogRun] || null;
  }, () => {});
  ler();
  const onStoreFog = (ch, area) => {
      if (area !== 'local' || !(ch[K.fogConvs] || ch[K.fogFrases] || ch[K.fogDia] || ch[K.fogRun] || ch[K.fogMarcadas])) return;
      const ativo = globalThis.__brasaFogEditando && Date.now() - globalThis.__brasaFogEditando < 2000; // não redesenha no meio da digitação
      ler().then(() => { if (!ativo) M.pedirRedesenho(); });
  };
  try { ext.storage.onChanged.addListener(onStoreFog); } catch (_) {}
  const frases = () => (Array.isArray(dados.frases) && dados.frases.length ? dados.frases : G.FRASES_PT);
  const rodando = () => !!(dados.run && dados.run.pulso && Date.now() - dados.run.pulso < 4 * 60e3);

  // ───────────────────────── aba Foguinho do menu ─────────────────────────
  const CSS = `
.fog .acoes { display: flex; gap: 8px; padding: 4px 16px 10px; } .fog .acoes .btn { flex: 1; }
.fog .cv { display: flex; align-items: center; gap: 10px; min-height: 56px; width: 100%; padding: 6px 16px !important; text-align: left; }
.fog button.cv:hover { background: var(--add); }
.fog .cv .av { width: 36px; height: 36px; border-radius: 18px; background: var(--add); flex: none; object-fit: cover; }
.fog .cv .lb { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.fog .cv .lb span { font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fog .cv .lb small { font-size: 12px; color: var(--tx2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fog .cv .gr { font-weight: 600; color: var(--tx); background: var(--add); border-radius: 4px; padding: 0 5px; margin-right: 2px; }
.fog .selo { display: inline-flex; align-items: center; gap: 2px; height: 20px; padding: 0 8px 0 4px; border-radius: 10px; font-size: 11px; font-weight: 600; background: var(--accbg); color: var(--acc); flex: none; }
.fog .selo svg { width: 14px; height: 14px; } .fog .selo.prov { background: var(--add); color: var(--tx2); padding: 0 8px; }
.fog textarea { display: block; width: calc(100% - 32px); margin: 4px 16px; min-height: 120px; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--line); background: transparent; color: var(--tx); font: 13px/19px inherit; font-family: inherit; resize: vertical; }
.fog .dica { margin: 2px 16px 6px; font-size: 12px; line-height: 16px; color: var(--tx2); }
.fog .horas { display: flex; gap: 12px; padding: 4px 16px 10px; } .fog .horas label { flex: 1; display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--tx2); }
.fog .horas input { height: 36px; padding: 0 10px; border-radius: 8px; border: 1px solid var(--line); background: transparent; color: var(--tx); font: inherit; color-scheme: light dark; }
.fog .lk { margin: 0 12px 6px; }
`;
  if (!M.CSS.includes('.fog .acoes')) M.CSS += CSS;
  const doisD = (n) => String(n).padStart(2, '0');
  const hhmm = (ms) => { const d = new Date(ms); return `${doisD(d.getHours())}:${doisD(d.getMinutes())}`; };
  function status(T, S) {
    if (rodando()) return T.fogRodando(dados.run.ensaio, (dados.run.i || 0) + 1, (dados.run.fila || []).length);
    const e = G.estadoDoDia(dados.dia, Date.now());
    const r = Object.values(e.convs || {});
    const n = (x) => r.filter((v) => v.res === x).length;
    const marcadas = Object.values(dados.convs).filter((c) => c.marcada).length;
    if (!marcadas) return T.fogNenhuma;
    const prox = (e.rodadas || 0) === 0 ? S.guardaH1 : (e.rodadas || 0) === 1 ? S.guardaH2 : null;
    return T.fogHoje(n('mandou'), n('pulou') + n('naoMandou') + n('desmarcou'), n('falhou'), marcadas, prox);
  }
  function seloDe(T, c) {
    if (c.seq && c.seq.dias > 0 && Date.now() - (c.seq.em || 0) < 3 * 86400e3) return `<span class="selo" title="${esc(T.fogSeqTitulo)}">${ICO.app}${esc(T.fogDias(c.seq.dias))}</span>`;
    if (c.dias && G.provavel(c.dias, Date.now())) return `<span class="selo prov" title="${esc(T.fogProvTitulo)}">${esc(T.fogProvavel)}</span>`;
    return '';
  }
  // cartão na aba Recursos (liga/desliga e leva à aba Foguinho)
  M.addSecao({
    id: 'guarda', ordem: 40,
    html(T, ctx) {
      return M.cartao(ctx, 'guarda', ICO.app, T['set.guarda'], T.featFog_, `<div class="cont">${esc(status(T, ctx.S))}</div><button type="button" class="ir" data-ir-aba="fog">${esc(T.featFogAbrir)} →</button>`);
    },
  });
  M.addAba({
    id: 'fog', ordem: 50, rotulo: (T) => T.tabFog,
    html(T, ctx) {
      const S = ctx.S;
      let h = `<div class="fog"><div class="sec cards">${M.cartao(ctx, 'guarda', ICO.app, T['set.guarda'], T.featFog_, '')}</div>`;
      if (!S.guarda) return h + `<div class="vazio">${esc(T.fogDesligado)}</div></div>`;
      h += `<div class="cont">${esc(status(T, S))}</div>
        <div class="acoes"><button type="button" class="btn sec" data-fog="ensaio" title="${esc(T.fogEnsaioDica)}"${rodando() ? ' disabled' : ''}>${esc(T.fogEnsaio)}</button>
          <button type="button" class="btn pri" data-fog="agora"${rodando() ? ' disabled' : ''}>${esc(T.fogAgora)}</button></div>
        <p class="dica">${esc(T.fogEnsaioDica)}.</p>`;
      const lista = Object.entries(dados.convs).filter(([id, c]) => DEF.convOk(id) && c.apelido)
        .sort((a, b) => (b[1].marcada ? 1 : 0) - (a[1].marcada ? 1 : 0) || (b[1].visto || 0) - (a[1].visto || 0)).slice(0, 40);
      h += `<h4>${esc(T.fogConversas)}</h4>`;
      if (!lista.length) h += `<div class="vazio">${esc(T.fogSemLista)}</div><button type="button" class="lk" data-fog="abrir">${esc(T.fogAbrirMsgs)}</button>`;
      else h += `<p class="dica">${esc(T.fogMarqueDica)}</p>` + lista.map(([id, c]) => `<button type="button" class="cv" role="switch" aria-checked="${!!c.marcada}" data-conv="${esc(id)}">
          ${c.avatar ? `<img class="av" alt="" src="${esc(c.avatar)}" referrerpolicy="no-referrer">` : '<span class="av"></span>'}
          <span class="lb"><span>${esc(c.apelido)}</span><small>${DEF.ehGrupo(id) ? `<b class="gr">${esc(T.fogGrupo)}</b> ` : ''}${esc([c.previa, c.hora].filter(Boolean).join(' · '))}</small></span>${seloDe(T, c)}<span class="sw"></span></button>`).join('');
      h += M.recolhe('frases', T.fogMensagens, `<textarea data-fog="frases" spellcheck="true" aria-label="${esc(T.fogMensagens)}">${esc(frases().join('\n'))}</textarea>
          <p class="dica">${esc(T.fogFrasesDica)}</p>${M.linha(T, ctx, 'guardaMesma', true)}
          <button type="button" class="lk" data-fog="fabrica">${esc(T.fogFabrica)}</button>`)
        + M.recolhe('horas', T.fogHorarios, `<div class="horas"><label>${esc(T.fogH1)}<input type="time" data-fog="h1" value="${esc(S.guardaH1)}"></label><label>${esc(T.fogH2)}<input type="time" data-fog="h2" value="${esc(S.guardaH2)}"></label></div>
          <p class="dica">${esc(T.fogHorasDica)}</p>`)
        + M.recolhe('fechado', T['set.guardaFechado'], `<button type="button" class="row" role="switch" aria-checked="${!!S.guardaFechado}" data-fog="fechado"><span class="lb"><span>${esc(T['set.guardaFechado'])}</span><small>${esc(T['set.guardaFechado_'])}</small></span><span class="sw"></span></button>`)
        + '</div>';
      return h;
    },
    wire(el, ctx) {
      const T = ctx.T();
      el.querySelectorAll('[data-conv]').forEach((b) => b.addEventListener('click', async () => {
        const id = b.dataset.conv, novo = b.getAttribute('aria-checked') !== 'true';
        b.setAttribute('aria-checked', String(novo));
        await DEF.marcar(id, novo);
        DEF.logar('fogMarca', [(dados.convs[id] || {}).apelido || '?', novo]);
      }));
      const cmd = (c, extra) => ext.runtime.sendMessage(Object.assign({ type: 'brasa:guarda', cmd: c }, extra || {})).catch(() => null);
      el.querySelectorAll('[data-fog="agora"],[data-fog="ensaio"]').forEach((b) => b.addEventListener('click', async () => {
        b.disabled = true;
        const r = await cmd(b.dataset.fog);
        ctx.toast(r && r.erro ? T.fogErro(r.erro) : r && r.nada ? T.fogNada : b.dataset.fog === 'ensaio' ? T.fogEnsaioComecou : T.fogComecou);
      }));
      const ab = el.querySelector('[data-fog="abrir"]'); if (ab) ab.addEventListener('click', () => cmd('abrirMensagens'));
      const ta = el.querySelector('textarea[data-fog="frases"]');
      let tTa = 0;
      if (ta) ta.addEventListener('input', () => {
        globalThis.__brasaFogEditando = Date.now();
        clearTimeout(tTa);
        tTa = setTimeout(() => {
          const l = ta.value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 50).map((x) => x.slice(0, 300));
          ext.storage.local.set({ [K.fogFrases]: l.length && l.join('\n') !== G.FRASES_PT.join('\n') ? l : null });
        }, 500);
      });
      const fb = el.querySelector('[data-fog="fabrica"]'); if (fb) fb.addEventListener('click', async () => { await ext.storage.local.set({ [K.fogFrases]: null }); ctx.toast(T.fogFabricaOk); });
      el.querySelectorAll('input[data-fog="h1"],input[data-fog="h2"]').forEach((i) => i.addEventListener('change', () => {
        if (!/^\d{2}:\d{2}$/.test(i.value)) return;
        ctx.setAj(i.dataset.fog === 'h1' ? 'guardaH1' : 'guardaH2', i.value);
      }));
      const fc = el.querySelector('[data-fog="fechado"]');
      if (fc) fc.addEventListener('click', async () => {
        const novo = !ctx.S.guardaFechado;
        // a permissão "background" só pode ser pedida numa página da extensão, com clique (no popup isso é aqui mesmo)
        if (ext.permissions && ext.permissions.request) {
          try {
            const ok = novo ? await ext.permissions.request({ permissions: ['background'] }) : await ext.permissions.remove({ permissions: ['background'] });
            if (ok || !novo) { await ctx.setAj('guardaFechado', novo); DEF.logar('chave', [T['set.guardaFechado'], novo]); }
          } catch (e) { ctx.toast(T.fogErro(String(e.message || e))); }
          M.pedirRedesenho();
        } else { cmd('pedirFechado'); ctx.toast(T.fogFechadoAbriu); }
      });
    },
  });

  // ───────────────────────── na página do TikTok ─────────────────────────
  const BRASA = globalThis.BRASA;
  if (!BRASA || BRASA.dead) return;
  const ehMensagens = () => location.pathname.startsWith('/messages');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function ate(fn, ms, passo) { const fim = Date.now() + ms; while (Date.now() < fim) { let v = null; try { v = fn(); } catch (_) {} if (v) return v; await wait(passo || 150); } return null; }
  const SEL = {
    lista: '[data-e2e="dm-new-conversation-list"]', item: '[data-e2e="dm-new-conversation-item"]', apelido: '[data-e2e="dm-new-conversation-nickname"]',
    previa: '[class*="--SpanInfoExtract"]', hora: '[class*="--SpanInfoTime"]', avatar: '[data-e2e="dm-new-conversation-avatar"] img',
    msgs: '[data-e2e="dm-new-message-list"]', sep: '[data-e2e="dm-new-time-separator"]', chat: '[data-e2e="dm-new-chat-item"]',
    horiz: '[class*="--DivMessageHorizontalContainer"]', aviso: '[data-e2e="dm-warning"]', editor: '[data-e2e="dm-new-input-editor"] [contenteditable="true"]',
    enviar: '[data-e2e="dm-new-send-btn"]', sistema: '[class*="--DivSystem"],[class*="SystemMessage"],[class*="--DivTip"],[class*="--DivNotice"]',
  };
  const eua = () => /^en-us/i.test(document.documentElement.lang || '');
  // id do item: "more-action-icon-0:1:<uid>:<uid>" (a dois) ou "more-action-icon-<número>" (grupo, medido)
  const convDoItem = (it) => { const m = String(it.id || '').match(/^more-action-icon-(\d+:\d+:\d+:\d+|\d{10,})$/); return m ? m[1] : null; };
  const itemDaConv = (conv) => [...document.querySelectorAll(SEL.item)].find((it) => convDoItem(it) === conv) || null;

  // ── coleta passiva: lista de conversas e dias de mensagem da conversa aberta ──
  let ultimaColeta = '';
  function coletar() {
    if (BRASA.dead || !BRASA.S.guarda) return;
    const its = [...document.querySelectorAll(SEL.item)];
    if (!its.length) return;
    const agora = Date.now(), lote = {};
    its.forEach((it, i) => {
      const conv = convDoItem(it);
      if (!conv || !DEF.convOk(conv)) return; // conversa a dois ou grupo
      const t = (s) => { const e = it.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; };
      const img = it.querySelector(SEL.avatar);
      lote[conv] = { apelido: t(SEL.apelido).slice(0, 60), previa: t(SEL.previa).slice(0, 70), hora: t(SEL.hora).slice(0, 20), avatar: img && /^https:/.test(img.src) ? img.src : '', ordem: i, aberta: it.getAttribute('aria-selected') === 'true' };
    });
    const aberta = Object.keys(lote).find((k) => lote[k].aberta);
    let diasAberta = null;
    if (aberta && document.querySelector(SEL.msgs)) { const a = G.analisar(lerConversa(), agora, false, eua()); diasAberta = a.dias; }
    const assin = JSON.stringify(lote) + JSON.stringify(diasAberta);
    if (assin === ultimaColeta) return;
    ultimaColeta = assin;
    DEF.mudarConvs((c) => {
      for (const [id, v] of Object.entries(lote)) {
        const cv = c[id] || (c[id] = {});
        delete cv.marcada; // a marcação mora em br.fog.marcadas
        Object.assign(cv, { apelido: v.apelido || cv.apelido, previa: v.previa, hora: v.hora, avatar: v.avatar || cv.avatar, visto: agora - v.ordem });
      }
      if (aberta && diasAberta) {
        const cv = c[aberta], limite = G.somaDias(G.diaDe(agora), -7);
        cv.dias = Object.fromEntries(Object.entries(Object.assign({}, cv.dias || {}, diasAberta)).filter(([d]) => d >= limite));
      }
      const ids = Object.keys(c);
      if (ids.length > 200) ids.sort((a, b) => (dados.marcadas[a] ? 1e15 : 0) + (c[a].visto || 0) - ((dados.marcadas[b] ? 1e15 : 0) + (c[b].visto || 0))).slice(0, ids.length - 200).forEach((k) => delete c[k]);
      return c;
    });
  }
  const tColeta = setInterval(() => { if (ehMensagens() || document.querySelector(SEL.lista)) coletar(); }, 4000);

  // ── leitura de uma conversa (na ordem da tela) ──
  function ehMinha(item) {
    const h = item.querySelector(SEL.horiz);
    if (h) { const fd = getComputedStyle(h).flexDirection; if (fd === 'row-reverse') return true; if (fd === 'row') return false; }
    // plano B: a bolha encostada à direita da lista
    const ml = document.querySelector(SEL.msgs), r = item.getBoundingClientRect(), L = ml ? ml.getBoundingClientRect() : null;
    return !!(L && r.width && (L.right - r.right) < (r.left - L.left));
  }
  function lerConversa() {
    const ml = document.querySelector(SEL.msgs);
    if (!ml) return [];
    const out = [];
    for (const n of ml.querySelectorAll(`${SEL.sep}, ${SEL.chat}, ${SEL.sistema}`)) {
      if (n.matches(SEL.sep)) out.push({ sep: n.textContent.trim() });
      else if (n.matches(SEL.chat)) { const t = n.textContent.replace(/\s+/g, ' ').trim().slice(0, 300); if (n.querySelector(SEL.horiz)) out.push({ msg: true, eu: ehMinha(n), texto: t }); else out.push({ sistema: t }); }
      else if (!n.closest(SEL.chat)) out.push({ sistema: n.textContent.replace(/\s+/g, ' ').trim().slice(0, 300) });
    }
    return out;
  }
  const rolavel = (el) => { let x = el; while (x && x !== document.body) { if (x.scrollHeight > x.clientHeight + 10 && /(auto|scroll)/.test(getComputedStyle(x).overflowY)) return x; x = x.parentElement; } return el; };
  // carrega mensagens mais antigas até ver um dia antes de ontem (ou o começo da conversa)
  async function carregarHistorico() {
    const ml = document.querySelector(SEL.msgs);
    if (!ml) return false;
    const ontem = G.somaDias(G.diaDe(Date.now()), -1);
    for (let k = 0; k < 8; k++) {
      const seps = [...ml.querySelectorAll(SEL.sep)].map((s) => G.lerSeparador(s.textContent, Date.now(), eua())).filter(Boolean);
      if (seps.some((d) => d < ontem)) return true;
      const n0 = ml.querySelectorAll(SEL.chat).length;
      const sc = rolavel(ml);
      sc.scrollTop = 0; sc.dispatchEvent(new Event('scroll'));
      const cresceu = await ate(() => ml.querySelectorAll(SEL.chat).length > n0, 2500, 200);
      if (!cresceu) return true; // começo da conversa
    }
    return false;
  }
  // ── escrever no editor (Draft.js) ──
  const textoEditor = () => { const e = document.querySelector(SEL.editor); return e ? e.textContent.replace(/​/g, '').trim() : null; };
  async function escrever(frase) {
    const ed = document.querySelector(SEL.editor);
    if (!ed) return false;
    ed.focus();
    try { const s = getSelection(), r = document.createRange(); r.selectNodeContents(ed); r.collapse(false); s.removeAllRanges(); s.addRange(r); } catch (_) {}
    document.execCommand('insertText', false, frase);
    if (await ate(() => (textoEditor() || '').includes(frase.slice(0, 12)), 1500, 100)) return true;
    // plano B: colar (o Draft.js trata o evento de colar)
    try { const dt = new DataTransfer(); dt.setData('text/plain', frase); ed.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); } catch (_) {}
    return !!(await ate(() => (textoEditor() || '').includes(frase.slice(0, 12)), 1500, 100));
  }
  async function limparEditor() {
    const ed = document.querySelector(SEL.editor);
    if (!ed) return true;
    ed.focus();
    for (let k = 0; k < 3 && textoEditor(); k++) { document.execCommand('selectAll'); document.execCommand('delete'); await wait(150); }
    return !textoEditor();
  }
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  function ultimaMinhaCom(frase, antes) {
    const its = [...document.querySelectorAll(`${SEL.msgs} ${SEL.chat}`)];
    const ult = its.slice(-4).reverse().find((it) => !antes.has(it) && ehMinha(it) && norm(it.textContent).includes(norm(frase).slice(0, 40)));
    return ult || null;
  }
  const cabecalho = () => { const h = document.querySelector('[data-e2e="dm-new-chat-nickname"]') || document.querySelector('[data-e2e="dm-new-conversation-header"] [class*="--PNickname"]'); return h ? norm(h.textContent) : null; };

  // ── o executor: uma conversa por ordem do fundo ──
  async function processar({ conv, frase, ensaio }) {
    if (!BRASA.ativo() || !BRASA.S.guarda) return { res: 'falhou', motivo: 'pausada' };
    if (!(((await ext.storage.local.get(K.fogMarcadas))[K.fogMarcadas] || {})[conv])) return { res: 'falhou', motivo: 'naoMarcada' }; // nunca escreve em conversa não marcada
    if (!ehMensagens()) return { res: 'falhou', motivo: 'foraDeMensagens' };
    if (!(await ate(() => document.querySelector(SEL.item), 20000))) return { res: 'falhou', motivo: 'semLista' };
    let it = itemDaConv(conv);
    for (let k = 0; !it && k < 12; k++) { const l = document.querySelector(SEL.lista); const sc = l && rolavel(l); if (sc) { sc.scrollTop = sc.scrollHeight; sc.dispatchEvent(new Event('scroll')); } await wait(900); it = itemDaConv(conv); }
    if (!it) return { res: 'falhou', motivo: 'naoAchei' };
    // (c) sequência perdida mostrada na prévia da lista (onde o TikTok mostrou "Sequência de N dias perdidos. Restaurar")
    const pv = it.querySelector(SEL.previa);
    if (pv && G.ePerdida(pv.textContent)) return { res: 'desmarcou', motivo: 'perdida' };
    const apelido = norm((it.querySelector(SEL.apelido) || {}).textContent || '');
    // o painel da conversa ANTERIOR pode continuar na tela enquanto o TikTok carrega a nova: espera um painel novo com o cabeçalho certo
    const painelAntes = document.querySelector(SEL.msgs);
    const jaAberta = it.getAttribute('aria-selected') === 'true';
    if (!jaAberta) it.click();
    const abriu = await ate(() => {
      const x = itemDaConv(conv), ml = document.querySelector(SEL.msgs);
      if (!x || x.getAttribute('aria-selected') !== 'true' || !ml) return false;
      if (!jaAberta && painelAntes && ml === painelAntes && cabecalho() !== apelido) return false;
      const c = cabecalho();
      return c == null || !apelido || c === apelido;
    }, 12000);
    if (!abriu) return { res: 'falhou', motivo: 'naoAbriu' };
    await ate(() => document.querySelector(`${SEL.msgs} ${SEL.chat}`), 8000);
    await wait(800);
    const completo = await carregarHistorico();
    const a = G.analisar(lerConversa(), Date.now(), completo, eua());
    const d = G.decidir(a);
    if (d.acao === 'falhar') return { res: 'falhou', motivo: d.motivo };
    if (d.acao === 'pular') return { res: 'pulou', motivo: d.motivo };
    if (d.acao === 'naoMandar') return { res: 'naoMandou', motivo: d.motivo };
    if (d.acao === 'desmarcar') return { res: 'desmarcou', motivo: d.motivo };
    // confere de novo que a conversa aberta é a pedida, logo antes de escrever
    const sel = document.querySelector(`${SEL.item}[aria-selected="true"]`);
    if (!sel || convDoItem(sel) !== conv || (apelido && cabecalho() != null && cabecalho() !== apelido)) return { res: 'falhou', motivo: 'conversaErrada' };
    // rascunho da pessoa no editor: tenta apagar; se não der, NÃO manda (nunca envia texto que não é a frase)
    if (textoEditor() && !(await limparEditor())) return { res: 'falhou', motivo: 'rascunho' };
    if (!(await escrever(frase))) { await limparEditor(); return { res: 'falhou', motivo: 'naoDigitou' }; }
    if (norm(textoEditor()) !== norm(frase)) { await limparEditor(); return { res: 'falhou', motivo: 'naoDigitou' }; }
    if (ensaio) { const limpo = await limparEditor(); return { res: 'ensaio', motivo: limpo ? 'ok' : 'naoLimpou' }; }
    const antes = new Set(document.querySelectorAll(`${SEL.msgs} ${SEL.chat}`));
    const btn = await ate(() => document.querySelector(SEL.enviar), 3000, 100);
    if (btn) btn.click();
    else { const ed = document.querySelector(SEL.editor); ed.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true })); }
    const apareceu = await ate(() => ultimaMinhaCom(frase, antes), 15000, 250);
    if (!apareceu) return { res: 'falhou', motivo: 'naoApareceu' };
    await wait(1500);
    const av = apareceu.querySelector(SEL.aviso);
    if (av && av.textContent.trim()) return { res: 'falhou', motivo: 'erroEnvio' };
    return { res: 'mandou', motivo: 'ok' };
  }
  let ocupado = false;
  const onMsg = (m, sender, responder) => {
    if (!m || m.type !== 'brasa:guarda-cmd' || !sender || sender.id !== ext.runtime.id || BRASA.dead) return;
    if (m.cmd === 'ping') { responder({ ok: true, mensagens: ehMensagens(), lista: !!document.querySelector(SEL.item), visivel: document.visibilityState, ocupado }); return; }
    if (m.cmd === 'conversa') {
      if (ocupado) { responder({ res: 'falhou', motivo: 'ocupado' }); return; }
      ocupado = true;
      processar(m).then((r) => responder(r), (e) => responder({ res: 'falhou', motivo: 'erro', erro: String(e && e.message || e).slice(0, 120) })).finally(() => { ocupado = false; });
      return true;
    }
  };
  ext.runtime.onMessage.addListener(onMsg);
  BRASA.guarda = { lerConversa, processar, coletar, analisarAberta: () => G.analisar(lerConversa(), Date.now(), false) };
  BRASA.onStop(() => { clearInterval(tColeta); try { ext.runtime.onMessage.removeListener(onMsg); ext.storage.onChanged.removeListener(onStoreFog); } catch (_) {} });
})();
