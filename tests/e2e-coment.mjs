// v0.6.2: comentários abertos ao entrar no Para você (ligado de fábrica); v0.6.5: também no Seguindo e no Amigos. Uso: node e2e-coment.mjs
// O mock imita o medido ao vivo: abrir troca a URL para /@perfil/video/<id>, empurra o vídeo e as setas; fechar volta a URL.
import path from 'path';
import { abrir, esperarGuia, check, fim, until, wait, estado, clicar, semTutorial, lerStorage, SHOT } from './lib.mjs';
import { rotas } from './mock.mjs';

const { ctx, sw } = await abrir();
await esperarGuia(ctx).then((g) => g && g.close());
await semTutorial(sw);
await rotas(ctx);
const p = await ctx.newPage();
const erros = []; p.on('pageerror', (e) => erros.push(String(e)));
await p.goto('https://www.tiktok.com/foryou');
await until(() => p.evaluate(() => window.__mock && window.__mock.pronto));
const aberto = () => p.evaluate(() => getComputedStyle(document.getElementById('comentarios')).display !== 'none');
const nCom = () => p.evaluate(() => window.__mock.cliquesComent);

check('entrou no Para você: os comentários abrem sozinhos', !!(await until(aberto, 6000, 100)));
check('abriu pelo botão "comentar" do próprio TikTok, uma vez só', (await nCom()) === 1, await nCom());
check('a URL vira /@…/video/<id> (como o site)', /\/@mock\/video\/\d+/.test(p.url()), p.url());
await wait(1500);
const blo = await p.evaluate(() => { const c = document.querySelector('.brasa-acoes'), pn = document.getElementById('comentarios'); if (!c) return null; const r = c.getBoundingClientRect(), q = pn.getBoundingClientRect(); return { auto: !!c.querySelector('.brasa-auto'), cobrePainel: r.right > q.left }; });
check('com os comentários abertos a Brasa segue no Para você (bloco com Auto, ao lado do painel)', blo && blo.auto && !blo.cobrePainel, blo);
await p.screenshot({ path: path.join(SHOT, 'coment-aberto.png') });

