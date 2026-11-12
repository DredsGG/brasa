// Brasa — guarda-foguinho: regras puras (sem DOM, sem rede, sem storage). Usado pelo fundo, pela página, pelo popup e pelos testes.
// Medido em 2026-11-11 (Jarvis/02-projetos/extensoes/role/brasa-engenharia-reversa.md): o separador de tempo da conversa mostra
// só a hora para hoje ("18:50") e a data completa para os outros dias ("9 de novembro de 2026, 23:33"); mensagem minha =
// contêiner com row-reverse. Estas funções recebem o que a página leu e decidem.
(() => {
  const dois = (n) => String(n).padStart(2, '0');
  const diaDe = (d) => { const x = new Date(d); return `${x.getFullYear()}-${dois(x.getMonth() + 1)}-${dois(x.getDate())}`; };
  const somaDias = (dia, n) => { const [a, m, d] = dia.split('-').map(Number); return diaDe(new Date(a, m - 1, d + n, 12)); };
  const MESES = [
    ['jan', 'janeiro', 'january', 'enero'], ['fev', 'fevereiro', 'feb', 'february', 'febrero'], ['mar', 'março', 'marco', 'march', 'marzo'],
    ['abr', 'abril', 'apr', 'april'], ['mai', 'maio', 'may', 'mayo'], ['jun', 'junho', 'june', 'junio'], ['jul', 'julho', 'july', 'julio'],
    ['ago', 'agosto', 'aug', 'august'], ['set', 'setembro', 'sep', 'sept', 'september', 'septiembre', 'setiembre'], ['out', 'outubro', 'oct', 'october', 'octubre'],
    ['nov', 'novembro', 'november', 'noviembre'], ['dez', 'dezembro', 'dec', 'december', 'dic', 'diciembre'],
  ];
  const SEMANA = [['dom', 'domingo', 'sun', 'sunday'], ['seg', 'segunda', 'mon', 'monday', 'lunes', 'lun'], ['ter', 'terça', 'terca', 'tue', 'tuesday', 'martes'],
    ['qua', 'quarta', 'wed', 'wednesday', 'miércoles', 'miercoles', 'mié'], ['qui', 'quinta', 'thu', 'thursday', 'jueves', 'jue'], ['sex', 'sexta', 'fri', 'friday', 'viernes', 'vie'],
    ['sáb', 'sab', 'sábado', 'sabado', 'sat', 'saturday']];
  const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  // texto do separador → 'AAAA-MM-DD' (ou null se não entender)
  function lerSeparador(txt, agora, eua) {
    const t = semAcento(String(txt || '').toLowerCase()).replace(/\s+/g, ' ').trim();
    const hoje = diaDe(agora);
    if (!t) return null;
    if (/^\d{1,2}:\d{2}( ?[ap]\.? ?m\.?)?$/.test(t) || /^(hoje|today|hoy)\b/.test(t)) return hoje;
    if (/^(ontem|yesterday|ayer)\b/.test(t)) return somaDias(hoje, -1);
    let m = t.match(/^(?:ha|há|hace)?\s*(\d{1,2})\s*(d|dia|dias|day|days|días)\b/) || t.match(/^(\d{1,2})\s*(d|days?)\s+ago\b/);
    if (m) return somaDias(hoje, -(+m[1]));
    m = t.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
    if (m) return eua ? `${m[3]}-${dois(+m[1])}-${dois(+m[2])}` : `${m[3]}-${dois(+m[2])}-${dois(+m[1])}`; // en-US: mês/dia
    m = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return `${m[1]}-${dois(+m[2])}-${dois(+m[3])}`;
    const palavras = t.split(/[^a-z0-9]+/).filter(Boolean);
    let mes = -1;
    for (const p of palavras) { const i = MESES.findIndex((ns) => ns.some((n) => semAcento(n) === p)); if (i >= 0 && !/^\d/.test(p)) { mes = i; break; } }
    if (mes >= 0) {
      const ano = (t.match(/\b(\d{4})\b/) || [])[1];
      const dia = (t.replace(/\b\d{4}\b/, '').replace(/\d{1,2}:\d{2}/g, '').match(/\b(\d{1,2})\b/) || [])[1];
      if (dia) {
      let a = ano ? +ano : new Date(agora).getFullYear();
      let r = `${a}-${dois(mes + 1)}-${dois(+dia)}`;
      if (!ano && r > hoje) r = `${a - 1}-${dois(mes + 1)}-${dois(+dia)}`;
      return r;
      }
    }
    const sem = SEMANA.findIndex((ns) => ns.some((n) => palavras[0] === semAcento(n)));
    if (sem >= 0) { const d = new Date(agora); let k = 0; while (d.getDay() !== sem && k < 7) { d.setDate(d.getDate() - 1); k++; } if (k === 0) d.setDate(d.getDate() - 7); return diaDe(d); }
    return null;
  }
  // mensagem de sistema de sequência perdida (PT/EN/ES; visto em 2026-11-11: "Sequência de 385 dias perdidos. Restaurar")
  const PERDIDA = /(sequ[eê]ncia|streak|racha)[^.]{0,60}(perdid|lost|perdi|termin|ended|acab)|(perdeu|lost|perdiste)[^.]{0,40}(sequ[eê]ncia|streak|racha)|restaurar sequ|restore (your |the )?streak/i;
  const ePerdida = (txt) => PERDIDA.test(String(txt || ''));
  // itens na ordem da tela (mais antigo → mais novo): { sep: 'texto' } | { msg: true, eu: bool, texto } | { sistema: 'texto' }
  // completo = a leitura chegou a um dia anterior a ontem (ou ao começo da conversa)
  function analisar(itens, agora, completo, eua) {
    const hoje = diaDe(agora), ontem = somaDias(hoje, -1);
    let dia = null, maisAntigo = null;
    const dias = {};
    let perdidaRecente = false, nMsg = 0;
    for (const it of itens) {
      if (it.sep != null) { const d = lerSeparador(it.sep, agora, eua); if (d) { dia = d; if (!maisAntigo || d < maisAntigo) maisAntigo = d; } continue; }
      // só mensagem de sistema conta (um amigo escrevendo "quase perdi a sequência" não desmarca nada)
      if (it.sistema != null && ePerdida(it.sistema) && dia && dia >= ontem) perdidaRecente = true;
      if (!it.msg || !dia) continue;
      nMsg++;
      const r = dias[dia] || (dias[dia] = { eu: false, outro: false });
      if (it.eu) r.eu = true; else r.outro = true;
    }
    const leuOntem = !!completo || (maisAntigo != null && maisAntigo < ontem);
    return {
      hoje, ontem, dias, nMsg, perdidaRecente, leuOntem,
      euHoje: !!(dias[hoje] && dias[hoje].eu),
      alguemOntem: !!(dias[ontem] && (dias[ontem].eu || dias[ontem].outro)),
    };
  }
  // ordem: (c) sequência perdida recente → desmarca · (a) já mandei hoje → pula · (b) ninguém falou ontem → não manda
  function decidir(a) {
    if (a.perdidaRecente) return { acao: 'desmarcar', motivo: 'perdida' };
    if (a.euHoje) return { acao: 'pular', motivo: 'jaMandou' };
    if (!a.alguemOntem) return a.leuOntem ? { acao: 'naoMandar', motivo: 'semOntem' } : { acao: 'falhar', motivo: 'naoLi' }; // não leu ontem: tenta de novo na reserva
    return { acao: 'mandar', motivo: 'ok' };
  }
  // selo "provável foguinho": mensagem dos dois lados em cada um dos 3 dias antes de hoje (só sugere)
  function provavel(dias, agora) {
    const hoje = diaDe(agora);
    for (let k = 1; k <= 3; k++) { const d = dias && dias[somaDias(hoje, -k)]; if (!d || !d.eu || !d.outro) return false; }
    return true;
  }
  // frase: sorteia sem repetir a de ontem nesta conversa
  function sortearFrase(frases, evitar, rng) {
    const l = (frases || []).map((f) => String(f).trim()).filter(Boolean);
    if (!l.length) return null;
    const opc = l.length > 1 ? l.filter((f) => f !== evitar) : l;
    return opc[Math.floor((rng || Math.random)() * opc.length) % opc.length];
  }
  const TETO_DIA = 20;
  const FINAL = ['mandou', 'pulou', 'naoMandou', 'desmarcou'];
  // estado do dia (zera quando o dia muda)
  const estadoDoDia = (e, agora) => (e && e.dia === diaDe(agora) ? e : { dia: diaDe(agora), rodadas: 0, convs: {}, enviadas: 0 });
  // quem falta hoje: marcadas, sem resultado final, até o teto de 20 mensagens no dia
  function planejar(convs, estado, agora) {
    const e = estadoDoDia(estado, agora);
    const fila = Object.keys(convs || {}).filter((id) => convs[id] && convs[id].marcada && !(e.convs[id] && FINAL.includes(e.convs[id].res)));
    const vagas = Math.max(0, TETO_DIA - (e.enviadas || 0));
    return { fila, vagas }; // a rodada para quando as vagas acabam (pulos não gastam vaga)
  }
  const minutos = (hhmm) => { const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})$/); return m ? Math.min(23, +m[1]) * 60 + Math.min(59, +m[2]) : null; };
  // rodar agora? 1ª rodada a partir do horário principal; 2ª (reserva) a partir do horário de reserva, se ainda faltar alguém.
  // Serve para o alarme, a conferência a cada 15 min, a abertura do navegador e o PC acordando depois do horário.
  function deveRodar(agora, cfg, estado, temFila) {
    if (!temFila) return false;
    const e = estadoDoDia(estado, agora), d = new Date(agora), m = d.getHours() * 60 + d.getMinutes();
    const h1 = minutos(cfg.h1), h2 = minutos(cfg.h2);
    if (h1 == null) return false;
    if (m >= h1 && (e.rodadas || 0) === 0) return true;
    if (h2 != null && m >= h2 && (e.rodadas || 0) < 2) return true;
    return false;
  }
  // próximo horário (para o alarme): hoje se ainda não passou, senão amanhã
  function proximo(hhmm, agora) {
    const m = minutos(hhmm); if (m == null) return null;
    const d = new Date(agora); d.setSeconds(0, 0); d.setHours(Math.floor(m / 60), m % 60);
    if (d.getTime() <= agora) d.setDate(d.getDate() + 1);
    return d.getTime();
  }
  const FRASES_PT = [
    'Passando aqui pra não deixar o foguinho apagar 🔥',
    'Bora manter essa sequência! 💪',
    'Mais um dia de foguinho aceso ✨',
    'Tô aqui! Foguinho garantido hoje 🔥',
    'Não esqueci de você 😄',
    'Só pra manter a chama acesa 🕯️',
    'Ei! Como foi o seu dia?',
    'Foguinho em dia, missão cumprida ✅',
    'Vamos que vamos, sequência firme 🙌',
    'Dando aquele oi de sempre 👋',
  ];
  const api = { diaDe, somaDias, lerSeparador, ePerdida, analisar, decidir, provavel, sortearFrase, planejar, deveRodar, proximo, estadoDoDia, minutos, TETO_DIA, FINAL, FRASES_PT };
  globalThis.BRASA_GUARDA = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})();
