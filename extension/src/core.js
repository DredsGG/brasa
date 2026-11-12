// Brasa — núcleo no mundo isolado (document_start): instância única por aba, ajustes (storage.local), ponte com o mundo MAIN
// (src/page.js), navegação interna do TikTok e registro. Os recursos (fases 1 a 4) ouvem os eventos daqui:
//   BRASA.on('ready' | 'settings' | 'nav' | 'feed' | 'lang' | 'ativo' | 'update' | 'msg' | 'stop', fn)
(() => {
  'use strict';
  const ext = globalThis.chrome;
  const I = globalThis.BRASA_I18N, C = globalThis.BRASA_COMUM, DEF = globalThis.BRASA_DEF;
  if (!ext || !ext.runtime || !I || !C || !DEF) return;

  // Instância única por aba: a extensão recarregada injeta uma nova, e a antiga (órfã) para sozinha.
  const EV_TROCA = 'brasa-takeover-' + ext.runtime.id; // a página não dispara à toa (precisaria do id da extensão)
  document.dispatchEvent(new Event(EV_TROCA));
  let dead = false;
  const onTakeover = () => stop();
  setTimeout(() => document.addEventListener(EV_TROCA, onTakeover), 0);
  const alive = () => { try { return !dead && !!ext.runtime.id; } catch (_) { return false; } };

  const K = DEF.K;
  const VERSION = ext.runtime.getManifest().version;

  // ───────────────────────── barramento interno ─────────────────────────
  const subs = {};
  const on = (ev, fn) => { (subs[ev] = subs[ev] || []).push(fn); return () => { subs[ev] = (subs[ev] || []).filter((f) => f !== fn); }; };
  const emit = (ev, data) => { for (const fn of (subs[ev] || []).slice()) { try { fn(data); } catch (e) { console.warn('[Brasa]', ev, e); } } };
  const stops = [];
  const onStop = (fn) => stops.push(fn);

  const S = Object.assign({}, DEF.AJ);
  let carregado = false; // ajustes já lidos do storage
  let lang = I.detect();

  // ───────────────────────── ponte com o mundo MAIN ─────────────────────────
  let seq = 0, mainOk = false;
  const feed = { respostas: 0, ultima: null };
  const pend = new Map();
  function bridge(op, ...args) {
    return new Promise((ok) => {
      const id = 'b' + (++seq) + '.' + Math.random().toString(36).slice(2, 6);
      const t = setTimeout(() => { pend.delete(id); ok(null); }, 1500);
      pend.set(id, (d) => { clearTimeout(t); ok(d); });
      document.dispatchEvent(new CustomEvent('brasa:c', { detail: JSON.stringify({ id, op, args }) }));
    });
  }
  const onEvt = (e) => {
    if (dead) return;
    let m; try { m = JSON.parse(e.detail); } catch (_) { return; }
    if (!m) return;
    if (m.type === 'res') { const f = pend.get(m.id); if (f) { pend.delete(m.id); f(m.data); } return; }
    if (m.type === 'main-ready') { mainOk = true; if (BRASA.ready && carregado) mandarCfg(); return; }
    if (m.type === 'nav') { mainOk = true; checarNav('main'); return; }
    if (m.type === 'feed') { mainOk = true; feed.respostas++; feed.ultima = m.data; emit('feed', m.data); }
    if (m.type === 'sequencia') { mainOk = true; if (m.data && m.data.conv) { DEF.salvarSequencia(m.data); emit('sequencia', m.data); } return; }
    if (m.type === 'filtrado') { mainOk = true; if (m.data && Array.isArray(m.data.itens)) { DEF.contar(m.data.itens); emit('filtrado', m.data); } }
  };
  document.addEventListener('brasa:e', onEvt);

  // ───────────────────────── página e navegação interna ─────────────────────────
  // tipos de página (medidos em 2026-11-11): / e /foryou = Para você; /following; /friends (v0.6.5: Amigos, rota do código do site); /explore; /live; /messages; /@x/video/id; /@x
  const kindOf = (p) => (p === '/' || p === '/foryou' || p.startsWith('/foryou') ? 'foryou' : p.startsWith('/following') ? 'following' : p.startsWith('/friends') ? 'friends'
    : p.startsWith('/explore') ? 'explore' : p.startsWith('/live') ? 'live' : p.startsWith('/messages') ? 'messages'
    : /^\/@[^/]+\/(video|photo)\//.test(p) ? 'video' : /^\/@[^/]+\/?$/.test(p) ? 'profile' : 'other');
  const page = { kind: kindOf(location.pathname), url: location.pathname + location.search };
  // os feeds de vídeo em coluna (Para você, Seguindo, Amigos): modo foco, Auto e comentários abertos valem neles
  // v1.0.1: por onde a aba entrou (a URL da primeira carga, antes de qualquer troca do site) e como (navigate, reload, back_forward)
  const entrada = (() => { let tipo = ''; try { const n = performance.getEntriesByType('navigation')[0]; tipo = (n && n.type) || ''; } catch (_) {} return { caminho: location.pathname, tipo, em: Date.now() }; })();
  const FEEDS = ['foryou', 'following', 'friends'];
  const ehFeed = (k = page.kind) => FEEDS.includes(k);
  // v1.0.2 · "modo navegador" do TikTok: o quadro que cobre a página ao abrir um vídeo de uma grade (perfil, Explorar, busca).
  // Medido 2026-11-12 (ferramentas/medir-navegador.mjs, sem login): vídeo = [data-e2e="browse-video"] (com #xgwrapper-N-<id> e o
  // <video>, SEM loop: no fim ele para), setas [data-e2e="arrow-left|arrow-right"] (button, aria-disabled no limite), fechar
  // [data-e2e="browse-close"], coração [data-e2e="browse-like-icon"] (o aria-pressed fica no elemento de cima), seguir
  // [data-e2e="browse-follow"] (div com o botão; "Seguindo" usa outra classe, --StyledFollowingButtonTux). A URL vira a do vídeo.
  function navegador() {
    const x = document.querySelector('[data-e2e="browse-close"]'); // o quadro aberto (o fechar visível)
    if (!x || !(x.getBoundingClientRect().width > 0)) return null;
    const cy = innerHeight / 2;
    // vídeo = browse-video; carrossel de fotos (URL /@x/photo/id; relato do André, v1.0.2) = o tocador de fotos do site:
    // --DivPhotoVideoContainer > --DivSwiperContainer > img --ImgPhotoSlide (passa sozinho a cada 2,5 s; código do site)
    for (const el of document.querySelectorAll('[data-e2e="browse-video"],[class*="--DivPhotoVideoContainer"]')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.top <= cy && r.bottom >= cy) {
        const foto = !el.matches('[data-e2e="browse-video"]');
        const w = el.querySelector('[id^="xgwrapper-"]'), m = w && w.id.match(/(\d{8,})$/);
        return { el, foto, id: m ? m[1] : ((location.pathname.match(/\/(?:video|photo)\/(\d+)/) || [])[1] || ''), video: foto ? null : el.querySelector('video'), prox: document.querySelector('[data-e2e="arrow-right"]') };
      }
    }
    return null;
  }
  // onde os recursos do vídeo (bloco, Auto, Curtir/Seguir) valem: os feeds e o modo navegador
  const ehTelaDeVideo = () => ehFeed() || !!navegador();
  // de qual feed a página veio (para /@x/video/id com os comentários abertos continuar sendo esse feed)
  let feedDeOrigem = ehFeed(page.kind) ? page.kind : null;
  // cara de feed (medido 2026-11-12): o feed tem vários recommend-list-item-container e as setas feed-navigation-*; a página de
  // um vídeo aberto direto (/@x/video/id) tem 1 contêiner e nenhuma seta
  const temFeed = () => document.querySelectorAll('[data-e2e="recommend-list-item-container"]').length >= 2 || !!document.querySelector('[data-e2e="feed-navigation-next"]');
  function checarNav(fonte) {
    const u = location.pathname + location.search;
    // v0.6.5 (visto no Chrome do André, com conta): o TikTok lembra os comentários abertos e já troca a URL para /@x/video/id
    // na CARGA, antes de o feed aparecer; aí a página ficava presa como "vídeo". Com cara de feed, volta a ser o feed (de origem,
    // ou Para você se a Brasa foi recarregada já nessa URL).
    if (u === page.url) { if (!(page.kind === 'video' && temFeed())) return; }
    let k = kindOf(location.pathname);
    // v0.6.2 (medido): com os comentários abertos no Para você/Seguindo/Amigos o site troca a URL para /@x/video/id SEM sair do feed
    // (e a acompanha ao passar de vídeo). Continua sendo o feed: modo foco, Baixar e Auto seguem valendo.
    if (k === 'video' && temFeed()) k = feedDeOrigem || 'foryou';
    if (ehFeed(k)) feedDeOrigem = k; else if (k !== 'video') feedDeOrigem = null;
    const mudouTipo = k !== page.kind;
    page.kind = k; page.url = u;
    emit('nav', { kind: k, mudouTipo, fonte });
  }
  const onPop = () => checarNav('popstate');
  addEventListener('popstate', onPop);
  // plano B: se o gancho do MAIN não avisar (bloqueado), confere a URL a cada 1 s
  const tNav = setInterval(() => { if (!dead) checarNav('poll'); }, 1000);

  // ───────────────────────── ajustes ─────────────────────────
  let upd = {};
  const urgente = () => !!(upd.disponivel && upd.urgente && upd.ultima && C.cmpVer(upd.ultima, VERSION) > 0);
  const ativo = () => !!S.on && !urgente(); // versão urgente pausa a automação (regra 14d)
  // ajustes que o page.js (mundo MAIN) precisa para filtrar o feed antes de o site desenhar
  const cfgMain = () => ({ ativo: ativo(), foco: !!S.foco, anuncio: !!S.focoAnuncio, live: !!S.focoLive, loja: !!S.focoLoja });
  const mandarCfg = () => bridge('cfg', cfgMain()).then((r) => { if (r) mainOk = true; return r; });
  let ajQ = Promise.resolve();
  // grava em S na hora e avisa a aba (o storage avisa as outras abas e o popup)
  function setAj(k, v) {
    const era = S[k], antesAtivo = ativo();
    S[k] = v;
    if (JSON.stringify(era) !== JSON.stringify(v)) { mandarCfg(); emit('settings', { [k]: v }); if (antesAtivo !== ativo()) emit('ativo', ativo()); }
    ajQ = ajQ.then(async () => {
      try { const cur = (await ext.storage.local.get(K.aj))[K.aj] || {}; cur[k] = v; await ext.storage.local.set({ [K.aj]: cur }); } catch (_) {}
    });
    return ajQ;
  }
  async function setLang(l) { lang = I.LANGS.includes(l) ? l : I.detect(); await setAj('lang', I.LANGS.includes(l) ? l : ''); emit('lang', lang); }
  function aplicarAj(novo) {
    const mud = {};
    for (const k of Object.keys(DEF.AJ)) { const v = novo && k in novo ? novo[k] : DEF.AJ[k]; if (JSON.stringify(v) !== JSON.stringify(S[k])) { S[k] = v; mud[k] = v; } }
    if ('lang' in mud) { lang = I.LANGS.includes(S.lang) ? S.lang : I.detect(); emit('lang', lang); }
    if (Object.keys(mud).length) { mandarCfg(); emit('settings', mud); if ('on' in mud) emit('ativo', ativo()); }
  }

  const onStore = (ch, area) => {
    if (!alive() || area !== 'local') return;
    if (ch[K.aj]) aplicarAj(ch[K.aj].newValue || {});
    if (ch[K.update]) { const antes = ativo(); upd = ch[K.update].newValue || {}; emit('update', upd); if (antes !== ativo()) { mandarCfg(); emit('ativo', ativo()); } }
    if (ch[K.log]) emit('log', ch[K.log].newValue || []);
  };
  ext.storage.onChanged.addListener(onStore);
  const onMsg = (m) => { if (alive() && m && typeof m.type === 'string' && m.type.startsWith('brasa:')) emit('msg', m); };
  ext.runtime.onMessage.addListener(onMsg);

  function stop() {
    if (dead) return;
    dead = true;
    emit('stop');
    for (const f of stops) { try { f(); } catch (_) {} }
    clearInterval(tNav);
    document.removeEventListener(EV_TROCA, onTakeover);
    document.removeEventListener('brasa:e', onEvt);
    removeEventListener('popstate', onPop);
    try { ext.storage.onChanged.removeListener(onStore); ext.runtime.onMessage.removeListener(onMsg); } catch (_) {}
  }

  const BRASA = globalThis.BRASA = {
    ext, I, C, DEF, K, VERSION, S, page, ehFeed, navegador, ehTelaDeVideo, entrada, feed,
    get lang() { return lang; }, L: () => I.T[lang] || I.T.en, setLang, setAj,
    cfgMain, mandarCfg,
    on, emit, onStop, log: (k, a, ok) => (alive() ? DEF.logar(k, a, ok) : Promise.resolve()), bridge, alive, ativo, urgente,
    get upd() { return upd; }, get mainOk() { return mainOk; }, get dead() { return dead; },
    ready: null,
  };

  BRASA.ready = ext.storage.local.get([K.aj, K.update]).then((l) => {
    const aj = l[K.aj] || {};
    for (const k of Object.keys(DEF.AJ)) if (k in aj) S[k] = aj[k];
    if (I.LANGS.includes(S.lang)) lang = S.lang;
    upd = l[K.update] || {};
  }).catch(() => {}).then(async () => {
    if (dead) return;
    carregado = true;
    const pong = await mandarCfg(); // manda os ajustes do modo foco já; a ponte MAIN pode já estar de pé (reinjeção)
    if (pong) mainOk = true;
    emit('ready');
    // plano B avisado no registro: sem resposta do MAIN 10 s depois de a página carregar
    setTimeout(async () => {
      if (dead || mainOk) return;
      const p2 = await bridge('ping');
      if (p2 && p2.ok) { mainOk = true; return; }
      BRASA.log('semPonte', [], false);
    }, 10000);
  });
})();
