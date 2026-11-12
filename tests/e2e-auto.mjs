// Fase 4 (v0.5.0): rolagem automática. Uso: node e2e-auto.mjs
// O vídeo simulado tem 6 s e recomeça sozinho no fim (como o player do TikTok).
import path from 'path';
import { abrir, esperarGuia, check, fim, until, wait, estado, clicar, semTutorial, lerStorage, SHOT } from './lib.mjs';
import { rotas, FEED } from './mock.mjs';

const { ctx, sw } = await abrir();
await esperarGuia(ctx).then((g) => g && g.close());
await semTutorial(sw);
await rotas(ctx);
await sw.evaluate(() => chrome.storage.local.get('br.ajustes').then((l) => chrome.storage.local.set({ 'br.ajustes': Object.assign({}, l['br.ajustes'] || {}, { foco: false, autoFoto: 2, coment: false }) }))); // feed completo e previsível
const p = await ctx.newPage();
const erros = []; p.on('pageerror', (e) => erros.push(String(e)));
await p.goto('https://www.tiktok.com/foryou');
await until(() => p.evaluate(() => window.__mock && window.__mock.pronto));
const M = () => p.evaluate(() => ({ prox: window.__mock.proximos, fins: window.__mock.fins || 0 }));
const telaId = () => p.evaluate(() => { const a = [...document.querySelectorAll('article')].find((x) => { const r = x.getBoundingClientRect(); return r.top <= innerHeight / 2 && r.bottom >= innerHeight / 2; }); return a && a.querySelector('[id^=xgwrapper-]').id.split('-').pop(); });
const ITENS = FEED.recommend[0].itemList;

// desligada de fábrica: botão Auto na barra (desligado) e o vídeo só repete
const b0 = await until(() => p.evaluate(() => { const b = document.querySelector('.brasa-auto'); return b ? b.getAttribute('aria-pressed') : null; }));
check('botão "Auto" no bloco da Brasa, desligado de fábrica (contorno)', b0 === 'false' && (await p.evaluate(() => document.querySelector('.brasa-acoes .brasa-auto').parentElement.textContent.trim())) === 'Auto', b0);
await until(async () => (await M()).fins >= 1, 15000);
await wait(600);
check('desligada: o vídeo terminou e só repetiu (não passou)', (await M()).prox === 0, await M());

// liga pelo botão Auto
const cliques = await p.evaluate(() => window.__mock.cliquesPagina);
await p.evaluate(() => document.querySelector('.brasa-auto').click());
check('botão Auto liga a mesma chave do menu', !!(await until(async () => (await lerStorage(sw, 'br.ajustes')).auto === true)) && (await p.evaluate(() => document.querySelector('.brasa-auto').getAttribute('aria-pressed'))) === 'true');
check('clique no Auto não chega ao player', (await p.evaluate(() => window.__mock.cliquesPagina)) === cliques);
await p.screenshot({ path: path.join(SHOT, 'auto-botao.png') });

// fim do vídeo → passa uma vez
const id0 = await telaId();
const f0 = (await M()).fins;
await until(async () => (await M()).fins > f0, 15000);
const passou = await until(async () => (await M()).prox >= 1, 3000, 50);
const tChegou = Date.now();
check('no fim do vídeo passa para o próximo', !!passou && (await telaId()) !== id0, { de: id0, para: await telaId() });
await wait(1500);
check('passa uma vez só por volta', (await M()).prox === 1, await M());
const log1 = await sw.evaluate(async () => (await chrome.storage.local.get('br.log'))['br.log'].filter((x) => x.k === 'chave').map((x) => x.a.join(' ')));
check('ligar/desligar vai para o registro', log1.some((x) => /Passar sozinho true/.test(x)), log1);

// foto/carrossel: o 2º item é um carrossel → passa depois de N s (2 s no teste), contados desde que chegou
const foto = ITENS.find((i) => i.imagePost);
check('chegou num carrossel (2º item)', (await telaId()) === foto.id);
const saiu = await until(async () => (await M()).prox >= 2, 6000, 50);
check('foto: passa depois de N s (2 s)', saiu && Date.now() - tChegou >= 1800 && Date.now() - tChegou < 3800, { ms: Date.now() - tChegou });

