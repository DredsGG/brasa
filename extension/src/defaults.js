// Brasa — ajustes de fábrica, chaves do storage e o registro local. Usado pela página, pelo popup e pelo fundo.
// Regra do projeto: só storage.local (nada em sync: a lista de conversas e as mensagens são privadas).
// De fábrica: modo foco ligado (fase 1), guarda-foguinho ligado sem conversa marcada (fase 2), download e rolagem desligados (fases 3 e 4).
(() => {
  // Ajustes (um objeto só em br.ajustes). Recurso novo entra aqui com o valor de fábrica.
  const AJ = {
    on: true, // chave geral
    lang: '', // '' = idioma do navegador
    // fase 1 · modo foco (ligado de fábrica)
    foco: true, // chave do modo foco
    focoAnuncio: true, focoLive: true, focoLoja: true, // tirar do feed (Para você e Seguindo)
    escBanners: true, // banners e janelas de LIVE e loja na página
    // fase 2 · guarda-foguinho (ligado, mas sem conversa marcada não faz nada)
    guarda: true, guardaH1: '19:00', guardaH2: '22:00', guardaMesma: false, guardaFechado: false,
    guardaPausaMin: 20, guardaPausaMax: 90, // pausa aleatória entre conversas, em segundos (os testes encurtam)
    // fase 3 · baixar vídeo (desligado de fábrica)
    baixar: false, baixarCapa: true, baixarHevc: false, baixarPasta: 'Brasa',
    // fase 4 · rolagem automática (desligada de fábrica)
    auto: false, autoFoto: 8,
    // v0.6.2 · abrir os comentários ao entrar num feed: Para você (v0.6.5: também Seguindo e Amigos), ligado de fábrica
    coment: true,
    // v0.6.4 · "Trocar de conta" na barra lateral (pelo Sair do próprio TikTok)
    conta: true,
    // v0.6.5 · Auto curtir e Auto seguir (pedido do André; desligados de fábrica, só clicam no que ainda não foi feito)
    autoCurtir: false, autoSeguir: false,
  };
  // storage.local (prefixo br.)
  const K = {
    aj: 'br.ajustes', // ajustes acima
    onboard: 'br.onboard', // { tutorial: 'pendente'|'visto'|'pulado', visto: versão, novLidas: versão base }
    update: 'br.update', // estado da procura de versão (regra 14)
    adiado: 'br.adiado', // X do aviso de versão nova: adia 1 h
    log: 'br.log', // registro: as 300 últimas linhas { em, k, a, ok } (texto montado no idioma da hora de mostrar)
    disco: 'br.disco', // versão na pasta (recarga sozinha)
    apoio: 'br.apoio', // escolha do quadro Apoiar
    tema: 'br.tema', // último tema visto no TikTok ('dark'|'light'), para o popup
    aba: 'br.aba', // última aba do menu
    envio: 'br.envio', // guarda-foguinho em andamento (fase 2): a recarga da pasta espera ele terminar
    fogConvs: 'br.fog.convs', // conversas vistas em /messages: { [convId]: { apelido, avatar, previa, hora, visto, marcada, dias:{AAAA-MM-DD:{eu,outro}}, seq:{dias, em, fuso, restauravelAte} } }
    fogMarcadas: 'br.fog.marcadas', // { [convId]: true } — escrita só pelo usuário (menu) ou pelo fundo (sequência perdida)
    fogFrases: 'br.fog.frases', // lista de frases (null = as 10 de fábrica)
    fogDia: 'br.fog.dia', // estado do dia: { dia, rodadas, enviadas, convs: { [id]: { res, motivo, em, frase } } }
    fogUltima: 'br.fog.ultima', // última frase mandada em cada conversa (para não repetir no dia seguinte)
    fogRun: 'br.fog.run', // rodada em andamento: { inicio, ensaio, janela, aba, fila, i, pulso }
        contador: 'br.contador', // modo foco: { dia: 'AAAA-MM-DD', anuncio, live, loja, ids: [] } (ids só do dia, para não contar duas vezes)
  };
  const LOG_MAX = 300;
  // Uma fila por contexto (página, popup ou fundo); entre abas pode sobrar uma corrida rara, sem perigo (é só registro).
  let fila = Promise.resolve();
  function logar(k, a, ok) {
    const ext = globalThis.chrome;
    fila = fila.then(async () => {
      try {
        const l = (await ext.storage.local.get(K.log))[K.log] || [];
        l.push({ em: Date.now(), k: String(k).slice(0, 40), a: Array.isArray(a) ? a.slice(0, 4).map((x) => (typeof x === 'string' ? x.slice(0, 120) : x)) : [], ok: ok !== false });
        await ext.storage.local.set({ [K.log]: l.slice(-LOG_MAX) });
      } catch (_) {}
    });
    return fila;
  }
  // texto de uma linha do registro no idioma pedido
  function linhaLog(T, e) {
    const f = T.log && T.log[e.k];
    try { return typeof f === 'function' ? f(...(e.a || [])) : typeof f === 'string' ? f : e.k + (e.a && e.a.length ? ' ' + e.a.join(' ') : ''); } catch (_) { return e.k; }
  }
  // dia local (o "hoje" do contador)
  const hoje = (d) => { const x = d ? new Date(d) : new Date(); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  // soma ao contador do dia os itens tirados (sem contar o mesmo id duas vezes)
  let filaCont = Promise.resolve();
  function contar(itens) {
    const ext = globalThis.chrome;
    filaCont = filaCont.then(async () => {
      try {
        let c = (await ext.storage.local.get(K.contador))[K.contador];
        if (!c || c.dia !== hoje()) c = { dia: hoje(), anuncio: 0, live: 0, loja: 0, ids: [] };
        let mudou = false;
        for (const it of itens) { if (!it || !it.id || c.ids.includes(it.id) || !['anuncio', 'live', 'loja'].includes(it.tipo)) continue; c[it.tipo]++; c.ids.push(it.id); mudou = true; }
        if (mudou) { c.ids = c.ids.slice(-1500); await ext.storage.local.set({ [K.contador]: c }); }
      } catch (_) {}
    });
    return filaCont;
  }
  // conversas do guarda-foguinho (fila única por contexto, como o registro)
  let filaConv = Promise.resolve();
  function mudarConvs(fn) {
    const ext = globalThis.chrome;
    filaConv = filaConv.then(async () => {
      try { const c = (await ext.storage.local.get(K.fogConvs))[K.fogConvs] || {}; const novo = fn(c) || c; await ext.storage.local.set({ [K.fogConvs]: novo }); } catch (_) {}
    });
    return filaConv;
  }
  // conversas que o guarda-foguinho aceita (medido no Chrome do André em 2026-11-11, só leitura):
  // a dois = "0:1:<uid>:<uid>"; GRUPO = só um número (19 dígitos), com "N membros" no cabeçalho.
  const ehGrupo = (id) => /^\d{10,}$/.test(String(id || ''));
  const convOk = (id) => /^0:1:\d+:\d+$/.test(String(id || '')) || ehGrupo(id);
  // sequência lida nos pacotes do TikTok (conversa a dois ou grupo)
  const salvarSequencia = (s) => mudarConvs((c) => {
    if (!convOk(s.conv)) return c;
    const cv = c[s.conv] || (c[s.conv] = { marcada: false });
    cv.seq = { dias: s.dias, em: Date.now(), fuso: s.fuso || null, restauravelAte: s.restauravelAte || null, ultimos: (s.users || []).map((u) => ({ uid: u.uid, ts: u.ts })).slice(0, 2) };
    return c;
  });
  let filaMarca = Promise.resolve();
  function marcar(id, on) {
    const ext = globalThis.chrome;
    filaMarca = filaMarca.then(async () => {
      try { const m = (await ext.storage.local.get(K.fogMarcadas))[K.fogMarcadas] || {}; if (on) m[id] = true; else delete m[id]; await ext.storage.local.set({ [K.fogMarcadas]: m }); } catch (_) {}
    });
    return filaMarca;
  }
  const api = { AJ, K, LOG_MAX, logar, linhaLog, hoje, contar, mudarConvs, salvarSequencia, marcar, convOk, ehGrupo };
  globalThis.BRASA_DEF = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})();
