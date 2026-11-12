// v0.6.4: "Trocar de conta" pelo Sair do próprio TikTok. SÓ no TikTok simulado (mock.mjs, fiel ao medido em 2026-11-12) —
// nunca sai de conta nenhuma de verdade. Uso: node e2e-conta.mjs
import path from 'path';
import { abrir, esperarGuia, check, fim, until, wait, estado, clicar, lerStorage, semTutorial, SHOT } from './lib.mjs';
import { rotas } from './mock.mjs';

const { ctx, sw } = await abrir();
await esperarGuia(ctx).then((g) => g && g.close());
await semTutorial(sw);
const st = await rotas(ctx);
const erros = [];
await sw.evaluate(() => chrome.storage.local.get('br.ajustes').then((l) => chrome.storage.local.set({ 'br.ajustes': Object.assign({}, l['br.ajustes'] || {}, { coment: false }) })));
const evs = (t) => st.ev.filter((x) => x.mock === 'conta' && (!t || x.t === t));
const item = (p) => p.evaluate(() => { const w = document.querySelector('#brasa-conta'); const b = w && w.querySelector('button'); const r = b && b.getBoundingClientRect();
  return w ? { rotulo: b.getAttribute('aria-label'), depoisDoBrasa: w.previousElementSibling && w.previousElementSibling.id === 'brasa-nav', visivel: !!(r && r.width > 0), texto: b.textContent.trim() } : null; });
const conf = (p) => p.evaluate(() => { const c = document.querySelector('brasa-ui').shadowRoot.querySelector('.conf'); return c && !c.hidden ? c.textContent : null; });

// sem conta: o item não aparece
const p0 = await ctx.newPage(); p0.on('pageerror', (e) => erros.push(String(e)));
await p0.goto('https://www.tiktok.com/foryou');
await until(() => p0.evaluate(() => !!document.querySelector('#brasa-nav button')));
await wait(1500);
check('sem conta (botão Entrar na barra): o "Trocar de conta" não aparece', !(await item(p0)));
await p0.close();

// com conta
const p = await ctx.newPage(); p.on('pageerror', (e) => erros.push(String(e)));
await p.goto('https://www.tiktok.com/foryou?login=1');
const it = await until(() => item(p), 8000);
check('com conta: "Trocar de conta" na barra lateral, logo abaixo da Brasa', it && it.visivel && it.depoisDoBrasa && it.rotulo === 'Trocar de conta' && it.texto === 'Trocar de conta', it);
await p.screenshot({ path: path.join(SHOT, 'conta-barra.png') });

// Foguinho mandando agora: não troca
await sw.evaluate(() => chrome.storage.local.set({ 'br.envio': { ate: Date.now() + 60e3, desde: Date.now() } }));
await p.click('#brasa-conta button');
await wait(600);
check('com o Foguinho mandando: avisa e não sai (nem pergunta)', /Foguinho está mandando/.test((await estado(p)).toast || '') && !(await conf(p)) && evs('abriuMais').length === 0, (await estado(p)).toast);
await sw.evaluate(() => chrome.storage.local.remove('br.envio'));

// pergunta antes; Cancelar não faz nada
await p.click('#brasa-conta button');
const c1 = await until(() => conf(p), 3000);
check('pergunta antes ("Trocar de conta?", explica o Sair e o Foguinho)', !!c1 && /Trocar de conta\?/.test(c1) && /Sair do TikTok/.test(c1) && /Foguinho/.test(c1), c1);
await p.screenshot({ path: path.join(SHOT, 'conta-confirmar.png') });
await clicar(p, '.conf [data-r="0"]');
await wait(800);
check('Cancelar: nada acontece (nem abre o Mais)', !(await conf(p)) && evs('abriuMais').length === 0 && /login=1/.test(p.url()));

