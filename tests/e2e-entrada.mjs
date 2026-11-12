// v1.0.1: entrada direta que cai na página de um vídeo ("Comentários | Você pode gostar" aberta em "Você pode gostar").
// TikTok simulado fiel ao medido em 2026-11-12 (ferramentas/medir-entrada.mjs e medir-video-abas.mjs). Uso: node e2e-entrada.mjs
import path from 'path';
import { abrir, esperarGuia, check, fim, until, wait, estado, lerStorage, semTutorial, SHOT } from './lib.mjs';
import { rotas } from './mock.mjs';

const { ctx, sw } = await abrir();
await esperarGuia(ctx).then((g) => g && g.close());
await semTutorial(sw);
await rotas(ctx);
const erros = [];
const aj = (o) => sw.evaluate((o) => chrome.storage.local.get('br.ajustes').then((l) => chrome.storage.local.set({ 'br.ajustes': Object.assign({}, l['br.ajustes'] || {}, o) })), o);
const nova = async (url) => { const p = await ctx.newPage(); p.on('pageerror', (e) => erros.push(String(e))); await p.goto(url); await until(() => p.evaluate(() => window.__mock && window.__mock.pronto)); return p; };
const attr = (p, a) => p.evaluate((a) => document.documentElement.getAttribute(a), a);
const mk = (p) => p.evaluate(() => window.__mock);
const pagVideo = (p) => p.evaluate(() => getComputedStyle(document.getElementById('painel-video')).display !== 'none');
const abaAtiva = (p) => p.evaluate(() => (getComputedStyle(document.getElementById('pv-coment')).display !== 'none' ? 'coment' : getComputedStyle(document.getElementById('pv-rel')).display !== 'none' ? 'rel' : null));

