// Fase 1 (v0.2.0): modo foco. Uso: node e2e-foco.mjs
import path from 'path';
import { abrir, esperarGuia, check, fim, until, wait, estado, clicar, ponte, lerStorage, semTutorial, SHOT } from './lib.mjs';
import { rotas, FEED } from './mock.mjs';

const { ctx, sw, extId } = await abrir();
await esperarGuia(ctx).then((g) => g && g.close());
await semTutorial(sw);
await rotas(ctx);
const S = FEED.sinteticos, TIRAR = [S.anuncio, S.anuncioTT4B, S.live, S.loja, S.lojaEC];
const p = await ctx.newPage();
const erros = [];
p.on('pageerror', (e) => erros.push(String(e)));
await p.goto('https://www.tiktok.com/foryou?login=1&banner=1');
await until(() => p.evaluate(() => window.__mock && window.__mock.pronto));

// barra lateral (v0.6.4, pedido do André): fica INTEIRA e clicável; o modo foco só mexe no feed e nos banners
const visiveis = () => p.evaluate(() => {
  // true = na tela e clicável · false = escondido, apagado ou sem clique
  const vis = (sel) => { const e = document.querySelector(sel); if (!e) return null; let x = e; while (x && x !== document.body) { const cs = getComputedStyle(x); if (cs.display === 'none' || +cs.opacity < 0.5) return false; x = x.parentElement; } return getComputedStyle(e).pointerEvents !== 'none'; };
  return { foryou: vis('[data-e2e="nav-foryou"]'), following: vis('[data-e2e="nav-following"]'), messages: vis('[data-e2e="nav-messages"]'), profile: vis('[data-e2e="nav-profile"]'), brasa: vis('#brasa-nav button'),
    explore: vis('[data-e2e="nav-explore"]'), live: vis('[data-e2e="nav-live"]'), shop: vis('[data-e2e="nav-shop"]'), drama: vis('[data-e2e="nav-short-drama"]'), upload: vis('[data-e2e="nav-upload"]'),
    friends: vis('[data-e2e="nav-friends"]'), activity: vis('[data-e2e="nav-activity"]'), mais: vis('[data-e2e="nav-more-menu"]'), util: vis('[data-e2e="side-nav-utilities"]'), banner: vis('#banner-live') };
});
let v = await until(async () => { const x = await visiveis(); return x.brasa && x.banner === false ? x : null; });
check('barra lateral inteira e clicável com o modo foco ligado: Para você, Explorar, Seguindo, Amigos, LIVE, Loja, Mensagens, Atividade, Carregar, Perfil, Mais, Obter app e Brasa',
  v && [v.foryou, v.following, v.messages, v.profile, v.brasa, v.explore, v.live, v.shop, v.drama, v.upload, v.friends, v.activity, v.mais, v.util].every((x) => x === true), v);
check('nenhum cadeado nem item apagado na barra', !(await p.evaluate(() => [...document.querySelectorAll('#navc *')].some((e) => getComputedStyle(e, '::after').maskImage && getComputedStyle(e, '::after').maskImage !== 'none'))));
await p.mouse.click(...(await p.evaluate(() => { const r = document.querySelector('[data-e2e="nav-explore"]').getBoundingClientRect(); return [r.left + 40, r.top + r.height / 2]; })));
check('clicar em Explorar abre o Explorar (nada bloqueado)', !!(await until(() => /\/explore$/.test(p.url()), 3000, 100)), p.url());
check('sem aviso de bloqueio', !/[Bb]loquead/.test((await estado(p)).toast || ''));
await p.evaluate(() => window.__ir('/foryou'));
await until(() => p.evaluate(() => document.querySelectorAll('article').length > 0));
check('banner flutuante de LIVE some', v && v.banner === false, v && v.banner);
await p.screenshot({ path: path.join(SHOT, 'foco-barra.png') });

