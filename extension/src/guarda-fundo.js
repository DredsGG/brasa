// Brasa — guarda-foguinho no fundo (service worker; carregado pelo sw.js com importScripts).
// Quando: alarme no horário principal (19:00) e no de reserva (22:00), conferência a cada 15 min (cobre o PC que acordou depois do
// horário e o alarme atrasado) e 1 min depois de o navegador abrir. Os alarmes são recriados a cada partida do service worker.
// Como: abre tiktok.com/messages numa JANELA MINIMIZADA própria (plano B: aba inativa; plano C: se a página não responder, traz a
// janela à frente por instantes e devolve o foco), manda uma conversa por vez para o content script (src/guarda.js), espera a
// resposta, pausa 20–90 s entre conversas, respeita 1 mensagem por conversa por dia e 20 por dia, fecha a janela no fim (ou se
// passar 3 min sem progresso) e avisa por notificação. Enquanto roda, br.envio segura a recarga automática da pasta.
(() => {
  const ext = globalThis.chrome, DEF = globalThis.BRASA_DEF, G = globalThis.BRASA_GUARDA, I = globalThis.BRASA_I18N;
  if (!ext || !DEF || !G) return;
  const K = DEF.K;
  const URL_MSGS = 'https://www.tiktok.com/messages#brasa-guarda';
  const get = async (k) => (await ext.storage.local.get(k))[k];
  const set = (o) => ext.storage.local.set(o);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const T = async () => { const aj = (await get(K.aj)) || {}; const l = I && I.LANGS.includes(aj.lang) ? aj.lang : I ? I.detect() : 'pt'; return I ? (I.T[l] || I.T.en) : null; };
  const ajustes = async () => Object.assign({}, DEF.AJ, (await get(K.aj)) || {});
  const cmpVer = (a, b) => { const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number); for (let i = 0; i < 4; i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d > 0 ? 1 : -1; } return 0; };
  async function pausada() {
    const aj = await ajustes(); if (!aj.on || !aj.guarda) return true;
    const u = (await get(K.update)) || {};
    return !!(u.disponivel && u.urgente && u.ultima && cmpVer(u.ultima, ext.runtime.getManifest().version) > 0); // URGENTE pausa (regra 14d)
  }

  // ───────────────────────── alarmes ─────────────────────────
  async function agendar() {
    const aj = await ajustes(), agora = Date.now();
    const p1 = G.proximo(aj.guardaH1, agora), p2 = G.proximo(aj.guardaH2, agora);
    if (p1) ext.alarms.create('br-g1', { when: p1, periodInMinutes: 1440 });
    if (p2) ext.alarms.create('br-g2', { when: p2, periodInMinutes: 1440 });
    ext.alarms.create('br-gconf', { delayInMinutes: 15, periodInMinutes: 15 });
  }
  ext.alarms.onAlarm.addListener((a) => {
    if (a.name === 'br-g1' || a.name === 'br-g2' || a.name === 'br-gconf' || a.name === 'br-gstart') conferir(a.name);
  });
  ext.storage.onChanged.addListener((ch, area) => {
    if (area !== 'local' || !ch[K.aj]) return;
    const o = ch[K.aj].oldValue || {}, n = ch[K.aj].newValue || {};
    if (o.guardaH1 !== n.guardaH1 || o.guardaH2 !== n.guardaH2) agendar();
  });
  ext.runtime.onStartup.addListener(() => { ext.alarms.create('br-gstart', { delayInMinutes: 1 }); });
  ext.runtime.onInstalled.addListener(() => agendar());
  // recria a cada partida do service worker
  ext.alarms.getAll().then((l) => { const n = l.map((x) => x.name); if (!n.includes('br-g1') || !n.includes('br-g2') || !n.includes('br-gconf')) agendar(); }, () => agendar());

  // conversas com a marcação vinda da chave própria (br.fog.marcadas); a coleta da página nunca mexe nela
  async function convsMarcadas() {
    const c = (await get(K.fogConvs)) || {}, m = (await get(K.fogMarcadas)) || {};
    const out = {};
    for (const id of new Set(Object.keys(c).concat(Object.keys(m)))) out[id] = Object.assign({}, c[id] || {}, { marcada: !!m[id] });
    return out;
  }
  // ───────────────────────── conferência ─────────────────────────
  async function conferir(origem) {
    if (await pausada()) return { pulado: 'pausada' };
    const convs = await convsMarcadas(), dia = await get(K.fogDia), aj = await ajustes();
    const { fila, vagas } = G.planejar(convs, dia, Date.now());
    if (!G.deveRodar(Date.now(), { h1: aj.guardaH1, h2: aj.guardaH2 }, dia, fila.length > 0 && vagas > 0)) return { pulado: 'cedo-ou-vazio', fila: fila.length };
    return rodar({ ensaio: false, origem });
  }

  // ───────────────────────── a rodada ─────────────────────────
  let rodandoAqui = false;
  async function emAndamento() {
    if (rodandoAqui) return true;
    const r = await get(K.fogRun);
    return !!(r && r.pulso && Date.now() - r.pulso < 3 * 60e3);
  }
  const pulso = async (r) => { r.pulso = Date.now(); await set({ [K.fogRun]: r, [K.envio]: { ate: Date.now() + 5 * 60e3, desde: r.inicio } }); };
  async function abrirJanela() {
    let janela = null, aba = null, modo = 'janela';
    // abre vazia e navega depois: a página só carrega com a janela já pronta (e o navegador já sabe que ela é desta extensão)
    try {
      const w = await ext.windows.create({ url: 'about:blank', state: 'minimized', focused: false });
      janela = w.id; aba = w.tabs && w.tabs[0] && w.tabs[0].id;
    } catch (_) {}
    if (aba == null) { // plano B: aba inativa na janela atual
      modo = 'aba';
      const t = await ext.tabs.create({ url: 'about:blank', active: false });
      aba = t.id; janela = t.windowId;
    }
    await wait(400);
    await ext.tabs.update(aba, { url: URL_MSGS });
    return { janela, aba, modo };
  }
  // só fecha se a aba ainda for a do guarda (tiktok.com/messages); depois de reiniciar o navegador os ids se repetem
  async function fechar(r) {
    try {
      if (r.aba == null) return;
      const t = await ext.tabs.get(r.aba).catch(() => null);
      if (!t || !/^https:\/\/www\.tiktok\.com\/(messages|login)|^about:blank/.test(t.url || t.pendingUrl || '')) return;
      if (r.modo === 'janela' && t.windowId === r.janela) { const w = await ext.windows.get(r.janela, { populate: true }); if (w.tabs.length === 1) { await ext.windows.remove(r.janela); return; } }
      await ext.tabs.remove(r.aba);
    } catch (_) {}
  }
  // plano C: a página não responde (aba congelada pelo navegador) → traz a janela à frente por instantes e devolve o foco
  async function acordar(r) {
    try {
      const antes = await ext.windows.getLastFocused().catch(() => null);
      await ext.windows.update(r.janela, { state: 'normal', focused: true });
      if (r.modo === 'aba') await ext.tabs.update(r.aba, { active: true });
      await wait(2500);
      if (r.modo === 'janela') await ext.windows.update(r.janela, { state: 'minimized' });
      if (antes && antes.id !== r.janela) await ext.windows.update(antes.id, { focused: true }).catch(() => {});
      DEF.logar('fogAcordou', []);
    } catch (_) {}
  }
  const mandar = (aba, msg, ms) => Promise.race([ext.tabs.sendMessage(aba, Object.assign({ type: 'brasa:guarda-cmd' }, msg)), wait(ms).then(() => null)]).catch(() => null);
  async function pronta(r) {
    for (let k = 0; k < 2; k++) {
      const fim = Date.now() + (k ? 20000 : 30000);
      while (Date.now() < fim) {
        const p = await mandar(r.aba, { cmd: 'ping' }, 3000);
        if (p && p.ok && p.lista) return true;
        await wait(1500);
      }
      if (k === 0) await acordar(r);
    }
    return false;
  }
  async function umaConversa(r, conv, frase) {
    const msg = { cmd: 'conversa', conv, frase, ensaio: r.ensaio };
    let resp = null;
    const p = mandar(r.aba, msg, 150000);
    // enquanto espera: mantém o service worker acordado; a cada 30 s confere se a página ainda responde (ping) e só traz a janela
    // à frente (plano C) se ela NÃO responder — nunca no meio de um processamento normal, uma vez por rodada
    const t0 = Date.now();
    let ultimoPing = t0;
    while (!resp) {
      const x = await Promise.race([p, wait(5000).then(() => 'tique')]);
      if (x !== 'tique') { resp = x || { res: 'falhou', motivo: 'semResposta' }; break; }
      await pulso(r); await ext.runtime.getPlatformInfo();
      if (Date.now() - ultimoPing > 30000) {
        ultimoPing = Date.now();
        const pg = await mandar(r.aba, { cmd: 'ping' }, 4000);
        if (!pg && !r.acordou) { r.acordou = true; await acordar(r); }
      }
    }
    return resp;
  }
  async function rodar({ ensaio, origem }) {
    // trava SÍNCRONA, antes de qualquer await: alarme + conferência + "Mandar agora" juntos não abrem duas rodadas
    if (rodandoAqui) return { erro: 'ocupado' };
    rodandoAqui = true;
    let r = null;
    try {
      const r0 = await get(K.fogRun);
      if (r0 && r0.pulso && Date.now() - r0.pulso < 3 * 60e3) { rodandoAqui = false; return { erro: 'ocupado' }; }
      if (await pausada()) { rodandoAqui = false; return { erro: 'pausada' }; }
    } catch (e) { rodandoAqui = false; throw e; }
    const t = await T(), aj = await ajustes();
    const convs = await convsMarcadas();
    const inicio = Date.now();
    const doDia = async () => G.estadoDoDia(await get(K.fogDia), inicio); // a rodada conta no dia em que começou (meia-noite no meio)
    let dia = await doDia();
    // ensaio: todas as marcadas (até 20), sem gravar nada no dia; de verdade: só quem falta hoje (o teto é por envio, conferido a cada conversa)
    const fila = ensaio ? Object.keys(convs).filter((id) => convs[id].marcada).slice(0, G.TETO_DIA) : G.planejar(convs, dia, inicio).fila;
    if (!fila.length) { rodandoAqui = false; return { nada: true }; }
    r = { inicio, dia: dia.dia, ensaio: !!ensaio, origem: origem || 'manual', fila, i: 0, pulso: Date.now() };
    await pulso(r);
    DEF.logar('fogInicio', [ensaio ? 'ensaio' : origem || 'manual', fila.length]);
    const res = { mandou: 0, falhou: [], pulou: 0, avisos: [] };
    try {
      Object.assign(r, await abrirJanela());
      await pulso(r);
      if (!(await pronta(r))) {
        if (!ensaio) { dia = await doDia(); for (const id of fila) dia.convs[id] = { res: 'falhou', motivo: 'paginaNaoAbriu', em: Date.now() }; await set({ [K.fogDia]: dia }); }
        for (const id of fila) res.falhou.push((convs[id] || {}).apelido || '?');
        DEF.logar('fogPagina', [], false);
      } else {
        const ultimas = (await get(K.fogUltima)) || {};
        const lista = (await get(K.fogFrases)) || G.FRASES_PT;
        const fraseRodada = aj.guardaMesma ? G.sortearFrase(lista, null) : null;
        for (let i = 0; i < fila.length; i++) {
          r.i = i; await pulso(r);
          if (await pausada()) break;
          const id = fila[i], apelido = (convs[id] || {}).apelido || '?';
          if (!ensaio) {
            dia = await doDia();
            if ((dia.enviadas || 0) >= G.TETO_DIA) { DEF.logar('fogTeto', [G.TETO_DIA], false); break; }
            if (dia.convs[id] && G.FINAL.includes(dia.convs[id].res)) continue; // resolvida por outra rodada nesse meio-tempo
            if (!(((await get(K.fogMarcadas)) || {})[id])) continue; // desmarcada durante a rodada
          }
          const frase = fraseRodada || G.sortearFrase(lista, ultimas[id]);
          const out = await umaConversa(r, id, frase);
          DEF.logar('guarda', [apelido, out.res, out.motivo || ''], out.res !== 'falhou');
          if (out.res === 'mandou' || out.res === 'ensaio') { if (out.res === 'mandou') { res.mandou++; ultimas[id] = frase; await set({ [K.fogUltima]: ultimas }); } }
          else if (out.res === 'falhou') res.falhou.push(apelido);
          else { res.pulou++; if (out.res === 'naoMandou') res.avisos.push(t ? t.fogAvisoApagou(apelido) : apelido); }
          if (out.res === 'desmarcou') { if (!ensaio) await DEF.marcar(id, false); res.avisos.push(t ? t.fogAvisoRestaurar(apelido) : apelido); }
          if (!ensaio) {
            dia = await doDia();
            dia.convs[id] = { res: out.res, motivo: out.motivo || '', em: Date.now() };
            if (out.res === 'mandou') dia.enviadas = (dia.enviadas || 0) + 1;
            await set({ [K.fogDia]: dia });
          }
          if (i < fila.length - 1) {
            const agiu = out.res === 'mandou' || out.res === 'ensaio';
            const min = Math.max(0, +aj.guardaPausaMin || 0), max = Math.max(min, +aj.guardaPausaMax || 0);
            const ms = agiu ? Math.round((min + Math.random() * (max - min)) * 1000) : 3000;
            const fimP = Date.now() + ms;
            while (Date.now() < fimP) { await wait(Math.min(5000, fimP - Date.now())); await pulso(r); await ext.runtime.getPlatformInfo(); }
          }
        }
      }
    } catch (e) {
      DEF.logar('fogErro', [String(e && e.message || e).slice(0, 80)], false);
    } finally {
      await fechar(r);
      // "Mandar agora" não gasta a rodada das 19:00 nem a da reserva
      if (!ensaio && origem !== 'agora') { dia = await doDia(); dia.rodadas = (dia.rodadas || 0) + 1; await set({ [K.fogDia]: dia }); }
      await ext.storage.local.remove([K.fogRun, K.envio]);
      rodandoAqui = false;
      DEF.logar('fogFim', [ensaio ? 'ensaio' : 'real', res.mandou, res.falhou.length], !res.falhou.length);
      avisar(t, ensaio, res);
    }
    return { ok: true, res };
  }
  function avisar(t, ensaio, res) {
    if (!t || !ext.notifications) return;
    const linhas = [ensaio ? t.fogNotEnsaio : t.fogNotTitulo(res.mandou)];
    if (res.falhou.length) linhas.push(t.fogNotFalhas(res.falhou.slice(0, 5).join(', ')));
    for (const a of res.avisos.slice(0, 3)) linhas.push(a);
    try { ext.notifications.create('brasa-guarda-' + Date.now(), { type: 'basic', iconUrl: ext.runtime.getURL('icons/icon-128.png'), title: 'Brasa', message: linhas.join('\n'), priority: 0 }); } catch (_) {}
  }
  // vigia: rodada que parou de dar sinal (service worker morreu no meio) → fecha a janela e libera
  async function vigiar() {
    const r = await get(K.fogRun);
    if (r && r.pulso && Date.now() - r.pulso > 3 * 60e3 && !rodandoAqui) { await fechar(r); await ext.storage.local.remove([K.fogRun, K.envio]); DEF.logar('fogTravou', [], false); }
  }
  ext.alarms.onAlarm.addListener((a) => { if (a.name === 'br-gconf') vigiar(); });

  ext.runtime.onMessage.addListener((msg, sender, responder) => {
    if (!msg || msg.type !== 'brasa:guarda') return;
    const c = msg.cmd;
    // "agora" e "ensaio" respondem logo (a rodada segue sozinha); o resto responde no fim
    if (c === 'agora' || c === 'ensaio') {
      (async () => {
        if (rodandoAqui || await emAndamento()) return responder({ erro: 'ocupado' });
        if (await pausada()) return responder({ erro: 'pausada' });
        const convs = await convsMarcadas();
        const pl = G.planejar(convs, await get(K.fogDia), Date.now());
        const n = c === 'ensaio' ? Object.values(convs).filter((x) => x.marcada).length : pl.vagas > 0 ? pl.fila.length : 0;
        if (!n) return responder({ nada: true });
        responder({ ok: true, fila: n });
        rodar({ ensaio: c === 'ensaio', origem: c }).catch(() => {});
      })();
      return true;
    }
    const run = c === 'conferir' ? conferir('teste') : c === 'agendar' ? agendar().then(() => ({ ok: true }))
      : c === 'abrirMensagens' ? ext.tabs.create({ url: 'https://www.tiktok.com/messages' }).then(() => ({ ok: true }))
      : c === 'pedirFechado' ? ext.tabs.create({ url: ext.runtime.getURL('popup/popup.html?aba=fog') }).then(() => ({ ok: true }))
      : Promise.resolve({});
    run.then((x) => responder(x || {}), (e) => responder({ erro: String(e && e.message || e) }));
    return true;
  });
  globalThis.__brasaGuarda = { conferir, rodar, agendar, vigiar, convsMarcadas };
})();
