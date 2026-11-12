// Base dos testes E2E da Brasa: Chromium do Playwright com a extensão carregada, perfil NOVO e temporário (nunca o do André).
import './env.mjs';
import { chromium } from 'playwright';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';

export const DIR = path.dirname(fileURLToPath(import.meta.url));
// a extensão: ../instalada no PC do André, ../extension no repo do GitHub
export const EXT = path.resolve(process.env.BRASA_EXT || path.join(DIR, '..', fs.existsSync(path.join(DIR, '..', 'instalada')) ? 'instalada' : 'extension'));
export const VER = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version;
export const SHOT = path.join(DIR, 'shots'); fs.mkdirSync(SHOT, { recursive: true });
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// o guia abre sozinho na instalação; num PC carregado pode passar de 5 s
export const esperarGuia = (ctx) => until(() => ctx.pages().find((p) => p.url().includes('COMO-INSTALAR')) || null, 25000);

let falhas = 0, total = 0;
export function check(name, cond, info) {
  total++; if (!cond) falhas++;
  console.log((cond ? '✔' : '✘') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
  return !!cond;
}
export function fim() {
  console.log(`\n${total - falhas}/${total} checagens · ${falhas ? 'FALHOU' : 'TUDO PASSOU'}`);
  process.exitCode = falhas ? 1 : 0;
}
export const until = async (fn, ms = 15000, step = 150) => { const end = Date.now() + ms; while (Date.now() < end) { let v; try { v = await fn(); } catch (_) { v = null; } if (v) return v; await wait(step); } return null; };

// BRASA_NAV=edge|brave roda os mesmos testes no navegador instalado (perfil novo também)
const NAVS = {
  edge: [path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')],
  brave: [path.join(process.env.ProgramFiles || '', 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'), path.join(process.env.LOCALAPPDATA || '', 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe')],
};
export const NAV = process.env.BRASA_NAV || 'chromium';
export async function abrir({ locale = 'pt-BR', ext = EXT, headless = true, colorScheme = 'light' } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brasa-prof-'));
  const exe = NAVS[NAV] && NAVS[NAV].find((x) => fs.existsSync(x));
  const ctx = await chromium.launchPersistentContext(dir, Object.assign({
    headless: exe ? false : headless, viewport: { width: 1280, height: 860 }, locale, deviceScaleFactor: 1, colorScheme,
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--autoplay-policy=no-user-gesture-required', '--no-first-run', '--no-default-browser-check'].concat(exe && headless ? ['--headless=new'] : []),
  }, exe ? { executablePath: exe } : { channel: 'chromium' }));
  ctx.setDefaultTimeout(60000);
  let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const extId = sw.url().split('/')[2];
  return { ctx, sw, extId, dir };
}
// pula o tutorial (para testes que não são da fase 0)
export const semTutorial = (sw) => sw.evaluate(() => { const v = chrome.runtime.getManifest().version; return chrome.storage.local.set({ 'br.onboard': { tutorial: 'visto', visto: v, novLidas: v } }); });

// estado da interface (shadow root do host 'brasa-ui' e o botão da barra lateral)
export const estado = (p) => p.evaluate(() => {
  const h = document.querySelector('brasa-ui'), r = h && h.shadowRoot;
  const card = r && r.querySelector('.card'), toast = r && r.querySelector('.toast');
  const menu = r && r.querySelector('.menu .pn');
  const w = document.getElementById('brasa-nav'), b = w && w.querySelector('button');
  const mais = document.querySelector('[data-e2e="nav-more-menu"]');
  let maisItem = mais; while (maisItem && w && maisItem.parentElement !== w.parentElement) maisItem = maisItem.parentElement;
  const flut = r && r.querySelector('.flut');
  return {
    hosts: document.querySelectorAll('brasa-ui').length, btns: document.querySelectorAll('#brasa-nav').length,
    btn: !!b, btnLabel: b ? b.textContent.trim() : null, btnLogoAbaixoDoMais: !!(w && maisItem && w.previousElementSibling === maisItem), btnClasse: b ? b.className : null,
    flut: !!(flut && getComputedStyle(flut).display !== 'none' && flut.getBoundingClientRect().width > 0), // o que está NA TELA, não o atributo
    card: card && !card.hidden ? { title: (card.querySelector('.ttl b') || {}).textContent, x: !!card.querySelector('.x'), text: card.textContent } : null,
    toast: toast && !toast.hidden && toast.classList.contains('on') ? toast.querySelector('.msg').textContent : null,
    menu: !!menu, menuTexto: menu ? menu.textContent.replace(/\s+/g, ' ') : '', tema: r ? r.querySelector('.brasa').dataset.theme : null,
    aba: menu ? (menu.querySelector('.tabs [aria-selected=true]') || {}).textContent : null,
  };
});
// clica num seletor dentro do shadow root do host
export const clicar = (p, sel) => p.evaluate((s) => { const e = document.querySelector('brasa-ui').shadowRoot.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
export const texto = (p, sel) => p.evaluate((s) => { const h = document.querySelector('brasa-ui'); const e = h && h.shadowRoot.querySelector(s); return e ? e.textContent : null; }, sel);
// pergunta direto ao page.js (mundo MAIN) pela ponte de eventos, como o content script faz
export const ponte = (p, op, ...args) => p.evaluate(([op, args]) => new Promise((ok) => {
  const id = 't' + Math.random().toString(36).slice(2);
  const f = (e) => { const m = JSON.parse(e.detail); if (m.id === id) { document.removeEventListener('brasa:e', f); ok(m.data); } };
  document.addEventListener('brasa:e', f);
  document.dispatchEvent(new CustomEvent('brasa:c', { detail: JSON.stringify({ id, op, args }) }));
  setTimeout(() => ok(null), 2000);
}), [op, args]);
export const lerStorage = (sw, k) => sw.evaluate(async (k) => (await chrome.storage.local.get(k))[k], k);