// confirma: abre o Mais escondido, clica no Sair do TikTok; a página volta sem conta e a Brasa abre o "Entrar"
await p.click('#brasa-conta button');
await until(() => conf(p), 3000);
await clicar(p, '.conf [data-r="1"]');
const saiu = await until(() => evs('saiu').length > 0, 8000);
check('confirmou: usou o "Mais" → "Sair" do próprio TikTok', !!saiu && evs('abriuMais').length === 1 && evs('clicouSair').length === 1);
check('o painel do "Mais" ficou invisível (sem piscar) até o Sair', evs('clicouSair')[0] && evs('clicouSair')[0].opacidadeMais === '0', evs('clicouSair')[0]);
const entrou = await until(() => evs('abriuEntrar').length > 0, 10000);
check('a página voltou sem conta e a Brasa abriu o "Entrar" do TikTok (para escolher a outra conta)', !!entrou && !/login=1/.test(p.url()) && (await p.evaluate(() => !!document.getElementById('quadro-entrar'))), p.url());
check('aviso "Escolha a conta para entrar."', /Escolha a conta para entrar/.test((await until(async () => (await estado(p)).toast, 4000)) || ''));
check('a marca da troca foi apagada (não abre o Entrar de novo)', !(await lerStorage(sw, 'br.troca')));
await p.screenshot({ path: path.join(SHOT, 'conta-entrar.png') });
const log = ((await lerStorage(sw, 'br.log')) || []).filter((x) => x.k === 'conta').map((x) => x.a[0]);
check('registro: saiu e abriu o entrar', log.includes('sair') && log.includes('entrar'), log);
await wait(2500);
check('não abre o "Entrar" duas vezes', evs('abriuEntrar').length === 1, evs('abriuEntrar').length);
await p.close();

// o TikTok pede confirmação (experimento confirm_logout): quem confirma é a pessoa, no quadro do TikTok
st.ev.length = 0;
const p2 = await ctx.newPage(); p2.on('pageerror', (e) => erros.push(String(e)));
await p2.goto('https://www.tiktok.com/foryou?login=1&confirmar=1');
await until(() => item(p2), 8000);
await p2.click('#brasa-conta button');
await until(() => conf(p2), 3000);
await clicar(p2, '.conf [data-r="1"]');
await until(() => p2.evaluate(() => !!document.getElementById('confirma-sair-quadro')), 5000);
await wait(2500);
check('com a confirmação do TikTok: a Brasa NÃO confirma por você', evs('saiu').length === 0 && (await p2.evaluate(() => !!document.getElementById('confirma-sair-quadro'))));
check('e avisa "Confirme no quadro do TikTok."', /Confirme no quadro do TikTok/.test((await estado(p2)).toast || ''), (await estado(p2)).toast);
await p2.click('#confirma-sair');
check('a pessoa confirmou: saiu e a Brasa abriu o "Entrar"', !!(await until(() => evs('abriuEntrar').length > 0, 10000)));
await p2.close();

// menu: cartão "Trocar de conta" com "Trocar agora"; desligar tira o item da barra
const p3 = await ctx.newPage(); p3.on('pageerror', (e) => erros.push(String(e)));
await p3.goto('https://www.tiktok.com/foryou?login=1');
await until(() => item(p3), 8000);
await p3.evaluate(() => document.querySelector('#brasa-nav button').click());
const e = await until(async () => { const s = await estado(p3); return s.menu && /Trocar de conta/.test(s.menuTexto) ? s : null; });
check('menu: cartão "Trocar de conta" (ligado) com a frase simples e "Trocar agora"', !!e && /Usa o Sair do próprio TikTok/.test(e.menuTexto) && /Trocar agora/.test(e.menuTexto));
st.ev.length = 0;
await clicar(p3, '.menu [data-conta="agora"]');
const c3 = await until(() => conf(p3), 3000);
check('"Trocar agora" no menu fecha o menu e pergunta', !!c3 && !(await estado(p3)).menu);
await clicar(p3, '.conf [data-r="0"]');
await p3.evaluate(() => document.querySelector('#brasa-nav button').click());
await until(async () => (await estado(p3)).menu);
await clicar(p3, '.menu [data-aj="conta"]');
check('desligar no menu tira o item da barra na hora', !!(await until(async () => !(await item(p3)), 3000, 100)));
await clicar(p3, '.menu [data-aj="conta"]');
check('ligar de novo devolve', !!(await until(() => item(p3), 3000, 100)));
await clicar(p3, '.menu [data-act=on]');
check('Brasa desligada: o item sai da barra', !!(await until(async () => !(await item(p3)), 3000, 100)));
await clicar(p3, '.menu [data-act=on]');
await p3.keyboard.press('Escape');
// troca de idioma: o rótulo acompanha
await sw.evaluate(() => chrome.storage.local.get('br.ajustes').then((l) => chrome.storage.local.set({ 'br.ajustes': Object.assign({}, l['br.ajustes'] || {}, { lang: 'en' }) })));
check('em inglês: "Switch account"', !!(await until(async () => { const x = await item(p3); return x && x.rotulo === 'Switch account'; }, 4000)));
await sw.evaluate(() => chrome.storage.local.get('br.ajustes').then((l) => chrome.storage.local.set({ 'br.ajustes': Object.assign({}, l['br.ajustes'] || {}, { lang: 'pt' }) })));
check('sem erros de script', erros.length === 0, erros.slice(0, 3));
await ctx.close();
fim();
