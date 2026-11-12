// Brasa — mundo MAIN (o da página), em document_start. Único lugar que vê as respostas que o próprio TikTok baixa.
//  - Gancho em fetch e XMLHttpRequest: lê as respostas do feed (…/item_list/ e /api/item/detail/) e guarda os itens SÓ EM MEMÓRIA
//    (somem ao recarregar a aba; nada vai para storage nem para a rede). A fase 1 usa o mesmo ponto para tirar anúncio, LIVE e loja
//    da lista ANTES de o site desenhar.
//  - Navegação interna (SPA): history.pushState/replaceState e popstate.
//  - Conversa com o content script (mundo isolado) por eventos no document, com JSON em texto:
//      pedido:   'brasa:c'  { id, op, args }
//      resposta: 'brasa:e'  { id, type: 'res', data }   ·   avisos: { type: 'main-ready' | 'nav' | 'feed', data }
// O gancho de rede é instalado UMA vez por página (window.__brasaHook); uma versão nova reinjetada só troca o "tratador",
// assim não se empilham ganchos. Mapa medido: Jarvis/02-projetos/extensoes/role/brasa-engenharia-reversa.md
(() => {
  'use strict';
  const H = window.__brasaHook || (window.__brasaHook = { tratador: null, nav: null, instalado: false });
  if (typeof H.parar === 'function') { try { H.parar(); } catch (_) {} } // instância única: a nova desliga a velha
  let dead = false;
  const emit = (type, data, id) => { if (!dead) document.dispatchEvent(new CustomEvent('brasa:e', { detail: JSON.stringify({ type, data, id }) })); };

  // ───────────────────────── memória dos itens vistos (só nesta aba) ─────────────────────────
  const MAX = 600;
  const ITENS = new Map(); // id → item como veio do TikTok
  const stats = { respostas: 0, itens: 0, porRota: {}, ultima: 0, erros: 0 };
  // rotas medidas em 2026-11-11 (sem login): /api/recommend/item_list/ (Para você), /api/preload/item_list/,
  // /api/prefetch/explore/item_list/; com login entram /api/following/item_list/ e outras do mesmo formato (inferido).
  const FEED_RE = /\/api\/(?:[a-z0-9_]+\/){1,3}item_list\/?|\/api\/item\/detail\/?/i;
  const rotaDe = (url) => { const m = String(url).match(/\/api\/((?:[a-z0-9_]+\/){1,3})item_list|\/api\/(item\/detail)/i); return m ? (m[1] || m[2] || '').replace(/\/$/, '') : '?'; };
  function guardar(it) {
    if (!it || typeof it !== 'object' || !it.id) return;
    const id = String(it.id);
    if (ITENS.has(id)) ITENS.delete(id);
    ITENS.set(id, it);
    if (ITENS.size > MAX) ITENS.delete(ITENS.keys().next().value);
  }
  function itensDe(j) {
    if (!j || typeof j !== 'object') return null;
    if (Array.isArray(j.itemList)) return j.itemList;
    if (j.itemInfo && j.itemInfo.itemStruct) return [j.itemInfo.itemStruct];
    return null;
  }

  // ───────────────────────── modo foco (fase 1): o que é anúncio, LIVE e loja ─────────────────────────
  // Os mesmos campos que o PRÓPRIO TikTok usa para classificar (medido no código do site em 2026-11-11):
  //   anúncio: ad_info || isAd || isTT4BAds · LIVE: containerType === 2 (CONTAINERTYPE_LIVE) ou liveRoomInfo ·
  //   loja: isECVideo > 0 ou âncora de produto tipo 33 (AnchorTypes ou anchors[].type)
  function tipoDe(it) {
    if (!it || typeof it !== 'object') return null;
    if (it.ad_info || it.isAd === true || it.isTT4BAds) return 'anuncio';
    if (it.containerType === 2 || it.liveRoomInfo || it.live_room_info) return 'live';
    const a33 = (l) => Array.isArray(l) && l.some((a) => String(a && typeof a === 'object' ? a.type : a) === '33');
    if (Number(it.isECVideo) > 0 || a33(it.AnchorTypes) || a33(it.anchors)) return 'loja';
    return null;
  }
  // só os feeds (Para você e Seguindo); perfil, busca e Explorar ficam como o site manda
  // v1.0.1: "friends" (a rota do Amigos é /api/friends/item_list/; antes só casava "friend") e "related" (Você pode gostar / página de vídeo)
  const ROTAS_FOCO = /^(recommend|preload|following|friends?|related)$/;
  // ajustes que chegam do content script; até chegarem, os de fábrica (modo foco ligado, os três filtros ligados)
  let cfg = { ativo: true, foco: true, anuncio: true, live: true, loja: true };
  let cfgOk = false, cfgEspera = null;
  const cfgPronto = new Promise((ok) => { cfgEspera = ok; });

  // ───────────────────────── tratador (troca a cada versão reinjetada) ─────────────────────────
  // tratar(url, json) → { json, mudou }. Síncrono (o XHR precisa da resposta na hora).
  function tratar(url, j) {
    const lista = itensDe(j);
    if (!lista) return { json: j, mudou: false };
    const rota = rotaDe(url);
    for (const it of lista) guardar(it);
    stats.respostas++; stats.itens += lista.length; stats.ultima = Date.now();
    stats.porRota[rota] = (stats.porRota[rota] || 0) + 1;
    let fora = [];
    if (cfg.ativo && cfg.foco && ROTAS_FOCO.test(rota) && Array.isArray(j.itemList)) {
      const fica = [];
      for (const it of j.itemList) { const t = tipoDe(it); if (t && cfg[t]) fora.push({ id: String(it.id), tipo: t }); else fica.push(it); }
      if (fora.length) j = Object.assign({}, j, { itemList: fica });
    }
    emit('feed', { rota, n: lista.length, total: ITENS.size });
    if (fora.length) { stats.tirados = (stats.tirados || 0) + fora.length; emit('filtrado', { rota, itens: fora }); }
    return { json: j, mudou: fora.length > 0 };
  }
  // o fetch espera os ajustes chegarem (no máximo 1 s) antes de tratar a primeira resposta
  const antes = () => (cfgOk ? null : Promise.race([cfgPronto, new Promise((r) => setTimeout(r, 1000))]));
  H.tratador = { quer: (url) => FEED_RE.test(String(url || '')), tratar, antes };
  // fase 2: sequência (foguinho) nos pacotes das DMs — src/proto.js (formato medido no código do site em 2026-11-11)
  const P = window.BRASA_PROTO;
  const vistasSeq = new Map(); // conv → "dias:inicio" (não repete o mesmo aviso)
  H.bin = P ? (origem, ab) => {
    const u8 = new Uint8Array(ab);
    if (u8.length > 3e6) return;
    const tarefa = origem === 'ws' ? P.acharSequenciasTudo(u8) : Promise.resolve(P.acharSequencias(u8));
    tarefa.then((l) => {
      for (const s of l) {
        const k = s.dias + ':' + s.inicio + ':' + s.restauravelAte;
        if (vistasSeq.get(s.conv) === k) continue;
        vistasSeq.set(s.conv, k);
        stats.sequencias = (stats.sequencias || 0) + 1;
        emit('sequencia', s);
      }
    }, () => {});
  } : null;

  // ───────────────────────── ganchos de rede (uma vez por página) ─────────────────────────
  if (!H.instalado) {
    H.instalado = true;
    const urlDe = (a) => { try { return typeof a === 'string' ? a : a instanceof Request ? a.url : String(a && a.href || a || ''); } catch (_) { return ''; } };
    const origFetch = window.fetch;
    window.fetch = async function (...args) {
      const res = await origFetch.apply(this, args);
      const t = H.tratador;
      try {
        const url = res.url || urlDe(args[0]);
        if (!t || !t.quer(url) || !res.ok) return res;
        const txt = await res.clone().text();
        let j; try { j = JSON.parse(txt); } catch (_) { return res; }
        if (t.antes) { const w = t.antes(); if (w) await w; }
        const r = (H.tratador || t).tratar(url, j);
        if (!r || !r.mudou) return res;
        const novo = new Response(JSON.stringify(r.json), { status: res.status, statusText: res.statusText, headers: res.headers });
        try { Object.defineProperty(novo, 'url', { value: res.url }); } catch (_) {}
        return novo;
      } catch (_) { return res; }
    };
    const XO = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      const xhr = this;
      xhr.__brUrl = String(url || '');
      if (!xhr.__brOuvindo) {
        xhr.__brOuvindo = true;
        // registrado no open, antes dos ouvintes do site: troca a resposta no estado 4, antes de o site ler
        xhr.addEventListener('readystatechange', () => {
          if (xhr.readyState !== 4) return;
          // fase 2: pacotes binários das DMs (protobuf) → procura a sequência (só leitura)
          try { if (H.bin && /im-api[^/]*\.tiktok\.com/.test(xhr.__brUrl) && xhr.response instanceof ArrayBuffer) H.bin('xhr', xhr.response); } catch (_) {}
          const t = H.tratador;
          try {
            if (!t || !t.quer(xhr.__brUrl) || xhr.status < 200 || xhr.status >= 300) return;
            let j;
            if (xhr.responseType === '' || xhr.responseType === 'text') { try { j = JSON.parse(xhr.responseText); } catch (_) { return; } }
            else if (xhr.responseType === 'json') j = xhr.response;
            else return;
            const r = t.tratar(xhr.__brUrl, j);
            if (!r || !r.mudou) return;
            const txt = JSON.stringify(r.json);
            Object.defineProperty(xhr, 'responseText', { configurable: true, get: () => txt });
            Object.defineProperty(xhr, 'response', { configurable: true, get: () => (xhr.responseType === 'json' ? r.json : txt) });
          } catch (_) {}
        });
      }
      return XO.call(this, method, url, ...rest);
    };
    // websocket das DMs: lê a mensagem no momento em que o próprio site lê event.data (a conexão não muda)
    try {
      const d = Object.getOwnPropertyDescriptor(MessageEvent.prototype, 'data');
      const vistos = new WeakSet();
      if (d && d.get) Object.defineProperty(MessageEvent.prototype, 'data', { configurable: true, enumerable: d.enumerable, get() {
        const v = d.get.call(this);
        try {
          if (H.bin && !vistos.has(this)) {
            const alvo = this.currentTarget || this.target;
            if (alvo instanceof WebSocket && /im-ws/.test(alvo.url)) { vistos.add(this); if (v instanceof ArrayBuffer) H.bin('ws', v.slice(0)); else if (v instanceof Blob) v.arrayBuffer().then((ab) => H.bin && H.bin('ws', ab), () => {}); }
          }
        } catch (_) {}
        return v;
      } });
    } catch (_) {}
    // navegação interna
    for (const fn of ['pushState', 'replaceState']) {
      const orig = history[fn];
      history[fn] = function (...a) { const r = orig.apply(this, a); try { if (H.nav) H.nav(fn); } catch (_) {} return r; };
    }
  }

  // ───────────────────────── navegação interna ─────────────────────────
  let ultimaUrl = location.pathname + location.search;
  function onNav(fonte) {
    const u = location.pathname + location.search;
    if (u === ultimaUrl) return;
    ultimaUrl = u;
    emit('nav', { path: location.pathname, fonte });
  }
  H.nav = onNav;
  const onPop = () => onNav('popstate');
  addEventListener('popstate', onPop);

  // ───────────────────────── dados que vêm dentro do HTML (página de vídeo aberta direto) ─────────────────────────
  function lerInicial() {
    try {
      const s = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
      if (!s) return;
      const d = JSON.parse(s.textContent || '{}'), sc = d.__DEFAULT_SCOPE__ || {};
      const det = sc['webapp.video-detail'];
      if (det && det.itemInfo && det.itemInfo.itemStruct) tratar('/api/item/detail/', det);
      // medido em 2026-11-11: o 1º vídeo do Para você vem embutido em 'webapp.foryou.video' (não passa pela API).
      // Guarda qualquer item embutido (objeto com id, video e author), sem filtrar (o plano B do modo foco cuida dele).
      const achados = [];
      const varre = (o, prof) => {
        if (!o || typeof o !== 'object' || prof > 7 || achados.length > 60) return;
        if (Array.isArray(o)) { for (const x of o) varre(x, prof + 1); return; }
        if (o.id && o.video && o.author && typeof o.video === 'object') { achados.push(o); return; }
        for (const k of Object.keys(o)) if (k !== 'webapp.i18n-translation') varre(o[k], prof + 1);
      };
      for (const k of Object.keys(sc)) if (k !== 'webapp.video-detail') varre(sc[k], 0);
      if (achados.length) tratar('/api/inicial/item_list/', { itemList: achados });
    } catch (_) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lerInicial, { once: true }); else lerInicial();

  // ───────────────────────── pedidos do content script ─────────────────────────
  const resumo = (it) => it && {
    id: String(it.id), desc: String(it.desc || '').slice(0, 300), criado: it.createTime || 0,
    autor: it.author ? { uniqueId: it.author.uniqueId || '', nickname: it.author.nickname || '' } : null,
    foto: !!it.imagePost, video: !!(it.video && (it.video.playAddr || it.video.PlayAddrStruct)),
    // v0.6.5 (Auto curtir/seguir): o que a resposta do TikTok diz na hora em que chegou. digged = já curtido;
    // author.relation (enum UserRelation do código do site): -1 desconhecido, 0 não segue, 1 segue, 2 amigos, outros = pedido/bloqueio
    curtido: typeof it.digged === 'boolean' ? it.digged : null,
    relacao: it.author && typeof it.author.relation === 'number' ? it.author.relation : null,
  };
  const OPS = {
    ping: () => ({ ok: true, itens: ITENS.size }),
    stats: () => Object.assign({}, stats, { emMemoria: ITENS.size, cfg }),
    item: (id) => resumo(ITENS.get(String(id))) || null,
    // fase 1: ajustes do modo foco e o tipo de um item já visto (plano B do content script)
    cfg: (c) => { if (c && typeof c === 'object') { cfg = Object.assign({}, cfg, c); cfgOk = true; cfgEspera(); } return cfg; },
    tipo: (id) => tipoDe(ITENS.get(String(id))),
    // fase 3: endereços de mídia de um item já visto (medido em 2026-11-11: playAddr e bitrateInfo sem marca d'água, com som;
    // downloadAddr COM marca d'água — fica de fora)
    midia: (id) => {
      const it = ITENS.get(String(id));
      if (!it) return null;
      const v = it.video || {}, ip = it.imagePost;
      const versoes = [];
      for (const b of v.bitrateInfo || []) {
        const pa = b && b.PlayAddr, url = pa && Array.isArray(pa.UrlList) && pa.UrlList.find((u) => /^https:/.test(u));
        if (url) versoes.push({ url, codec: String(b.CodecType || ''), w: pa.Width || 0, h: pa.Height || 0, tam: pa.DataSize || 0 });
      }
      if (v.playAddr && /^https:/.test(v.playAddr)) versoes.push({ url: v.playAddr, codec: String(v.codecType || 'h264'), w: v.width || 0, h: v.height || 0, tam: 0, play: true });
      return {
        id: String(it.id), criado: it.createTime || 0, autor: it.author ? String(it.author.uniqueId || it.author.nickname || '') : '',
        versoes, capa: v.originCover || v.cover || (ip && ip.cover && ip.cover.imageURL && ip.cover.imageURL.urlList && ip.cover.imageURL.urlList[0]) || null,
        fotos: ip && Array.isArray(ip.images) ? ip.images.map((im) => im && im.imageURL && im.imageURL.urlList && im.imageURL.urlList[0]).filter(Boolean) : [],
      };
    },
  };
  H.OPS = OPS; // as fases seguintes acrescentam operações aqui
  const onCmd = (e) => {
    let m; try { m = JSON.parse(e.detail); } catch (_) { return; }
    if (!m || typeof m.op !== 'string' || !Object.prototype.hasOwnProperty.call(OPS, m.op)) return;
    let data; try { data = OPS[m.op].apply(null, Array.isArray(m.args) ? m.args : []); } catch (err) { data = { erro: String(err && err.message || err) }; }
    emit('res', data, m.id);
  };
  document.addEventListener('brasa:c', onCmd);

  H.parar = () => {
    dead = true;
    document.removeEventListener('brasa:c', onCmd);
    removeEventListener('popstate', onPop);
    if (H.tratador && H.tratador.tratar === tratar) H.tratador = null;
    if (H.nav === onNav) H.nav = null;
    H.bin = null;
  };
  // itens de uma versão anterior (reinjeção) continuam valendo
  if (H.itensAntigos) { for (const it of H.itensAntigos.values()) guardar(it); }
  H.itensAntigos = ITENS;
  emit('main-ready', { at: Date.now(), itens: ITENS.size });
})();
