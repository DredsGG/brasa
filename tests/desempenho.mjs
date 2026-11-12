// Fase 5: desempenho no TikTok REAL (perfil novo, sem login): 10 min de feed passando um vídeo a cada 8 s, com e sem a Brasa
// (ajustes de fábrica: modo foco ligado). Mede pelo CDP a CPU da thread principal (TaskDuration), o heap de JS e os nós do DOM.
// Uso: node desempenho.mjs [minutos=10] [com|sem]
import './env.mjs';
import { chromium } from 'playwright';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { EXT, DIR } from './lib.mjs';
const MIN = +(process.argv[2] || 10), MODO = process.argv[3] || 'com';
const args = ['--autoplay-policy=no-user-gesture-required'].concat(MODO === 'com' ? [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] : []);
const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'brasa-perf-')), { channel: 'chromium', headless: true, viewport: { width: 1280, height: 860 }, locale: 'pt-BR', args });
if (MODO === 'com') { let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker'); await sw.evaluate(() => chrome.storage.local.set({ 'br.onboard': { tutorial: 'visto', visto: chrome.runtime.getManifest().version, novLidas: chrome.runtime.getManifest().version } })); }
const p = await ctx.newPage();
for (const x of ctx.pages()) if (x !== p) await x.close().catch(() => {});
const cdp = await ctx.newCDPSession(p);
await cdp.send('Performance.enable');
await p.goto('https://www.tiktok.com/foryou', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(10000);
const met = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
const m0 = await met(), t0 = Date.now(), amostras = [];
let passos = 0;
while (Date.now() - t0 < MIN * 60e3) {
  await p.waitForTimeout(8000);
  await p.evaluate(() => { const b = document.querySelector('[data-e2e="feed-navigation-next"]'); if (b) b.click(); }).catch(() => {});
  passos++;
  if (passos % 4 === 0) { const m = await met(); amostras.push({ s: Math.round((Date.now() - t0) / 1000), heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(1), nos: m.Nodes, cpuS: +(m.TaskDuration - m0.TaskDuration).toFixed(1) }); }
}
const m1 = await met(), seg = (Date.now() - t0) / 1000;
const r = { modo: MODO, minutos: MIN, passos, cpuMedia: +(100 * (m1.TaskDuration - m0.TaskDuration) / seg).toFixed(1) + '%', scriptS: +(m1.ScriptDuration - m0.ScriptDuration).toFixed(1), heapMBfim: +(m1.JSHeapUsedSize / 1048576).toFixed(1), heapMBmax: Math.max(...amostras.map((a) => a.heapMB)), nosFim: m1.Nodes, listeners: m1.JSEventListeners, amostras };
r.pagina = await p.evaluate(() => ({ artigos: document.querySelectorAll('[data-e2e="recommend-list-item-container"]').length, videos: document.querySelectorAll('video').length, imgs: document.querySelectorAll('img').length, nosDoc: document.getElementsByTagName('*').length,
  nossos: document.querySelectorAll('.brasa-auto, .brasa-auto *, .brasa-baixar, .brasa-baixar *, #brasa-nav, #brasa-nav *, brasa-ui, #brasa-foco-css').length }));
if (MODO === 'com') r.brasa = await p.evaluate(() => ({ botao: !!document.getElementById('brasa-nav'), hosts: document.querySelectorAll('brasa-ui').length }));
fs.writeFileSync(path.join(DIR, 'shots', `desempenho-${MODO}.json`), JSON.stringify(r, null, 1));
console.log(JSON.stringify(Object.assign({}, r, { amostras: r.amostras.slice(-3) })));
await ctx.close();