// passa de vídeo: o painel fica aberto e a Brasa não clica de novo
await p.evaluate(() => document.querySelector('[data-e2e="feed-navigation-next"]').click());
await wait(2500);
check('ao passar de vídeo continua aberto, sem clique novo', (await aberto()) && (await nCom()) === 1 && /\/@mock\/video\//.test(p.url()), { n: await nCom(), url: p.url() });

// o próprio site fecha (ex.: recarregou o feed): a Brasa abre de novo
await p.evaluate(() => window.__comentarios(false));
check('se o site fechar sozinho, a Brasa abre de novo', !!(await until(aberto, 6000, 100)) && (await nCom()) === 2, await nCom());

// a pessoa fecha com um clique de verdade no ícone: fica fechado nesta visita
const r = await p.evaluate(() => { const a = [...document.querySelectorAll('article')].find((x) => { const q = x.getBoundingClientRect(); return q.top <= innerHeight / 2 && q.bottom >= innerHeight / 2; }); const q = a.querySelector('[data-e2e="comment-icon"]').getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
await p.mouse.click(r[0], r[1]);
await wait(5000);
check('a pessoa fechou: a URL volta a /foryou e a Brasa não reabre', !(await aberto()) && /\/foryou$/.test(p.url()) && (await nCom()) === 3, { n: await nCom(), url: p.url() });

// fechar pelo X do painel (clique de verdade) também conta como a pessoa fechando
await p.evaluate(() => window.__ir('/following')); await wait(500);
await p.evaluate(() => window.__ir('/foryou'));
check('nova visita: abre de novo', !!(await until(aberto, 6000, 100)));
const x = await p.evaluate(() => { const q = document.getElementById('coment-x').getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
await p.mouse.click(x[0], x[1]);
await wait(5000);
check('fechou pelo X do painel (aria-label "exit"): não reabre', !(await aberto()));

// v0.6.5 (pedido do André): Seguindo e Amigos também abrem (trocar de feed conta como visita nova)
const n0 = await nCom();
await p.evaluate(() => window.__ir('/following'));
check('Seguindo: os comentários abrem sozinhos', !!(await until(aberto, 6000, 100)) && (await nCom()) === n0 + 1, { n: await nCom(), c: await p.evaluate(() => document.documentElement.getAttribute('data-brasa-coment')) });
check('Seguindo com comentários: a URL vira /@…/video/<id> e a Brasa segue no feed (Auto no bloco)', /\/@mock\/video\//.test(p.url()) && !!(await until(() => p.evaluate(() => !!document.querySelector('.brasa-acoes .brasa-auto')), 4000)), p.url());
await p.evaluate(() => document.querySelector('[data-e2e="feed-navigation-next"]').click());
await wait(2500);
check('Seguindo: ao passar de vídeo continua aberto, sem clique novo', (await aberto()) && (await nCom()) === n0 + 1, await nCom());
await p.evaluate(() => window.__ir('/friends'));
check('Amigos: os comentários abrem sozinhos', !!(await until(aberto, 6000, 100)) && (await nCom()) === n0 + 2, { n: await nCom(), c: await p.evaluate(() => document.documentElement.getAttribute('data-brasa-coment')) });
check('Amigos com comentários: a Brasa segue no feed (Auto no bloco)', !!(await until(() => p.evaluate(() => !!document.querySelector('.brasa-acoes .brasa-auto')), 4000)));
await p.screenshot({ path: path.join(SHOT, 'coment-amigos.png') });
const xa = await p.evaluate(() => { const q = document.getElementById('coment-x').getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
await p.mouse.click(xa[0], xa[1]);
await wait(4000);
check('Amigos: a pessoa fechou pelo X, não reabre', !(await aberto()));
await p.evaluate(() => window.__ir('/explore')); await wait(1500);
check('Explorar (não é feed): não abre', !(await aberto()));
await p.evaluate(() => window.__ir('/foryou'));
check('voltou ao Para você: abre de novo', !!(await until(aberto, 6000, 100)));

// desligar no menu
await p.evaluate(() => document.querySelector('#brasa-nav button').click());
const e = await until(async () => { const s = await estado(p); return s.menu && /Comentários abertos/.test(s.menuTexto) ? s : null; });
check('menu: cartão "Comentários abertos" ligado de fábrica, com a frase simples', !!e && /os comentários já abrem do lado do vídeo/.test(e.menuTexto) && (await p.evaluate(() => document.querySelector('brasa-ui').shadowRoot.querySelector('.menu [data-aj="coment"]').getAttribute('aria-checked'))) === 'true');
await clicar(p, '.menu [data-aj="coment"]');
check('desligar grava a chave', !!(await until(async () => (await lerStorage(sw, 'br.ajustes')).coment === false)));
await p.keyboard.press('Escape');
await p.evaluate(() => window.__ir('/following')); await wait(800);
await p.evaluate(() => window.__ir('/foryou')); await wait(4000);
check('desligado: entrar no Para você não abre', !(await aberto()));
// layout medido ao vivo: o botão de comentar numa coluna única FORA do vídeo → também abre
await sw.evaluate(() => chrome.storage.local.get('br.ajustes').then((l) => chrome.storage.local.set({ 'br.ajustes': Object.assign({}, l['br.ajustes'] || {}, { coment: true }) })));
const p2 = await ctx.newPage(); p2.on('pageerror', (e) => erros.push(String(e)));
await p2.goto('https://www.tiktok.com/foryou?coluna=unica');
await until(() => p2.evaluate(() => window.__mock && window.__mock.pronto));
const ab2 = await until(() => p2.evaluate(() => getComputedStyle(document.getElementById('comentarios')).display !== 'none'), 8000, 100);
check('coluna única fora do vídeo: abre pelo botão de comentar que está na tela', !!ab2 && (await p2.evaluate(() => window.__mock.cliquesComent)) === 1, await p2.evaluate(() => [window.__mock.cliquesComent, document.documentElement.getAttribute('data-brasa-coment')]));
// v0.6.5 (visto no Chrome do André): o site abre o Para você já com os comentários e a URL /@x/video/id ANTES de o feed aparecer;
// a Brasa não pode ficar presa achando que é a página de um vídeo (Auto sumia do bloco)
const p4 = await ctx.newPage(); p4.on('pageerror', (e) => erros.push(String(e)));
await p4.goto('https://www.tiktok.com/foryou?restaura=1');
await until(() => p4.evaluate(() => window.__mock && window.__mock.pronto));
const r4 = await until(() => p4.evaluate(() => { const c = document.documentElement.getAttribute('data-brasa-coment'); return c === 'aberto' && document.querySelector('.brasa-acoes .brasa-auto') ? c : null; }), 8000, 150);
check('Para você que já abre com os comentários e URL de vídeo: continua sendo o feed (Auto no bloco)', !!r4 && /\/@mock\/video\//.test(p4.url()), await p4.evaluate(() => [location.pathname, document.documentElement.getAttribute('data-brasa-coment'), !!document.querySelector('.brasa-acoes .brasa-auto')]));
await p4.close();
// plano B: um feed sem o contêiner recommend-list-item-container (layout não medido com conta) também abre
const p3 = await ctx.newPage(); p3.on('pageerror', (e) => erros.push(String(e)));
await p3.goto('https://www.tiktok.com/friends?artigo=sem');
await until(() => p3.evaluate(() => window.__mock && window.__mock.pronto));
const ab3 = await until(() => p3.evaluate(() => getComputedStyle(document.getElementById('comentarios')).display !== 'none'), 8000, 100);
check('feed sem o contêiner do TikTok (Amigos): abre pelo vídeo do meio da tela', !!ab3 && (await p3.evaluate(() => window.__mock.cliquesComent)) === 1, await p3.evaluate(() => [window.__mock.cliquesComent, document.documentElement.getAttribute('data-brasa-coment')]));
check('sem erros de script', erros.length === 0, erros.slice(0, 3));
await ctx.close();
fim();
