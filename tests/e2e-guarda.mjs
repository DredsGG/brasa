// Fase 2 (v0.3.0): guarda-foguinho. SÓ com as Mensagens simuladas (mock-dm.mjs) — nunca manda mensagem de verdade.
// Uso: node e2e-guarda.mjs
import path from 'path';
import { abrir, esperarGuia, check, fim, until, wait, estado, clicar, ponte, lerStorage, semTutorial, SHOT } from './lib.mjs';
import { rotas } from './mock.mjs';
import { CONV } from './mock-dm.mjs';

const { ctx, sw, extId } = await abrir();
await esperarGuia(ctx).then((g) => g && g.close());
await semTutorial(sw);
const st = await rotas(ctx);
const erros = [];
const swv = (fn, arg) => sw.evaluate(fn, arg);
await swv(() => chrome.storage.local.get('br.ajustes').then((l) => chrome.storage.local.set({ 'br.ajustes': Object.assign({}, l['br.ajustes'] || {}, { guardaPausaMin: 0.2, guardaPausaMax: 0.6 }), 'br.fog.frases': ['oi de sempre'] })));
const marcadas = async () => (await lerStorage(sw, 'br.fog.marcadas')) || {};

// 1) André abre as Mensagens: a Brasa vê a lista (só lê) e o pacote com a sequência
const p = await ctx.newPage();
p.on('pageerror', (e) => erros.push(String(e)));
await p.goto('https://www.tiktok.com/messages');
await p.waitForSelector('[data-e2e="dm-new-conversation-item"]');
for (let i = 0; i < 3; i++) { await p.evaluate(() => { const s = document.getElementById('lst'); s.scrollTop = s.scrollHeight; s.dispatchEvent(new Event('scroll')); }); await wait(700); }
const convs = await until(async () => { const c = await lerStorage(sw, 'br.fog.convs'); return c && c[CONV.Ana] && c[CONV.Ana].apelido && c[CONV.Ana].seq && c[CONV.Gabi] ? c : null; }, 20000);
check('coleta: a lista de conversas vai para o storage.local (apelido, prévia, hora)', convs && convs[CONV.Ana].apelido === 'Ana' && convs[CONV.Bia].previa && Object.keys(convs).length >= 30, convs && Object.keys(convs).length);
check('sequência lida no pacote protobuf do TikTok: Ana = 42 dias', convs && convs[CONV.Ana].seq.dias === 42 && convs[CONV.Ana].seq.fuso === 'America/Sao_Paulo', convs && convs[CONV.Ana].seq);
check('nenhuma conversa vem marcada de fábrica (não faz nada até marcar)', Object.keys(await marcadas()).length === 0);
// André abre a conversa do Hugo (dos dois lados nos 3 últimos dias) → selo "provável"
await p.click(`[id="more-action-icon-${CONV.Hugo}"]`);
const hugo = await until(async () => { const c = await lerStorage(sw, 'br.fog.convs'); return c && c[CONV.Hugo].dias && Object.keys(c[CONV.Hugo].dias).length >= 3 ? c[CONV.Hugo] : null; }, 15000);
check('conversa aberta pela pessoa: dias com mensagem de cada lado (para o "provável")', !!hugo, hugo && hugo.dias);

// 2) aba Foguinho do menu
await p.evaluate(() => document.querySelector('#brasa-nav button').click());
await until(async () => (await estado(p)).menu);
await clicar(p, '.menu .tabs [data-aba="fog"]');
let e = await until(async () => { const s = await estado(p); return s.aba === 'Foguinho' && /42 dias/.test(s.menuTexto) && /provável/.test(s.menuTexto) ? s : null; });
check('aba Foguinho: conversas com foto, nome e prévia; "42 dias" na Ana e "provável" no Hugo', !!e, (await estado(p)).menuTexto.slice(0, 300));
check('aba Foguinho: "Nenhuma conversa marcada" e as frases (aqui, uma só para o teste)', e && /Nenhuma conversa marcada/.test(e.menuTexto) && (await p.evaluate(() => document.querySelector('brasa-ui').shadowRoot.querySelector('textarea[data-fog="frases"]').value)) === 'oi de sempre');
await p.screenshot({ path: path.join(SHOT, 'fog-menu.png') });
for (const n of ['Ana', 'Bia', 'Caio', 'Duda', 'Fabi', 'Iris', 'Gabi', 'Lia', 'Mia']) { await clicar(p, `.menu [data-conv="${CONV[n]}"]`); await wait(150); }
const marc = await until(async () => { const m = Object.keys(await marcadas()); return m.length === 9 ? m : null; });
check('marcar 9 conversas pelo menu (chave própria br.fog.marcadas)', !!marc);
check('Enzo e Hugo ficam desmarcados', !(await marcadas())[CONV.Enzo] && !(await marcadas())[CONV.Hugo]);
await wait(4500); // a coleta da página roda de novo: não pode apagar as marcações
check('a coleta da página não mexe nas marcações', Object.keys(await marcadas()).length === 9);

