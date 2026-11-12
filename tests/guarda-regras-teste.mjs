// Fase 2: regras do guarda-foguinho e leitor de protobuf, em Node (sem navegador). Uso: node guarda-regras-teste.mjs
import { createRequire } from 'module'; import path from 'path';
import { check, fim, EXT } from './lib.mjs';
const require = createRequire(import.meta.url);
const G = require(path.join(EXT, 'src', 'guarda-regras.js'));
const P = require(path.join(EXT, 'src', 'proto.js'));
const D = require(path.join(EXT, 'src', 'defaults.js'));

const AGORA = new Date(2026, 10, 11, 19, 5).getTime(); // 11/11/2026 19:05
// separadores medidos
check('separador "18:50" = hoje', G.lerSeparador('18:50', AGORA) === '2026-11-11');
check('separador "9 de novembro de 2026, 23:33" = 09/11', G.lerSeparador('9 de novembro de 2026, 23:33', AGORA) === '2026-11-09');
check('separador "10 de novembro de 2026, 08:35" = ontem', G.lerSeparador('10 de novembro de 2026, 08:35', AGORA) === '2026-11-10');
check('separador em inglês "November 10, 2026 8:35 AM"', G.lerSeparador('November 10, 2026 8:35 AM', AGORA) === '2026-11-10');
check('separador em espanhol "10 de noviembre de 2026, 08:35"', G.lerSeparador('10 de noviembre de 2026, 08:35', AGORA) === '2026-11-10');
check('separador "Ontem 22:10" e "8-11-2026"', G.lerSeparador('Ontem 22:10', AGORA) === '2026-11-10' && G.lerSeparador('8-11-2026', AGORA) === '2026-11-08');
check('separador sem ano ("31 de dezembro") vai para o ano anterior', G.lerSeparador('31 de dezembro, 10:00', AGORA) === '2025-12-31');
check('texto qualquer não vira data', G.lerSeparador('Fulano curtiu', AGORA) === null);
check('"2 days ago" / "há 3 dias" não viram agosto', G.lerSeparador('2 days ago', AGORA) === '2026-11-09' && G.lerSeparador('há 3 dias', AGORA) === '2026-11-08');
check('en-US: "11/10/2026" = 10 de novembro (mês/dia)', G.lerSeparador('11/10/2026 10:00 AM', AGORA, true) === '2026-11-10' && G.lerSeparador('10/11/2026', AGORA, false) === '2026-11-10');
check('mensagem comum falando de "sequência perdida" não desmarca (só a de sistema)', G.decidir(G.analisar([{ sep: '10 de novembro de 2026, 21:00' }, { msg: true, eu: false, texto: 'quase perdi a sequência perdida kkk' }], AGORA)).acao === 'mandar');

const sep = (s) => ({ sep: s }), eu = (t) => ({ msg: true, eu: true, texto: t || 'x' }), ele = (t) => ({ msg: true, eu: false, texto: t || 'y' });
const ANT = '8 de novembro de 2026, 10:00', ONT = '10 de novembro de 2026, 21:00';
let a = G.analisar([sep(ANT), eu(), ele(), sep(ONT), ele(), eu(), sep('09:12'), ele()], AGORA);
check('conversa com troca ontem e nada meu hoje → mandar', G.decidir(a).acao === 'mandar', a);
a = G.analisar([sep(ANT), eu(), sep(ONT), ele(), sep('18:30'), eu()], AGORA);
check('(a) eu já mandei hoje → pular', G.decidir(a).acao === 'pular' && G.decidir(a).motivo === 'jaMandou');
a = G.analisar([sep(ANT), eu(), ele(), sep('09:00'), ele()], AGORA);
check('(b) ninguém falou ontem → não manda ("foguinho talvez já apagou")', G.decidir(a).acao === 'naoMandar' && G.decidir(a).motivo === 'semOntem');
a = G.analisar([sep(ONT), ele(), { sistema: 'Sequência de 12 dias perdidos. Restaurar' }], AGORA);
check('(c) sequência perdida ontem → desmarca', G.decidir(a).acao === 'desmarcar');
a = G.analisar([sep('5 de abril de 2026, 10:00'), { sistema: 'Animal da Sequência e Sequência de 385 dias perdidos. Restaurar' }, sep(ONT), eu(), ele()], AGORA);
check('sequência perdida antiga (abril) não conta: manda', G.decidir(a).acao === 'mandar');
a = G.analisar([sep(ONT), ele(), eu()], AGORA);
check('leitura que não chegou antes de ontem, com troca ontem → manda (ontem visto)', G.decidir(a).acao === 'mandar');
a = G.analisar([sep('10:00'), ele(), ele()], AGORA);
check('leitura incompleta sem ver ontem → falha com nova tentativa na reserva (não li)', G.decidir(a).acao === 'falhar' && G.decidir(a).motivo === 'naoLi');
a = G.analisar([sep('10:00'), ele()], AGORA, true);
check('conversa inteira lida, sem ontem → semOntem', G.decidir(a).motivo === 'semOntem');
check('regra (c) vem antes da (a)', G.decidir(G.analisar([sep(ONT), { sistema: 'Streak lost' }, sep('10:00'), eu()], AGORA)).acao === 'desmarcar');

