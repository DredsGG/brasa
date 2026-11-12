// Regra 7a: versão nova gravada na pasta (manifest por último) → a Brasa percebe em até ~1 min e manda recarregar; com o
// guarda-foguinho enviando (br.envio), espera. Roda numa CÓPIA da pasta instalada (não mexe na de verdade).
// ⚠️ Limite do ambiente (o mesmo da Sintonia, 2026-11-11): no Chromium do Playwright, chrome.runtime.reload() DESCARREGA a extensão
// carregada por --load-extension. Por isso este teste confere a detecção, a espera do envio e a ordem de recarga (br.disco) e,
// separado, a reinjeção nas abas abertas com instância única; a recarga em si se confere no Chrome do André.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { abrir, esperarGuia, check, fim, until, wait, estado, ponte, EXT, semTutorial, lerStorage } from './lib.mjs';
import { rotas } from './mock.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brasa-copia-'));
fs.cpSync(EXT, tmp, { recursive: true });
const { ctx, sw } = await abrir({ ext: tmp });
await esperarGuia(ctx);
await semTutorial(sw);
await rotas(ctx);
const p = await ctx.newPage();
await p.goto('https://www.tiktok.com/foryou'); await p.waitForSelector('article video', { state: 'attached' });
check('antes: botão na barra lateral', !!(await until(async () => (await estado(p)).btn)));
const antes = await until(async () => { const s = await ponte(p, 'stats'); return s && s.emMemoria > 0 ? s : null; });

// 1) reinjeção nas abas abertas (o que o fundo faz logo depois de recarregar), sem recarregar a página
await p.evaluate(() => { window.__marca = 42; });
const fetchAntes = await p.evaluate(() => window.fetch.toString().length);
await sw.evaluate(async () => { for (const t of await chrome.tabs.query({ url: 'https://www.tiktok.com/*' })) { await chrome.scripting.executeScript({ target: { tabId: t.id }, files: ['src/page.js'], world: 'MAIN' }); await chrome.scripting.executeScript({ target: { tabId: t.id }, files: chrome.runtime.getManifest().content_scripts[1].js }); } });
const volta = await until(async () => { const s = await estado(p); return s.btn && s.btns === 1 && s.hosts === 1 ? s : null; }, 30000);
check('reinjeção pela lista do manifest: um botão só, um host só', !!volta, volta);
check('a página não recarregou', (await p.evaluate(() => window.__marca)) === 42);
const depois = await ponte(p, 'stats');
check('reinjeção não empilha gancho de fetch e mantém os itens em memória', (await p.evaluate(() => window.fetch.toString().length)) === fetchAntes && depois && depois.emMemoria >= antes.emMemoria, { antes: antes.emMemoria, depois: depois && depois.emMemoria });
await p.evaluate(() => window.__ir('/following'));
const st2 = await until(async () => { const s = await ponte(p, 'stats'); return s && s.porRota.following === 1 ? s : null; });
check('depois da reinjeção o gancho conta cada resposta uma vez só', !!st2, st2);
const lista = await sw.evaluate(() => chrome.runtime.getManifest().content_scripts[1].js.join(','));
const doSw = fs.readFileSync(path.join(EXT, 'src', 'sw.js'), 'utf8').match(/const CONTENT = \[([^\]]+)\]/)[1].replace(/['\s]/g, '');
check('a lista de reinjeção do sw.js é igual à do manifest', lista === doSw, { lista, doSw });

// 2) entrega que só corrige arquivos (mesma versão): a marca build.txt muda → também detecta e marca a recarga.
//    (aqui a recarga é cancelada logo depois, com a trava de envio, para o resto do teste seguir na mesma instância)
await until(async () => { const x = await sw.evaluate(() => chrome.storage.session.get('br.build')).catch(() => null); return x && 'br.build' in x ? x : null; }, 30000, 1000);
const buildOrig = fs.existsSync(path.join(tmp, 'build.txt')) ? fs.readFileSync(path.join(tmp, 'build.txt'), 'utf8') : '';
fs.writeFileSync(path.join(tmp, 'build.txt'), 'teste-' + Date.now());
console.log('… só a marca build.txt trocada (mesma versão)');
const b = await until(async () => { const x = await lerStorage(sw, 'br.disco').catch(() => null); return x && x.estado === 'recarregando' && /teste-/.test(x.noDisco || '') ? x : null; }, 100000, 1000);
await sw.evaluate(() => chrome.storage.local.set({ 'br.envio': { ate: Date.now() + 60e3, desde: Date.now() } })); // cancela a recarga
check('mesma versão com build.txt novo: recarga marcada em até ~1 min', !!b, b);
fs.writeFileSync(path.join(tmp, 'build.txt'), buildOrig);
await wait(17000); await sw.evaluate(() => chrome.storage.local.remove('br.envio'));

// 2) versão nova na pasta com o guarda-foguinho "enviando" → espera; terminou → recarga marcada
const mf = JSON.parse(fs.readFileSync(path.join(tmp, 'manifest.json'), 'utf8'));
const nova = mf.version + '.1';
await sw.evaluate(() => chrome.storage.local.set({ 'br.envio': { ate: Date.now() + 5 * 60e3, desde: Date.now() } }));
mf.version = nova; fs.writeFileSync(path.join(tmp, 'manifest.json'), JSON.stringify(mf, null, 2));
console.log('… versão na pasta trocada para', nova, 'com envio em andamento (espera até 100 s)');
const esp = await until(async () => { const x = await lerStorage(sw, 'br.disco').catch(() => null); return x && x.noDisco === nova && x.estado === 'esperando-envio' ? x : null; }, 100000, 2000);
check('com envio do guarda-foguinho em andamento, a recarga espera', !!esp, esp);
await sw.evaluate(() => chrome.storage.local.remove('br.envio'));
const t0 = Date.now();
const d = await until(async () => { const x = await lerStorage(sw, 'br.disco').catch(() => null); return x && x.noDisco === nova && x.estado === 'recarregando' ? x : null; }, 100000, 2000);
check(`envio terminou: versão ${nova} detectada e recarga marcada em até ~1 min`, !!d, { s: Math.round((Date.now() - t0) / 1000), d });
await ctx.close().catch(() => {});
fs.rmSync(tmp, { recursive: true, force: true });
fim();