// 3) Ensaio: faz tudo menos apertar enviar
st.ev.length = 0;
await clicar(p, '.menu [data-fog="ensaio"]');
const fimEnsaio = await until(async () => ((await lerStorage(sw, 'br.log')) || []).find((x) => x.k === 'fogFim' && x.a[0] === 'ensaio'), 120000, 500);
check('Ensaio terminou', !!fimEnsaio, fimEnsaio);
const evE = st.ev.filter((x) => x.guarda);
check('Ensaio: NADA enviado', !evE.some((x) => x.t === 'enviou'), evE.filter((x) => x.t === 'enviou'));
const digE = [...new Set(evE.filter((x) => x.t === 'digitou').map((x) => x.conv))];
check('Ensaio: digitou só onde mandaria (Ana, Fabi, Gabi, Iris, Lia, Mia) e apagou depois', ['Ana', 'Fabi', 'Gabi', 'Iris', 'Lia', 'Mia'].every((n) => digE.includes(CONV[n])) && digE.length === 6 && evE.filter((x) => x.t === 'limpou').length >= 6, digE);
check('Ensaio: Enzo (não marcado) nunca foi aberto', !evE.some((x) => x.conv === CONV.Enzo));
check('Ensaio não gasta o dia (rodadas = 0)', !((await lerStorage(sw, 'br.fog.dia')) || {}).rodadas);
check('Ensaio não desmarca ninguém (Duda segue marcada)', !!(await marcadas())[CONV.Duda]);
check('janela do guarda fechada e trava de recarga liberada', !(await swv(async () => (await chrome.tabs.query({})).some((t) => /brasa-guarda/.test(t.url)))) && !(await lerStorage(sw, 'br.envio')));

// 4) de verdade (no mock): três disparos juntos (botão, "Mandar agora" do fundo e rodada direta) → UMA rodada só
st.ev.length = 0;
const t0 = Date.now();
await clicar(p, '.menu [data-fog="agora"]');
await swv(() => { self.__brasaGuarda.rodar({ ensaio: false, origem: 'agora' }).catch(() => null); self.__brasaGuarda.rodar({ ensaio: false, origem: 'agora' }).catch(() => null); return 1; });
const aberta = await until(async () => swv(async () => { const ws = await chrome.windows.getAll({ populate: true }); const w = ws.find((x) => x.tabs.some((t) => /brasa-guarda/.test(t.url))); const r = (await chrome.storage.local.get('br.fog.run'))['br.fog.run']; return w ? { state: w.state, focused: w.focused, propria: w.tabs.length === 1, modo: r && r.modo } : null; }), 15000, 200);
// ⚠️ no Chromium headless a janela não fica "minimized" de verdade (o estado volta "normal"); confere que é própria e sem foco
check('abre as Mensagens numa janela própria, sem roubar o foco', aberta && aberta.propria && !aberta.focused && aberta.modo === 'janela', aberta);
const fimReal = await until(async () => ((await lerStorage(sw, 'br.log')) || []).find((x) => x.k === 'fogFim' && x.a[0] === 'real' && x.em > t0), 150000, 500);
check('rodada terminou', !!fimReal, fimReal);
check('disparos simultâneos abriram UMA rodada', ((await lerStorage(sw, 'br.log')) || []).filter((x) => x.k === 'fogInicio' && x.em > t0).length === 1);
const evR = st.ev.filter((x) => x.guarda), env = evR.filter((x) => x.t === 'enviou');
check('mandou em Ana, Fabi (depois de ler a conversa longa), Gabi (lá embaixo na lista) e Mia, sempre na conversa certa (painel novo)', ['Ana', 'Fabi', 'Gabi', 'Mia'].every((n) => env.some((x) => x.conv === CONV[n])) && env.filter((x) => x.conv !== CONV.Iris).length === 4, env.map((x) => x.conv));
check('uma mensagem por conversa', new Set(env.map((x) => x.conv)).size === env.length);
check('(a) Bia: já tinha mandado hoje → não mandou', !env.some((x) => x.conv === CONV.Bia));
check('(b) Caio: ninguém falou ontem → não mandou', !env.some((x) => x.conv === CONV.Caio));
check('(c) Duda: sequência perdida na prévia → desmarcada sem abrir; Enzo (nunca marcado) não foi aberto', !evR.some((x) => x.conv === CONV.Duda || x.conv === CONV.Enzo) && !(await marcadas())[CONV.Duda]);
check('Lia: o envio não saiu e a bolha igual de ontem NÃO conta como enviada', !env.some((x) => x.conv === CONV.Lia) && evR.some((x) => x.t === 'naoSaiu' && x.conv === CONV.Lia));
const mia = env.find((x) => x.conv === CONV.Mia);
check('Mia: rascunho apagado antes; saiu só a frase', mia && mia.texto === 'oi de sempre', mia);
const frases = await lerStorage(sw, 'br.fog.frases');
const fab = await swv(() => self.BRASA_GUARDA.FRASES_PT);
check('mensagem saiu da lista de frases', env.every((x) => (frases || fab).includes(x.texto)), env.map((x) => x.texto));
const dia = await lerStorage(sw, 'br.fog.dia');
check('estado do dia: mandou 4, Iris falhou (dm-warning), Lia falhou (não apareceu), Bia pulou, Caio não mandou; "Mandar agora" não gasta a rodada das 19:00', dia && dia.enviadas === 4 && dia.convs[CONV.Iris].motivo === 'erroEnvio' && dia.convs[CONV.Lia].motivo === 'naoApareceu' && dia.convs[CONV.Bia].res === 'pulou' && dia.convs[CONV.Caio].motivo === 'semOntem' && dia.convs[CONV.Duda].res === 'desmarcou' && !dia.rodadas, dia);
const log = (await lerStorage(sw, 'br.log')).filter((x) => x.k === 'guarda' && x.em > t0);
check('registro: data, conversa por apelido, mandou/pulou/falhou e motivo', log.length >= 6 && log.some((x) => x.a[0] === 'Ana' && x.a[1] === 'mandou') && log.some((x) => x.a[0] === 'Caio' && x.a[2] === 'semOntem'), log.map((x) => x.a.join('|')));
const notif = await swv(() => new Promise((r) => chrome.notifications.getAll((n) => r(Object.keys(n)))));
check('notificação do sistema no fim', notif.some((k) => k.startsWith('brasa-guarda-')), notif);
const pausas = env.map((x) => x.em).sort();
check('pausa aleatória entre conversas respeitada (encurtada no teste)', pausas.length < 2 || pausas[1] - pausas[0] >= 200);
await p.screenshot({ path: path.join(SHOT, 'fog-depois.png') });