// feed: o que a página desenhou nas 3 levas do Para você + preload (XHR)
for (let i = 0; i < 6; i++) { await p.evaluate(() => document.querySelector('[data-e2e="feed-navigation-next"]').click()); await wait(350); }
await until(async () => (await p.evaluate(() => window.__mock.respostas.filter((r) => r.via === 'fetch').length)) >= 3, 15000);
await wait(500);
const desenhados = await p.evaluate(() => window.__mock.renderizados.slice());
const reais = [...new Set(FEED.recommend.flatMap((pg) => pg.itemList.map((i) => i.id)).filter((id) => !TIRAR.includes(id)))];
check('Para você (fetch): nenhum anúncio, LIVE ou loja chegou ao site', TIRAR.every((id) => !desenhados.includes(id)), desenhados);
check('Para você: os vídeos normais continuam todos', reais.every((id) => desenhados.includes(id)), { faltam: reais.filter((id) => !desenhados.includes(id)) });
const pre = await p.evaluate(() => window.__mock.preloadIds);
check('preload (XHR): anúncio tirado da resposta antes de o site ler', pre && !pre.includes(S.anuncio) && pre.length === 2, pre);
const st = await ponte(p, 'stats');
check('page.js recebeu os ajustes do content script', st && st.cfg && st.cfg.foco === true && st.cfg.ativo === true, st && st.cfg);
const c1 = await until(async () => { const c = await lerStorage(sw, 'br.contador'); return c && c.anuncio === 2 && c.live === 1 && c.loja === 2 ? c : null; });
check('contador do dia: 2 anúncios, 1 live, 2 de loja (sem contar o mesmo duas vezes)', !!c1, await lerStorage(sw, 'br.contador'));

// menu: seção Modo foco com o contador
await p.evaluate(() => document.querySelector('#brasa-nav button').click());
let e = await until(async () => { const s = await estado(p); return s.menu && /Hoje a Brasa tirou 2 anúncios, 1 live e 2 de lojinha/.test(s.menuTexto) ? s : null; });
check('menu: "Hoje a Brasa tirou 2 anúncios, 1 live e 2 de lojinha"', !!e, (await estado(p)).menuTexto.slice(0, 220));
await p.screenshot({ path: path.join(SHOT, 'foco-menu.png') });

// navegação interna: Seguindo também filtra (LIVE no meio)
await p.evaluate(() => window.__ir('/following'));
await until(async () => (await p.evaluate(() => window.__mock.respostas.some((r) => r.via === 'fetch-following'))));
await wait(300);
const seg = await p.evaluate(() => window.__mock.renderizados.slice(-3));
check('Seguindo (navegação interna): LIVE tirado, o resto fica', !seg.includes(S.live) && seg.length >= 2, seg);

// desligar uma chave: "Avisos de live e loja" volta o banner na hora, sem recarregar
await p.evaluate(() => { window.__marca = 7; });
const t0 = Date.now();
await clicar(p, '.menu [data-aj="escBanners"]');
v = await until(async () => { const x = await visiveis(); return x.banner ? x : null; }, 3000, 50);
check('chave "Avisos de live e loja" desligada: o banner volta na hora', !!v, { ms: Date.now() - t0, v });
check('(sem recarregar)', (await p.evaluate(() => window.__marca)) === 7);
await clicar(p, '.menu [data-aj="escBanners"]');
check('ligada de novo: some', !!(await until(async () => (await visiveis()).banner === false, 3000, 50)));
check('mudança de chave vai para o registro', !!(await until(async () => ((await lerStorage(sw, 'br.log')) || []).find((x) => x.k === 'chave' && x.a[0] === 'Avisos de live e loja'))));

// tirar só LIVE desligado: LIVE passa, anúncio continua saindo
await clicar(p, '.menu [data-aj="focoLive"]');
await until(async () => { const s = await ponte(p, 'stats'); return s && s.cfg.live === false; });
await p.evaluate(() => window.__ir('/following'));
await until(async () => (await p.evaluate(() => window.__mock.respostas.filter((r) => r.via === 'fetch-following').length)) >= 2);
await wait(300);
check('"Tirar LIVE" desligado: o LIVE passa no Seguindo', (await p.evaluate(() => window.__mock.renderizados.slice(-3))).includes(S.live));
await clicar(p, '.menu [data-aj="focoLive"]');

