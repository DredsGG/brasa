// Brasa — o menu (o mesmo desenho dentro do TikTok, aberto pelo botão da barra lateral, e no popup do ícone).
// Abas: Recursos (uma chave por recurso), as abas que as fases acrescentarem (Foguinho na fase 2) e Registro. Rodapé padrão embaixo.
// Os recursos se registram com BRASA_MENU.addSecao({ id, ordem, html(T, ctx), wire(el, ctx) }) e BRASA_MENU.addAba({ id, ordem, rotulo(T), html, wire }).
// ctx (quem desenha passa): { T(), lang, LANGS, S, setAj(k, v), VERSION, upd, urgente(), acao(act), lerLog(), limparLog(), copiar(txt), toast(msg), onde }
(() => {
  'use strict';
  const C = globalThis.BRASA_COMUM, DEF = globalThis.BRASA_DEF;
  if (!C || !DEF) return;
  const { esc, ICO } = C;
  const reg = { secoes: [], abas: [] };
  const addSecao = (s) => { reg.secoes = reg.secoes.filter((x) => x.id !== s.id).concat(s).sort((a, b) => a.ordem - b.ordem); };
  const addAba = (a) => { reg.abas = reg.abas.filter((x) => x.id !== a.id).concat(a).sort((x, y) => x.ordem - y.ordem); };

  const CSS = `
.pn { width: 360px; max-width: calc(100vw - 16px); display: flex; flex-direction: column; border-radius: 8px; background: var(--menu); color: var(--tx); overflow: hidden;
  box-shadow: 0 4px 24px rgba(0,0,0,.22); border: 1px solid var(--line); }
.pn .hd { display: flex; align-items: center; gap: 10px; height: 56px; padding: 0 12px 0 16px; flex: none; }
.pn .hd .ic { color: var(--acc); } .pn .hd .ic svg { width: 26px; height: 26px; }
.pn .hd b { flex: 1; font-size: 18px; line-height: 24px; font-weight: 700; }
.pn .hd .tg { display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 4px 0 10px !important; border-radius: 18px; color: var(--tx2); font-size: 13px !important; }
.pn .hd .tg:hover { background: var(--add); }
.pn .ban { margin: 0 12px 8px; padding: 8px 12px; border-radius: 8px; background: var(--accbg); font-size: 13px; display: flex; gap: 8px; align-items: center; }
.pn .ban.urg { background: var(--acc); color: #fff; } .pn .ban.urg .lk { color: #fff; } .pn .ban button { margin-left: auto; }
.pn .tabs { display: flex; padding: 0 8px; border-bottom: 1px solid var(--line); flex: none; }
.pn .tabs button { position: relative; height: 44px; padding: 0 12px !important; font-size: 15px !important; font-weight: 600 !important; color: var(--tx3); }
.pn .tabs button:hover { color: var(--tx2); }
.pn .tabs button[aria-selected=true] { color: var(--tx); }
.pn .tabs button[aria-selected=true]::after { content: ''; position: absolute; left: 12px; right: 12px; bottom: -1px; height: 2px; border-radius: 1px; background: var(--tx); }
.pn .sc { overflow-y: auto; overscroll-behavior: contain; min-height: 120px; }
.pn .sec { padding: 6px 0; border-bottom: 1px solid var(--line); } .pn .sec:last-child { border-bottom: 0; }
.pn .sec h4 { margin: 6px 16px 2px; font-size: 12px; line-height: 18px; font-weight: 600; color: var(--tx3); }
.pn .row { display: flex; align-items: center; gap: 12px; min-height: 52px; width: 100%; padding: 6px 16px !important; text-align: left; }
.pn button.row:hover { background: var(--add); }
.pn .row .lb { flex: 1; min-width: 0; display: flex; flex-direction: column; } .pn .row .lb span { font-size: 15px; line-height: 20px; font-weight: 500; }
.pn .row .lb small { font-size: 12px; line-height: 16px; color: var(--tx2); }
.pn .row .val { color: var(--tx2); font-size: 13px; }
.pn .row.sub { min-height: 44px; padding-left: 28px !important; } .pn .row.sub .lb span { font-size: 14px; font-weight: 400; }
/* v0.6.1: um cartão por recurso (ícone, título, uma frase, chave), opções em chips, partes avançadas recolhidas */
.pn .sec.cards { padding: 12px 12px 2px; border-bottom: 0; }
.feat { border: 1px solid var(--line); border-radius: 8px; margin: 0 0 10px; overflow: hidden; }
.feat.on { border-color: var(--hov); }
.feat .fh { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px !important; text-align: left; }
.feat .fh:hover { background: var(--add); }
.feat .fi { width: 36px; height: 36px; border-radius: 18px; flex: none; display: flex; align-items: center; justify-content: center; background: var(--accbg); color: var(--acc); }
.feat .fi svg { width: 20px; height: 20px; }
.feat .lb { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.feat .lb span { font-size: 15px; line-height: 20px; font-weight: 600; }
.feat .lb small { font-size: 12.5px; line-height: 17px; color: var(--tx2); }
.feat .fx { padding: 0 12px 12px 60px; }
.feat .fx .cont { margin: 0 0 10px; }
.feat .cg { margin: 0 0 10px; } .feat .cg:last-child { margin-bottom: 0; }
.feat .ct { display: block; margin: 0 0 6px; font-size: 12px; line-height: 16px; font-weight: 600; color: var(--tx3); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { display: inline-flex; align-items: center; gap: 4px; height: 30px; padding: 0 12px !important; border-radius: 15px; border: 1px solid var(--line) !important; font-size: 13px !important; font-weight: 500 !important; color: var(--tx2) !important; }
.chip:hover { background: var(--add); }
.chip svg { width: 14px; height: 14px; display: none; }
.chip[aria-checked=true] { background: var(--add); border-color: transparent !important; color: var(--tx) !important; }
.chip[aria-checked=true] svg { display: block; color: var(--acc); }
.feat .campo { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 13px; color: var(--tx2); }
.feat .campo input { height: 30px; padding: 0 8px; border-radius: 8px; border: 1px solid var(--line); background: transparent; color: var(--tx); font: inherit; }
.feat .dica { font-size: 12px; line-height: 16px; color: var(--tx2); }
.feat .ir { color: var(--acc); font-weight: 600 !important; font-size: 13px !important; padding: 2px 0 !important; }
.feat .ir:hover { text-decoration: underline; }
.dt { border-top: 1px solid var(--line); }
.dt > summary { list-style: none; display: flex; align-items: center; gap: 8px; padding: 12px 16px; font-size: 14px; font-weight: 600; cursor: pointer; }
.dt > summary::-webkit-details-marker { display: none; }
.dt > summary svg { width: 16px; height: 16px; color: var(--tx3); margin-left: auto; transition: transform .12s ease-out; }
.dt[open] > summary svg { transform: rotate(90deg); }
.dt > summary:hover { background: var(--add); }
.dt > .dc { padding: 0 0 10px; }
.pn .cont { margin: 0 16px 6px; padding: 8px 12px; border-radius: 8px; background: var(--accbg); font-size: 13px; line-height: 18px; }
.pn .cont b { color: var(--acc); font-weight: 700; }
.pn .vazio { padding: 16px; color: var(--tx2); font-size: 13px; line-height: 19px; }
.pn .lgh { display: flex; align-items: center; gap: 4px; padding: 8px 8px 4px 16px; }
.pn .lgh small { flex: 1; color: var(--tx3); font-size: 12px; line-height: 16px; }
.pn .lgh button { height: 28px; padding: 0 10px !important; border-radius: 14px; font-size: 13px !important; font-weight: 600 !important; color: var(--tx2); }
.pn .lgh button:hover { background: var(--add); color: var(--tx); }
.pn .lg { list-style: none; margin: 0; padding: 0 0 8px; }
.pn .lg li { display: flex; gap: 10px; padding: 5px 16px; font-size: 13px; line-height: 18px; }
.pn .lg li time { flex: none; color: var(--tx3); font-variant-numeric: tabular-nums; }
.pn .lg li.bad span { color: var(--err); }
`;

  const doisD = (n) => String(n).padStart(2, '0');
  const quando = (ms) => { const d = new Date(ms); return `${doisD(d.getDate())}/${doisD(d.getMonth() + 1)} ${doisD(d.getHours())}:${doisD(d.getMinutes())}`; };

  function abasDe(T) {
    return [{ id: 'rec', ordem: 0, rotulo: () => T.tabRec }].concat(reg.abas).concat([{ id: 'log', ordem: 999, rotulo: () => T.tabLog }]);
  }

  // st: { aba, msg: { t, bad } | null, log: [] }
  function html(ctx, st) {
    const T = ctx.T(), u = ctx.upd() || {}, nova = u.disponivel && u.ultima && C.cmpVer(u.ultima, ctx.VERSION) > 0;
    const abas = abasDe(T);
    if (!abas.some((a) => a.id === st.aba)) st.aba = 'rec';
    let corpo = '';
    if (st.aba === 'rec') {
      const secs = reg.secoes.map((s) => { try { const h = s.html(T, ctx); return h ? `<div data-s="${esc(s.id)}">${h}</div>` : ''; } catch (e) { return ''; } }).join('');
      corpo = `<div class="sec cards">${secs}</div>`;
    } else if (st.aba === 'log') {
      const l = (st.log || []).slice().reverse();
      corpo = `<div class="lgh"><small>${esc(T.logSub(l.length))}</small>
          <button type="button" data-log="copiar">${esc(T.logCopiar)}</button><button type="button" data-log="limpar">${esc(T.logLimpar)}</button></div>
        ${l.length ? `<ol class="lg">${l.map((e) => `<li class="${e.ok === false ? 'bad' : ''}"><time>${quando(e.em)}</time><span>${esc(DEF.linhaLog(T, e))}</span></li>`).join('')}</ol>` : `<div class="vazio">${esc(T.logVazio)}</div>`}`;
    } else {
      const a = reg.abas.find((x) => x.id === st.aba);
      try { corpo = `<div class="sec" data-a="${esc(a.id)}">${a.html(T, ctx) || ''}</div>`; } catch (_) { corpo = ''; }
    }
    return `<div class="pn" role="dialog" aria-label="Brasa">
      <div class="hd"><span class="ic">${ICO.app}</span><b>${esc(T.menu)}</b>
        <button type="button" class="tg" role="switch" aria-checked="${!!ctx.S.on}" data-act="on" aria-label="${esc(T['set.on'])}" title="${esc(T['set.on_'])}"><span>${esc(ctx.S.on ? T.on : T.off)}</span><span class="sw"></span></button></div>
      ${nova ? `<div class="ban${ctx.urgente() ? ' urg' : ''}"><span>${esc(ctx.urgente() ? T.bannerUrg(u.ultima) : T.banner(u.ultima))}</span><button type="button" class="lk" data-act="upd">${esc(T.updGo)}</button></div>` : ''}
      <div class="tabs" role="tablist">${abas.map((a) => `<button type="button" role="tab" data-aba="${esc(a.id)}" aria-selected="${a.id === st.aba}">${esc(a.rotulo(T))}</button>`).join('')}</div>
      <div class="sc">${corpo}</div>
      ${C.footerHtml(T, ctx.lang(), ctx.LANGS, ctx.VERSION, st.msg)}</div>`;
  }

  // quem desenha por último fica registrado: os módulos pedem redesenho quando os dados deles mudam
  let redesenhoAtual = null;
  const pedirRedesenho = () => { if (redesenhoAtual) { try { redesenhoAtual(); } catch (_) {} } };
  function wire(el, ctx, st, redesenhar) {
    redesenhoAtual = redesenhar;
    const T = ctx.T();
    if (st.aba === 'rec') for (const s of reg.secoes) { const d = el.querySelector(`[data-s="${s.id}"]`); if (d && s.wire) { try { s.wire(d, ctx); } catch (e) { console.warn('[Brasa]', e); } } }
    const a = reg.abas.find((x) => x.id === st.aba);
    if (a && a.wire) { const d = el.querySelector(`[data-a="${a.id}"]`); if (d) { try { a.wire(d, ctx); } catch (e) { console.warn('[Brasa]', e); } } }
    ligarRecolhe(el);
    el.querySelectorAll('.tabs [data-aba], [data-ir-aba]').forEach((b) => b.addEventListener('click', async () => {
      st.aba = b.dataset.aba || b.dataset.irAba; st.msg = null;
      if (st.aba === 'log') st.log = await ctx.lerLog();
      if (ctx.lembrarAba) ctx.lembrarAba(st.aba);
      redesenhar();
    }));
    el.querySelectorAll('[data-act]').forEach((x) => x.addEventListener('click', (e) => { e.preventDefault(); ctx.acao(x.dataset.act, x); }));
    el.querySelectorAll('.foot .langs button').forEach((x) => x.addEventListener('click', () => ctx.setLang(x.dataset.l)));
    const cp = el.querySelector('[data-log="copiar"]');
    if (cp) cp.addEventListener('click', async () => {
      const txt = (st.log || []).map((e) => `${quando(e.em)}  ${e.ok === false ? '✗ ' : ''}${DEF.linhaLog(T, e)}`).join('\n');
      const ok = await ctx.copiar(txt);
      if (ok) ctx.toast(T.logCopiado);
    });
    // chaves genéricas: <button data-aj="chave" role="switch">
    el.querySelectorAll('[data-aj]').forEach((b) => b.addEventListener('click', async (e) => {
      e.preventDefault();
      const k = b.dataset.aj, novo = !ctx.S[k];
      await ctx.setAj(k, novo);
      DEF.logar('chave', [T['set.' + k] || k, novo]);
      redesenhar();
    }));
    const lp = el.querySelector('[data-log="limpar"]');
    if (lp) lp.addEventListener('click', async () => { await ctx.limparLog(); st.log = []; ctx.toast(T.logLimpo); redesenhar(); });
  }

  // linha com chave: título T['set.k'] e linha de baixo T['set.k_']; sub = true deixa recuada (opção dentro de um recurso)
  const linha = (T, ctx, k, sub) => `<button type="button" class="row${sub ? ' sub' : ''}" role="switch" aria-checked="${!!ctx.S[k]}" data-aj="${esc(k)}">
    <span class="lb"><span>${esc(T['set.' + k] || k)}</span>${T['set.' + k + '_'] ? `<small>${esc(T['set.' + k + '_'])}</small>` : ''}</span><span class="sw"></span></button>`;
  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
  // cartão de um recurso: a linha de cima é a chave (clicar em qualquer lugar liga/desliga); extra = opções quando ligado
  const cartao = (ctx, k, icone, titulo, desc, extra) => `<div class="feat${ctx.S[k] ? ' on' : ''}" data-feat="${esc(k)}">
    <button type="button" class="fh" role="switch" aria-checked="${!!ctx.S[k]}" data-aj="${esc(k)}"><span class="fi">${icone}</span>
      <span class="lb"><span>${esc(titulo)}</span><small>${esc(desc)}</small></span><span class="sw"></span></button>
    ${ctx.S[k] && extra ? `<div class="fx">${extra}</div>` : ''}</div>`;
  const chip = (T, ctx, k, rotulo) => `<button type="button" class="chip" role="switch" aria-checked="${!!ctx.S[k]}" data-aj="${esc(k)}">${CHECK}${esc(rotulo || T['set.' + k] || k)}</button>`;
  const grupo = (titulo, conteudo) => `<div class="cg"><span class="ct">${esc(titulo)}</span><div class="chips">${conteudo}</div></div>`;
  // parte recolhível (o aberto/fechado fica guardado enquanto a página estiver aberta)
  const abertos = new Set();
  const recolhe = (id, titulo, conteudo) => `<details class="dt" data-dt="${esc(id)}"${abertos.has(id) ? ' open' : ''}><summary>${esc(titulo)}${C.ICO.chev}</summary><div class="dc">${conteudo}</div></details>`;
  const ligarRecolhe = (el) => el.querySelectorAll('details[data-dt]').forEach((d) => d.addEventListener('toggle', () => { if (d.open) abertos.add(d.dataset.dt); else abertos.delete(d.dataset.dt); }));
  globalThis.BRASA_MENU = { CSS, reg, addSecao, addAba, html, wire, quando, linha, pedirRedesenho, cartao, chip, grupo, recolhe, ligarRecolhe };
})();