// 5) de novo no mesmo dia: só a Iris (falhou) volta; ninguém recebe duas
st.ev.length = 0;
await clicar(p, '.menu [data-fog="agora"]');
const fim2 = await until(async () => (await lerStorage(sw, 'br.log')).filter((x) => x.k === 'fogFim' && x.a[0] === 'real').length >= 2, 120000, 500);
const env2 = st.ev.filter((x) => x.guarda && x.t === 'enviou');
check('segunda rodada no dia: só tenta quem falhou; ninguém recebe duas', !!fim2 && env2.every((x) => x.conv === CONV.Iris), env2.map((x) => x.conv));
await swv(async (ids) => { const d = (await chrome.storage.local.get('br.fog.dia'))['br.fog.dia']; for (const i of ids) d.convs[i] = { res: 'mandou', em: Date.now() }; await chrome.storage.local.set({ 'br.fog.dia': d }); }, [CONV.Iris, CONV.Lia]);
const ext = await ctx.newPage(); await ext.goto(`chrome-extension://${extId}/popup/popup.html`);
const fundo = (cmd) => ext.evaluate((c) => chrome.runtime.sendMessage({ type: 'brasa:guarda', cmd: c }), cmd);
const r3 = await fundo('agora');
check('tudo resolvido hoje: "Mandar agora" não faz nada', r3 && r3.nada === true, r3);

// 6) teto de 20 por dia
await swv(async () => { const d = (await chrome.storage.local.get('br.fog.dia'))['br.fog.dia']; d.enviadas = 20; d.convs = {}; await chrome.storage.local.set({ 'br.fog.dia': d }); });
const r4 = await fundo('agora');
check('teto de 20 mensagens no dia: não roda', r4 && r4.nada === true, r4);

// 7) URGENTE pausa o guarda
await swv(() => chrome.storage.local.set({ 'br.fog.dia': null, 'br.update': { disponivel: true, urgente: true, ultima: '9.9.9', procuradoEm: Date.now(), atual: chrome.runtime.getManifest().version } }));
const r5 = await fundo('agora');
check('versão URGENTE: guarda-foguinho pausado', r5 && r5.erro === 'pausada', r5);
await swv(() => chrome.storage.local.set({ 'br.update': { disponivel: false, procuradoEm: Date.now(), atual: chrome.runtime.getManifest().version } }));