// modo foco desligado: devolve tudo na hora, e o feed seguinte vem completo
await clicar(p, '.menu [data-aj="foco"]');
v = await until(async () => { const x = await visiveis(); return x.banner ? x : null; }, 3000, 50);
check('modo foco desligado: o banner volta na hora', !!v, v);
e = await estado(p);
check('menu esconde as opções do modo foco quando ele está desligado', !e.menuTexto.includes('Tirar do feed'));
await p.evaluate(() => window.__ir('/foryou'));
for (let i = 0; i < 12; i++) { await p.evaluate(() => document.querySelector('[data-e2e="feed-navigation-next"]').click()); await wait(250); }
await wait(800);
const tudo = await p.evaluate(() => window.__mock.renderizados.slice());
check('modo foco desligado: a próxima leva vem completa (anúncio aparece)', tudo.includes(S.anuncio), tudo.length);
await clicar(p, '.menu [data-aj="foco"]');
check('modo foco ligado de novo: banner some', !!(await until(async () => (await visiveis()).banner === false, 3000, 50)));

// chave geral da Brasa desligada também desliga o modo foco
await clicar(p, '.menu [data-act=on]');
check('Brasa desligada: o banner volta e o page.js para de filtrar', !!(await until(async () => (await visiveis()).banner)) && (await ponte(p, 'stats')).cfg.ativo === false);
await clicar(p, '.menu [data-act=on]');
await until(async () => (await visiveis()).banner === false);

// plano B: anúncio que escapa do filtro (rota não filtrada) → pula sozinho em menos de 1 s, pelo botão nativo
const p2 = await ctx.newPage();
await p2.goto('https://www.tiktok.com/foryou?planob=1');
await until(() => p2.evaluate(() => window.__mock && window.__mock.renderizados.length > 0));
const t1 = Date.now();
const pulo = await until(() => p2.evaluate(() => window.__mock.proximos >= 1), 3000, 30);
check('plano B: o anúncio que chegou à tela é pulado em menos de 1 s', pulo && Date.now() - t1 < 1000, { ms: Date.now() - t1 });
await wait(1500);
const p2s = await p2.evaluate(() => { const a = [...document.querySelectorAll('article')].find((x) => { const r = x.getBoundingClientRect(); return r.top <= innerHeight / 2 && r.bottom >= innerHeight / 2; }); return { prox: window.__mock.proximos, tela: a && a.querySelector('[id^=xgwrapper-]').id }; });
check('plano B: pula também a loja em seguida (pela memória do page.js), uma vez cada, e para no vídeo normal', p2s.prox === 2 && p2s.tela.endsWith(FEED.escape.itemList[2].id), p2s);
await p2.close();

// popup: a mesma seção, e mudar lá vale na aba aberta
const pop = await ctx.newPage();
await pop.goto(`chrome-extension://${extId}/popup/popup.html`);
const ptx = await until(() => pop.evaluate(() => { const r = document.getElementById('app').shadowRoot; return r.querySelector('[data-aj="escBanners"]') ? r.querySelector('.pn').textContent : null; }));
check('popup: cartão Modo foco com as chaves e o contador', ptx && ptx.includes('Modo foco') && ptx.includes('Hoje a Brasa tirou'), ptx && ptx.slice(0, 160));
await pop.evaluate(() => document.getElementById('app').shadowRoot.querySelector('[data-aj="escBanners"]').click());
check('desligar "Avisos de live e loja" no popup mostra o banner na aba do TikTok', !!(await until(async () => (await visiveis()).banner, 5000, 100)));
await pop.screenshot({ path: path.join(SHOT, 'foco-popup.png') });
await pop.evaluate(() => document.getElementById('app').shadowRoot.querySelector('[data-aj="escBanners"]').click());
await pop.close();

// tema escuro: o menu com a seção
await p.bringToFront();
await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
await wait(1200);
if (!(await estado(p)).menu) await p.evaluate(() => document.querySelector('#brasa-nav button').click());
await wait(300);
await p.screenshot({ path: path.join(SHOT, 'foco-menu-escuro.png') });
check('sem erros de script', erros.length === 0, erros.slice(0, 3));
await ctx.close();
fim();
