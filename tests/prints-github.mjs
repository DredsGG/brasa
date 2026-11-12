// Prints do README do GitHub (docs/), no TikTok SIMULADO (mock.mjs / mock-dm.mjs: vídeo de teste, criadores e conversas
// inventados), em inglês e no tema escuro. Nada de conta, vídeo ou conversa de verdade. Uso: node prints-github.mjs [pasta]
import path from 'path';
import fs from 'fs';
import { abrir, esperarGuia, until, wait, estado, clicar, semTutorial, DIR } from './lib.mjs';
import { rotas } from './mock.mjs';

const OUT = path.resolve(process.argv[2] || path.join(DIR, 'shots', 'github'));
fs.mkdirSync(OUT, { recursive: true });
const { ctx, sw } = await abrir();
await esperarGuia(ctx).then((g) => g && g.close());
await semTutorial(sw);
await rotas(ctx);
await sw.evaluate(() => chrome.storage.local.get('br.ajustes').then((l) => chrome.storage.local.set({ 'br.ajustes': Object.assign({}, l['br.ajustes'] || {}, { lang: 'en', baixar: true, auto: true, autoCurtir: false, autoSeguir: false }) })));
const shadowBox = (p, sel) => p.evaluate((s) => { const e = document.querySelector('brasa-ui').shadowRoot.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.max(0, r.left - 8), y: Math.max(0, r.top - 8), width: r.width + 16, height: Math.min(r.height + 16, innerHeight - Math.max(0, r.top - 8)) }; }, sel);

// 1) o feed: comentários abertos e o bloco da Brasa (Download, Auto, Like, Follow)
const p = await ctx.newPage();
await p.setViewportSize({ width: 1280, height: 800 });
await p.goto('https://www.tiktok.com/foryou?login=1&theme=dark');
await until(() => p.evaluate(() => window.__mock && window.__mock.pronto));
await until(() => p.evaluate(() => getComputedStyle(document.getElementById('comentarios')).display !== 'none' && document.querySelectorAll('.brasa-acoes .brasa-item').length >= 4), 12000);
await wait(1200);
await p.screenshot({ path: path.join(OUT, 'brasa-feed.png') });

// 2) o menu (aba Recursos)
await p.evaluate(() => document.querySelector('#brasa-nav button').click());
await until(async () => (await estado(p)).menu);
await wait(500);
await p.screenshot({ path: path.join(OUT, 'brasa-menu.png'), clip: await shadowBox(p, '.menu') });
await p.keyboard.press('Escape');

// 3) a aba Foguinho com as Mensagens simuladas (conversas e grupos inventados; nada é enviado)
await p.goto('https://www.tiktok.com/messages?theme=dark');
await p.waitForSelector('[data-e2e="dm-new-conversation-item"]');
await until(async () => { const c = (await sw.evaluate(async () => (await chrome.storage.local.get('br.fog.convs'))['br.fog.convs'])) || {}; return Object.keys(c).length >= 8; }, 20000);
const convs = await sw.evaluate(async () => (await chrome.storage.local.get('br.fog.convs'))['br.fog.convs']);
const marcar = Object.entries(convs).filter(([, c]) => ['Ana', 'Turma do Fogo', 'Caio'].includes(c.apelido)).map(([id]) => id);
await sw.evaluate((ids) => chrome.storage.local.set({ 'br.fog.marcadas': Object.fromEntries(ids.map((i) => [i, true])) }), marcar);
await p.evaluate(() => document.querySelector('#brasa-nav button').click());
await until(async () => (await estado(p)).menu);
await clicar(p, '.menu .tabs [data-aba="fog"]');
await until(async () => /Ana/.test((await estado(p)).menuTexto || ''));
await wait(500);
await p.screenshot({ path: path.join(OUT, 'brasa-streaks.png'), clip: await shadowBox(p, '.menu') });
await ctx.close();
console.log('prints em', OUT, fs.readdirSync(OUT));