// 1) entrada pela raiz que o site troca por um vídeo solto → Para você, uma vez
const p1 = await nova('https://www.tiktok.com/?login=1&vaiParaVideo=1');
const foi = await until(async () => /^foi-para-voce/.test((await attr(p1, 'data-brasa-entrada')) || '') ? attr(p1, 'data-brasa-entrada') : null, 8000, 100);
check('entrada pela raiz que caiu num vídeo solto: foi para o Para você', foi === 'foi-para-voce-raiz', [foi, await attr(p1, 'data-brasa-entrada')]);
check('pelo "Para você" do próprio site, sem recarregar (URL /, feed com setas, sem as abas)', !!(await until(async () => { const m = await mk(p1); return new URL(p1.url()).pathname === '/' && !(await pagVideo(p1)) && m.renderizados.length >= 2; }, 6000)), [p1.url(), (await mk(p1)).irs]);
check('avisa "Abri o Para você"', /Abri o Para você/.test((await estado(p1)).toast || ''), (await estado(p1)).toast);
await wait(5000);
check('sem laço: um clique só no "Para você"', JSON.stringify((await mk(p1)).irs) === JSON.stringify(['/']), (await mk(p1)).irs);
const log = ((await lerStorage(sw, 'br.log')) || []).filter((x) => x.k === 'entrada').map((x) => x.a[0]);
check('registro: "Abrir no Para você"', log.includes('raiz'), log);
await p1.screenshot({ path: path.join(SHOT, 'entrada-depois.png') });
// recarregar: com os Comentários abertos a URL do feed já é a do vídeo (/@x/video/id); recarregar ali é o caso do relato →
// volta ao Para você, uma vez (sem laço)
const urlAntes = new URL(p1.url()).pathname;
await p1.reload(); await until(() => p1.evaluate(() => window.__mock && window.__mock.pronto));
const r1 = await until(async () => { const x = await attr(p1, 'data-brasa-entrada'); return /^foi-para-voce/.test(x || '') && new URL(p1.url()).pathname === '/' ? x : null; }, 8000, 100);
await wait(3000);
check('recarregar na URL do feed com comentários: volta ao Para você uma vez', /\/@mock\/video\//.test(urlAntes) && r1 === 'foi-para-voce-lembrada' && JSON.stringify((await mk(p1)).irs) === JSON.stringify(['/']), [urlAntes, r1, (await mk(p1)).irs]);
// recarregar em "/" (sem comentários abertos): feed normal, nada a fazer
await aj({ coment: false });
await p1.goto('https://www.tiktok.com/?login=1'); await until(() => p1.evaluate(() => window.__mock && window.__mock.pronto));
await p1.reload(); await until(() => p1.evaluate(() => window.__mock && window.__mock.pronto));
await wait(2500);
check('recarregar em "/": feed normal, nada a fazer', !(await mk(p1)).irs && !(await pagVideo(p1)) && (await attr(p1, 'data-brasa-entrada')) === 'sem-pagina-de-video', await attr(p1, 'data-brasa-entrada'));
await aj({ coment: true });
await p1.close();

// 2) a Brasa lembra os vídeos cuja URL viu no feed (comentários abertos) e, se a aba voltar num deles, vai para o Para você
const p2 = await nova('https://www.tiktok.com/foryou?login=1');
const urlFeed = await until(() => p2.evaluate(() => (/\/@mock\/video\/\d+/.test(location.pathname) ? location.pathname : null)), 8000, 150);
const idFeed = urlFeed && urlFeed.split('/').pop();
const mem = await until(async () => { const m = (await lerStorage(sw, 'br.urlsFeed')) || {}; return m[idFeed] ? m : null; }, 6000);
check('com os comentários abertos no feed, a Brasa lembra o vídeo da URL', !!mem && Date.now() - mem[idFeed] < 60000, [urlFeed, mem && Object.keys(mem).length]);
await p2.close();
const p3 = await nova(`https://www.tiktok.com${urlFeed}?login=1&setas=1`); // aba reaberta na URL do feed (com conta: vários vídeos e setas)
const foi3 = await until(async () => { const x = await attr(p3, 'data-brasa-entrada'); return /^foi-para-voce/.test(x || '') ? x : null; }, 8000, 100);
check('aba que volta num vídeo do feed ("Você pode gostar" na tela): vai para o Para você', foi3 === 'foi-para-voce-lembrada' && !!(await until(async () => new URL(p3.url()).pathname === '/' && !(await pagVideo(p3)), 6000)), [foi3, p3.url()]);
await p3.close();

// 3) link de vídeo aberto de fora (a Brasa nunca viu no feed): fica no vídeo; Comentários abertos troca a aba
const p4 = await nova('https://www.tiktok.com/@outra/video/7799999999999999999?login=1&setas=1');
await wait(3500);
check('link de vídeo de fora: NÃO vai para o Para você', (await attr(p4, 'data-brasa-entrada')) === 'link-de-video' && !(await mk(p4)).irs && (await pagVideo(p4)) && /\/video\/7799999999999999999/.test(p4.url()), [await attr(p4, 'data-brasa-entrada'), p4.url()]);
check('a aba da direita foi para "Comentários" pelo botão do próprio site', (await abaAtiva(p4)) === 'coment' && (await mk(p4)).abas.some((a) => a.aba === 'coment' && !a.confiavel), [await abaAtiva(p4), (await mk(p4)).abas]);
check('modo foco também na lista do "Você pode gostar" (rota related): sem anúncio e sem LIVE', !(await mk(p4)).renderizados.includes('7000000000000000001') && !(await mk(p4)).renderizados.includes('7000000000000000003') && (await mk(p4)).renderizados.length >= 2, (await mk(p4)).renderizados);
// a pessoa escolhe "Você pode gostar" com um clique de verdade: a Brasa respeita naquele vídeo
const r = await p4.evaluate(() => { const q = document.getElementById('aba-rel').getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
await p4.mouse.click(r[0], r[1]);
await wait(5000);
check('a pessoa clicou em "Você pode gostar": fica lá (a Brasa não volta para Comentários)', (await abaAtiva(p4)) === 'rel' && (await attr(p4, 'data-brasa-coment')) === 'pessoa-escolheu-relacionados', [await abaAtiva(p4), await attr(p4, 'data-brasa-coment')]);
await p4.screenshot({ path: path.join(SHOT, 'entrada-link.png') });
await p4.close();

// 4) chave "Abrir sempre no Para você" desligada: fica como o TikTok fez
await aj({ paraVoce: false });
const p5 = await nova('https://www.tiktok.com/?login=1&vaiParaVideo=1');
await wait(4000);
check('chave desligada: fica no vídeo solto, como o TikTok fez', !(await mk(p5)).irs && (await pagVideo(p5)) && (await attr(p5, 'data-brasa-entrada')) === 'desligado', [await attr(p5, 'data-brasa-entrada'), p5.url()]);
await p5.close();
await aj({ paraVoce: true });
// menu: cartão novo, ligado de fábrica
const p6 = await nova('https://www.tiktok.com/foryou?login=1');
await p6.evaluate(() => document.querySelector('#brasa-nav button').click());
const e = await until(async () => { const s = await estado(p6); return s.menu && /Abrir sempre no Para você/.test(s.menuTexto) ? s : null; });
check('menu: cartão "Abrir sempre no Para você" (ligado de fábrica) com a frase simples', !!e && /Link de vídeo que você abriu de propósito fica onde está/.test(e.menuTexto) && (await p6.evaluate(() => document.querySelector('brasa-ui').shadowRoot.querySelector('.menu [data-aj="paraVoce"]').getAttribute('aria-checked'))) === 'true');
await p6.keyboard.press('Escape');
// modo foco também no Amigos (a rota é "friends"; antes só casava "friend")
await p6.evaluate(() => window.__ir('/friends'));
await until(async () => (await mk(p6)).respostas.some((x) => x.via === 'fetch-friends'));
await wait(800);
check('modo foco no Amigos: o LIVE da resposta não chega à tela', !(await mk(p6)).renderizados.includes('7000000000000000003'), (await mk(p6)).renderizados);
await p6.close();

// 5) Mensagens (onde o guarda-foguinho trabalha): a regra de entrada nunca age
const p7 = await ctx.newPage(); p7.on('pageerror', (e) => erros.push(String(e)));
await p7.goto('https://www.tiktok.com/messages'); await p7.waitForSelector('[data-e2e="dm-new-conversation-item"]');
await wait(1500);
check('Mensagens: a regra de entrada não age', (await attr(p7, 'data-brasa-entrada')) === 'nao-e-entrada', await attr(p7, 'data-brasa-entrada'));
await p7.close();
check('sem erros de script', erros.length === 0, erros.slice(0, 3));
await ctx.close();
fim();
