// Carrega a Brasa nos navegadores Chromium instalados no PC (perfil novo) e confere: o fundo sobe, a permissão "background" é
// aceita como opcional e os alarmes do guarda-foguinho existem. Uso: node navegadores-teste.mjs
import './env.mjs';
import { chromium } from 'playwright';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { check, fim, EXT } from './lib.mjs';
const L = process.env.LOCALAPPDATA || '', PF = process.env.ProgramFiles || 'C:\\Program Files', PF86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
const NAV = {
  Chromium: { channel: 'chromium' },
  Edge: { exe: [path.join(PF86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(PF, 'Microsoft', 'Edge', 'Application', 'msedge.exe')] },
  Chrome: { exe: [path.join(PF, 'Google', 'Chrome', 'Application', 'chrome.exe'), path.join(L, 'Google', 'Chrome', 'Application', 'chrome.exe')] },
  Brave: { exe: [path.join(PF, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'), path.join(L, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe')] },
  'Opera GX': { exe: [path.join(L, 'Programs', 'Opera GX', 'opera.exe')] },
};
for (const [nome, cfg] of Object.entries(NAV)) {
  const exe = cfg.exe && cfg.exe.find((x) => fs.existsSync(x));
  if (cfg.exe && !exe) { console.log(`– ${nome}: não instalado neste PC`); continue; }
  let ctx;
  try {
    ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'brasa-nav-')), Object.assign({ headless: false, args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--no-first-run', '--no-default-browser-check'] }, exe ? { executablePath: exe } : { channel: cfg.channel }));
    let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 20000 });
    const r = await sw.evaluate(async () => {
      let perm; try { await chrome.permissions.request({ permissions: ['background'] }); perm = 'pediu'; } catch (e) { perm = String(e.message || e); }
      await new Promise((ok) => setTimeout(ok, 1500));
      return { versao: chrome.runtime.getManifest().version, perm, alarmes: (await chrome.alarms.getAll()).map((a) => a.name).sort().join(','), ua: navigator.userAgent.match(/(Edg|OPR|Chrome)\/[\d.]+/g) };
    });
    check(`${nome}: Brasa v${r.versao} carrega, fundo de pé, alarmes do guarda`, /br-g1/.test(r.alarmes) && /br-gconf/.test(r.alarmes), r);
    check(`${nome}: "background" aceito como permissão opcional`, /user gesture/i.test(r.perm), r.perm);
  } catch (e) {
    check(`${nome}: carregar a extensão`, false, String(e.message || e).slice(0, 200));
  } finally { if (ctx) await ctx.close().catch(() => {}); }
}
fim();