// travas: pausado, comentários, digitando, mouse na barra
async function naoPassa(nome, liga, desliga) {
  await liga();
  const p0 = (await M()).prox, f1 = (await M()).fins;
  await until(async () => (await M()).fins > f1, 15000);
  await wait(1200);
  const ok = (await M()).prox === p0;
  await desliga();
  check(`não passa com ${nome}`, ok, await M());
}
// garante um vídeo na tela
for (let k = 0; k < 6; k++) { const ehFoto = await p.evaluate(() => { const a = [...document.querySelectorAll('article')].find((x) => { const r = x.getBoundingClientRect(); return r.top <= innerHeight / 2 && r.bottom >= innerHeight / 2; }); return !a.querySelector('video'); }); if (!ehFoto) break; await p.evaluate(() => document.querySelector('[data-e2e="feed-navigation-next"]').click()); await wait(400); }
// comentários abertos (v0.6.2, pedido do André): CONTINUA passando; a URL vira /@…/video/… e a Brasa segue tratando como Para você
await p.evaluate(() => window.__comentarios(true));
const pC = (await M()).prox;
const passouC = await until(async () => (await M()).prox > pC, 15000, 100);
check('com os comentários abertos continua passando (URL /@…/video/…)', !!passouC && /\/@mock\/video\//.test(p.url()), { url: p.url(), m: await M() });
check('com os comentários abertos o botão Auto continua no bloco da Brasa', (await p.evaluate(() => document.querySelectorAll('.brasa-acoes .brasa-auto').length)) === 1);
await p.evaluate(() => window.__comentarios(false));
await naoPassa('campo de texto com foco', () => p.evaluate(() => { const i = document.createElement('input'); i.id = 'campo'; document.body.appendChild(i); i.focus(); }), () => p.evaluate(() => document.getElementById('campo').remove()));
await naoPassa('o mouse na barra do player', async () => { const r = await p.evaluate(() => { const a = [...document.querySelectorAll('article')].find((x) => { const b = x.getBoundingClientRect(); return b.top <= innerHeight / 2 && b.bottom >= innerHeight / 2; }); const c = a.querySelector('[data-e2e="anchoring-playback-chrome"]').getBoundingClientRect(); return { x: c.left + 60, y: c.top + 20 }; }); await p.mouse.move(r.x, r.y); }, () => p.mouse.move(640, 200));
// pausado: o vídeo não termina; espera mais que a duração
await p.evaluate(() => { const a = [...document.querySelectorAll('article')].find((x) => { const b = x.getBoundingClientRect(); return b.top <= innerHeight / 2 && b.bottom >= innerHeight / 2; }); a.querySelector('video').pause(); });
const pP = (await M()).prox; await wait(8000);
check('não passa com o vídeo pausado', (await M()).prox === pP, await M());
await p.evaluate(() => { const a = [...document.querySelectorAll('article')].find((x) => { const b = x.getBoundingClientRect(); return b.top <= innerHeight / 2 && b.bottom >= innerHeight / 2; }); a.querySelector('video').play(); });
// com tudo livre de novo, volta a passar
const pL = (await M()).prox;
check('sem trava: volta a passar no fim', !!(await until(async () => (await M()).prox > pL, 15000, 100)));

// aba escondida
const p2 = await ctx.newPage(); await p2.goto('about:blank'); await p2.bringToFront();
const vis = await p.evaluate(() => document.visibilityState);
if (vis === 'hidden') {
  const pH = (await M()).prox; await wait(9000);
  check('não passa com a aba escondida', (await M()).prox === pH, { vis });
} else console.log('– aba escondida: o Chromium headless mantém a aba "visible" ao trocar de aba; trava conferida por leitura (document.hidden) no código');
await p2.close(); await p.bringToFront();

// navegação interna e desligar pelo menu
await p.evaluate(() => window.__ir('/following'));
check('navegação interna: botão Auto no Seguindo', !!(await until(() => p.evaluate(() => document.querySelectorAll('.brasa-auto').length))));
await p.evaluate(() => document.querySelector('#brasa-nav button').click()); await until(async () => (await estado(p)).menu);
const tx = (await estado(p)).menuTexto;
check('menu: cartão Passar sozinho com "Fotos: passar depois de"', /Passar sozinho/.test(tx) && /Fotos: passar depois de/.test(tx));
await p.screenshot({ path: path.join(SHOT, 'auto-menu.png') });
await clicar(p, '.menu [data-aj="auto"]');
await wait(400); await p.keyboard.press('Escape');
check('desligada pelo menu: botão Auto mostra desligado', (await p.evaluate(() => document.querySelector('.brasa-auto').getAttribute('aria-pressed'))) === 'false');
const pD = (await M()).prox, fD = (await M()).fins;
await until(async () => (await M()).fins > fD, 15000); await wait(1200);
check('desligada de novo: não passa', (await M()).prox === pD);
check('sem erros de script', erros.length === 0, erros.slice(0, 3));
await ctx.close();
fim();