// 8) alarmes recriados e horários
const al = await swv(async () => (await chrome.alarms.getAll()).map((a) => ({ n: a.name, t: a.scheduledTime, p: a.periodInMinutes })));
const g1 = al.find((a) => a.n === 'br-g1'), g2 = al.find((a) => a.n === 'br-g2'), gc = al.find((a) => a.n === 'br-gconf');
check('alarmes: 19:00 e 22:00 diários + conferência a cada 15 min', g1 && new Date(g1.t).getHours() === 19 && g2 && new Date(g2.t).getHours() === 22 && g1.p === 1440 && gc && gc.p === 15, al);
await swv(async () => { await chrome.alarms.clearAll(); });
await fundo('agendar');
check('alarmes recriados pelo fundo', (await swv(async () => (await chrome.alarms.getAll()).length)) >= 3);
await p.bringToFront();
if (!(await estado(p)).menu) await p.evaluate(() => document.querySelector('#brasa-nav button').click());
await until(async () => (await estado(p)).menu);
if ((await estado(p)).aba !== 'Foguinho') await clicar(p, '.menu .tabs [data-aba="fog"]');
await until(() => p.evaluate(() => !!document.querySelector('brasa-ui').shadowRoot.querySelector('input[data-fog="h1"]')));
await p.evaluate(() => { const i = document.querySelector('brasa-ui').shadowRoot.querySelector('input[data-fog="h1"]'); i.value = '18:30'; i.dispatchEvent(new Event('change')); });
const g1b = await until(async () => { const a = await swv(async () => (await chrome.alarms.get('br-g1'))); return a && new Date(a.scheduledTime).getHours() === 18 && new Date(a.scheduledTime).getMinutes() === 30 ? a : null; });
check('mudar o horário principal no menu reagenda o alarme', !!g1b);

// 9) PC acordando depois das 22h, sem nenhuma rodada no dia: a conferência roda; e a aba "congelada" (página demorando) usa o plano C
await swv(async (ids) => { const m = {}; for (const k of ids) m[k] = true; await chrome.storage.local.set({ 'br.fog.marcadas': m, 'br.fog.dia': null }); }, [CONV.Gabi]);
const agora = new Date(); const h = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
await swv(([a, b]) => chrome.storage.local.get('br.ajustes').then((l) => chrome.storage.local.set({ 'br.ajustes': Object.assign({}, l['br.ajustes'], { guardaH1: a, guardaH2: b }) })), agora.getHours() < 3 ? ['00:00', h(new Date(agora - 60e3))] : [h(new Date(agora - 3 * 3600e3)), h(new Date(agora - 3600e3))]); // perto da meia-noite "agora − 3 h" cairia no dia anterior
st.ev.length = 0; st.atrasoDm = 35000; // a página das Mensagens demora 35 s: o ping falha e o fundo traz a janela à frente (plano C)
const tc = Date.now();
const rc = await swv(() => self.__brasaGuarda.conferir('br-gconf'));
check('PC acordou depois do horário: a conferência rodou a rodada', rc && rc.ok, rc);
check('plano C: a página não respondia, o fundo trouxe a janela à frente e devolveu o foco', ((await lerStorage(sw, 'br.log')) || []).some((x) => x.k === 'fogAcordou' && x.em > tc));
check('e mandou depois (Gabi)', st.ev.some((x) => x.guarda && x.t === 'enviou' && x.conv === CONV.Gabi));
const rc2 = await swv(() => self.__brasaGuarda.conferir('br-gconf'));
check('conferência de novo, tudo feito: não roda', rc2 && rc2.pulado, rc2);

// 10) "Continuar com o Chrome fechado": 'background' é aceito como permissão OPCIONAL (pedir exige clique numa página da extensão)
const perm = await swv(async () => { try { await chrome.permissions.request({ permissions: ['background'] }); return 'pediu'; } catch (e) { return String(e.message || e); } });
check('permissão "background" é opcional (o navegador só exige o clique do usuário)', /user gesture/i.test(perm), perm);
const opc = await swv(() => chrome.runtime.getManifest().optional_permissions);
check('manifest: background em optional_permissions, notifications em permissions', opc.includes('background') && (await swv(() => chrome.runtime.getManifest().permissions)).includes('notifications'));
// popup: aba Foguinho aberta pelo ?aba=fog (onde a chave pede a permissão com clique)
const pop = await ctx.newPage();
await pop.goto(`chrome-extension://${extId}/popup/popup.html?aba=fog`);
const ptx = await until(() => pop.evaluate(() => { const r = document.getElementById('app').shadowRoot; return r.querySelector('[data-fog="fechado"]') ? r.querySelector('.pn').textContent : null; }));
check('popup ?aba=fog abre a aba Foguinho com a chave "Continuar com o Chrome fechado"', ptx && ptx.includes('Continuar com o Chrome fechado'), ptx && ptx.slice(0, 120));
await pop.screenshot({ path: path.join(SHOT, 'fog-popup.png'), fullPage: true });
await pop.close();
check('sem erros de script', erros.length === 0, erros.slice(0, 3));
await ctx.close();
fim();
