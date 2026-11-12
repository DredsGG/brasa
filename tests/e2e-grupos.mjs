// v0.6.3: guarda-foguinho em GRUPOS. SÓ com as Mensagens simuladas (mock-dm.mjs) — nunca manda mensagem de verdade.
// Grupo medido no Chrome do André (só leitura): id só número (19 dígitos), cabeçalho com "N membros", nome de quem mandou.
// Uso: node e2e-grupos.mjs
import path from 'path';
import { abrir, esperarGuia, check, fim, until, wait, estado, clicar, lerStorage, semTutorial, SHOT } from './lib.mjs';
import { rotas } from './mock.mjs';
import { CONV } from './mock-dm.mjs';

const G1 = CONV['Turma do Fogo'], G2 = CONV['Grupo parado'];
const { ctx, sw } = await abrir();
await esperarGuia(ctx).then((g) => g && g.close());
await semTutorial(sw);
const st = await rotas(ctx);
const erros = [];
const swv = (fn, arg) => sw.evaluate(fn, arg);
await swv(() => chrome.storage.local.get('br.ajustes').then((l) => chrome.storage.local.set({ 'br.ajustes': Object.assign({}, l['br.ajustes'] || {}, { guardaPausaMin: 0.2, guardaPausaMax: 0.6 }), 'br.fog.frases': ['oi, turma'] })));
const marcadas = async () => (await lerStorage(sw, 'br.fog.marcadas')) || {};

const p = await ctx.newPage();
p.on('pageerror', (e) => erros.push(String(e)));
await p.goto('https://www.tiktok.com/messages');
await p.waitForSelector('[data-e2e="dm-new-conversation-item"]');
const convs = await until(async () => { const c = await lerStorage(sw, 'br.fog.convs'); return c && c[G1] && c[G2] ? c : null; }, 20000);
check('coleta: os grupos (id só número) entram junto com as conversas', !!convs && convs[G1].apelido === 'Turma do Fogo' && convs[G2].apelido === 'Grupo parado', convs && Object.keys(convs).filter((k) => /^\d+$/.test(k)));

// a pessoa abre o grupo: dias com mensagem dela e dos outros membros
await p.click(`[id="more-action-icon-${G1}"]`);
const g1 = await until(async () => { const c = await lerStorage(sw, 'br.fog.convs'); return c && c[G1].dias && Object.keys(c[G1].dias).length >= 2 ? c[G1] : null; }, 15000);
const ontem = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })();
check('grupo aberto: lê os dias (eu e os outros membros)', !!g1 && Object.values(g1.dias).some((d) => d.eu) && Object.values(g1.dias).some((d) => d.outro), g1 && g1.dias);

// aba Foguinho: os grupos aparecem com a marca "Grupo" e dá para marcar
await p.evaluate(() => document.querySelector('#brasa-nav button').click());
await until(async () => (await estado(p)).menu);
await clicar(p, '.menu .tabs [data-aba="fog"]');
const e = await until(async () => { const s = await estado(p); return s.aba === 'Foguinho' && /Turma do Fogo/.test(s.menuTexto) ? s : null; });
check('aba Foguinho: "Suas conversas e grupos" com os dois grupos', !!e && /Suas conversas e grupos/.test(e.menuTexto) && /Grupo parado/.test(e.menuTexto), e && e.menuTexto.slice(0, 300));
const estiloLista = await p.evaluate(() => { const c = document.querySelector('brasa-ui').shadowRoot.querySelector('.menu .cv'); return c && getComputedStyle(c).display; });
check('a lista de conversas tem o estilo da Brasa (uma linha por conversa, não texto solto)', estiloLista === 'flex', estiloLista);
const marca = await p.evaluate((id) => { const b = document.querySelector('brasa-ui').shadowRoot.querySelector(`.menu [data-conv="${id}"] .gr`); return b && b.textContent; }, G1);
check('grupo tem a marca "Grupo" na lista; conversa a dois não tem', marca === 'Grupo' && !(await p.evaluate((id) => !!document.querySelector('brasa-ui').shadowRoot.querySelector(`.menu [data-conv="${id}"] .gr`), CONV.Ana)), marca);
await p.evaluate((id) => document.querySelector('brasa-ui').shadowRoot.querySelector(`.menu [data-conv="${id}"]`).scrollIntoView({ block: 'center' }), G1);
await p.screenshot({ path: path.join(SHOT, 'fog-grupos.png') });
for (const id of [G1, G2]) { await clicar(p, `.menu [data-conv="${id}"]`); await wait(150); }
check('marcar os dois grupos pelo menu', !!(await until(async () => { const m = await marcadas(); return m[G1] && m[G2] && Object.keys(m).length === 2; })));

// Ensaio: digita só no grupo que mandaria e apaga
st.ev.length = 0;
await clicar(p, '.menu [data-fog="ensaio"]');
check('Ensaio terminou', !!(await until(async () => ((await lerStorage(sw, 'br.log')) || []).find((x) => x.k === 'fogFim' && x.a[0] === 'ensaio'), 90000, 500)));
const evE = st.ev.filter((x) => x.guarda);
check('Ensaio: nada enviado; digitou só na "Turma do Fogo" (alguém falou ontem) e apagou', !evE.some((x) => x.t === 'enviou') && [...new Set(evE.filter((x) => x.t === 'digitou').map((x) => x.conv))].join() === G1 && evE.some((x) => x.t === 'limpou' && x.conv === G1), evE.map((x) => x.t + ':' + x.conv));

// de verdade (no mock): manda no grupo certo, uma vez
st.ev.length = 0;
const t0 = Date.now();
await clicar(p, '.menu [data-fog="agora"]');
check('rodada terminou', !!(await until(async () => ((await lerStorage(sw, 'br.log')) || []).find((x) => x.k === 'fogFim' && x.a[0] === 'real' && x.em > t0), 120000, 500)));
const env = st.ev.filter((x) => x.guarda && x.t === 'enviou');
check('mandou "oi, turma" UMA vez na "Turma do Fogo" (cabeçalho do grupo conferido)', env.length === 1 && env[0].conv === G1 && env[0].texto === 'oi, turma', env);
const dia = await lerStorage(sw, 'br.fog.dia');
check('"Grupo parado": ninguém falou ontem → não mandou', dia && dia.convs[G2] && dia.convs[G2].motivo === 'semOntem' && !env.some((x) => x.conv === G2), dia && dia.convs);
const log = ((await lerStorage(sw, 'br.log')) || []).filter((x) => x.k === 'guarda' && x.em > t0);
check('registro com o nome do grupo', log.some((x) => x.a[0] === 'Turma do Fogo' && x.a[1] === 'mandou'), log.map((x) => x.a.join(' ')));
check('sem erros de script', erros.length === 0, erros.slice(0, 3));
await ctx.close();
fim();