// provável foguinho
const dias3 = { '2026-11-10': { eu: true, outro: true }, '2026-11-09': { eu: true, outro: true }, '2026-11-08': { eu: true, outro: true } };
check('provável: dos dois lados nos 3 dias antes de hoje', G.provavel(dias3, AGORA) === true);
check('não provável se um dos 3 dias só tem um lado', G.provavel(Object.assign({}, dias3, { '2026-11-09': { eu: true, outro: false } }), AGORA) === false);

// frases
const F = ['A', 'B'];
let rep = 0; for (let i = 0; i < 200; i++) if (G.sortearFrase(F, 'A') === 'A') rep++;
check('sorteio nunca repete a frase de ontem na mesma conversa', rep === 0);
check('com uma frase só, usa ela', G.sortearFrase(['A'], 'A') === 'A');
check('lista vazia → sem frase', G.sortearFrase([' ', ''], null) === null);
check('10 frases de fábrica em PT', G.FRASES_PT.length === 10);

// plano e teto
const convs = {}; for (let i = 0; i < 25; i++) convs['0:1:1:' + i] = { marcada: i !== 3 };
let pl = G.planejar(convs, null, AGORA);
check('só as marcadas; teto de 20 envios por dia (a rodada para quando as vagas acabam)', pl.fila.length === 24 && !pl.fila.includes('0:1:1:3') && pl.vagas === 20);
const est = { dia: '2026-11-11', rodadas: 1, enviadas: 18, convs: { '0:1:1:0': { res: 'mandou' }, '0:1:1:1': { res: 'falhou' }, '0:1:1:2': { res: 'pulou' } } };
pl = G.planejar(convs, est, AGORA);
check('quem já foi resolvido hoje sai; quem falhou volta; sobram 2 vagas', pl.vagas === 2 && pl.fila.includes('0:1:1:1') && !pl.fila.includes('0:1:1:0') && !pl.fila.includes('0:1:1:2'));
pl = G.planejar(convs, est, AGORA + 24 * 3600e3);
check('dia novo zera o estado', pl.fila.length === 24 && pl.vagas === 20);

// quando rodar
const cfg = { h1: '19:00', h2: '22:00' };
const t = (h, m) => new Date(2026, 10, 11, h, m).getTime();
check('18:59 → ainda não', !G.deveRodar(t(18, 59), cfg, null, true));
check('19:00 → 1ª rodada', G.deveRodar(t(19, 0), cfg, null, true));
check('20:00 depois da 1ª → espera a reserva', !G.deveRodar(t(20, 0), cfg, { dia: '2026-11-11', rodadas: 1, convs: {} }, true));
check('22:00 → reserva', G.deveRodar(t(22, 0), cfg, { dia: '2026-11-11', rodadas: 1, convs: {} }, true));
check('PC acordando 23:10 sem nenhuma rodada → roda', G.deveRodar(t(23, 10), cfg, null, true));
check('depois das 2 rodadas → não roda mais sozinho', !G.deveRodar(t(23, 30), cfg, { dia: '2026-11-11', rodadas: 2, convs: {} }, true));
check('sem ninguém na fila → não roda', !G.deveRodar(t(19, 30), cfg, null, false));
check('próximo 19:00 a partir de 19:05 = amanhã', new Date(G.proximo('19:00', AGORA)).getDate() === 12 && new Date(G.proximo('22:00', AGORA)).getDate() === 11);

// protobuf: StreakValue dentro de StreakCommandMessage dentro de um pacote
const conv = '0:1:7111111111111111111:7000000000000000001';
const user = (uid, ts) => P.codificar([[1, 0, BigInt(uid)], [2, 0, ts]]);
const sv = P.codificar([[1, 2, user('7111111111111111111', 1794430000)], [1, 2, user('7000000000000000001', 1794431000)], [2, 0, 1790000000], [3, 0, 42], [4, 2, 'America/Sao_Paulo'], [5, 0, 1794500000], [7, 0, 2], [100, 0, 1], [101, 2, conv]]);
const cmd = P.codificar([[1, 0, 3], [2, 2, sv], [3, 0, 0]]);
const pacote = P.codificar([[1, 0, 100001], [5, 2, P.codificar([[8, 2, cmd], [9, 2, 'ruido']])], [7, 2, 'x'.repeat(30)]]);
const achou = P.acharSequencias(pacote);
check('protobuf: acha o StreakValue aninhado (42 dias, fuso, 2 pessoas)', achou.length === 1 && achou[0].dias === 42 && achou[0].conv === conv && achou[0].fuso === 'America/Sao_Paulo' && achou[0].users.length === 2 && achou[0].users[0].uid === '7111111111111111111', achou[0]);
check('protobuf sem sequência → nada', P.acharSequencias(P.codificar([[1, 0, 5], [2, 2, 'oi'], [101, 2, 'nao e conversa']])).length === 0);
check('bytes aleatórios não quebram', (() => { try { for (let i = 0; i < 300; i++) P.acharSequencias(Uint8Array.from({ length: 200 }, () => Math.random() * 256 | 0)); return true; } catch (e) { return false; } })());
const zlib = await import('zlib');
const gz = new Uint8Array(zlib.gzipSync(Buffer.from(pacote)));
const embrulho = P.codificar([[1, 0, 1], [8, 2, gz]]);
const achouGz = await P.acharSequenciasTudo(embrulho);
check('protobuf com trecho gzip (websocket) → abre e acha', achouGz.length === 1 && achouGz[0].dias === 42);
check('defaults: guarda ligado de fábrica, 19:00 e 22:00', D.AJ.guarda === true && D.AJ.guardaH1 === '19:00' && D.AJ.guardaH2 === '22:00');
fim();
