// Fase 3 (v0.4.0): baixar vídeo com som. Uso: node e2e-baixar.mjs
// O CDN simulado só entrega com o Referer do TikTok (como o real) e marca cada versão no fim do arquivo.
import fs from 'fs'; import path from 'path';
import { abrir, esperarGuia, check, fim, until, wait, estado, clicar, semTutorial, SHOT } from './lib.mjs';
import { rotas, FEED } from './mock.mjs';

const { ctx, sw } = await abrir();
await esperarGuia(ctx).then((g) => g && g.close());
await semTutorial(sw);
const st = await rotas(ctx);
const p = await ctx.newPage();
const erros = []; p.on('pageerror', (e) => erros.push(String(e)));
await p.goto('https://www.tiktok.com/foryou');
await until(() => p.evaluate(() => window.__mock && window.__mock.pronto));
await wait(1500);
const nBtn = () => p.evaluate(() => document.querySelectorAll('.brasa-baixar').length);
check('desligado de fábrica: nenhum botão de baixar na barra do player', (await nBtn()) === 0);
await p.keyboard.press('d'); await wait(800);
check('desligado: tecla D não baixa nada', (await sw.evaluate(() => chrome.downloads.search({}))).length === 0);

// liga pelo menu
await p.evaluate(() => document.querySelector('#brasa-nav button').click());
await until(async () => (await estado(p)).menu);
await clicar(p, '.menu [data-aj="baixar"]');
const e = await until(async () => { const s = await estado(p); return /Capa junto/.test(s.menuTexto) ? s : null; });
check('menu: cartão Baixar vídeos com Capa junto, Qualidade máxima e a pasta', e && /Qualidade máxima/.test(e.menuTexto) && /Salvar em Downloads/.test(e.menuTexto));
await p.screenshot({ path: path.join(SHOT, 'baixar-menu.png') });
await p.keyboard.press('Escape');
const pos = await until(() => p.evaluate(() => { const b = document.querySelector('.brasa-acoes .brasa-baixar'); if (!b) return null; const c = document.querySelector('.brasa-acoes').getBoundingClientRect(), s = document.querySelector('[data-e2e="feed-navigation-prev"]').getBoundingClientRect(), v = [...document.querySelectorAll('article video')].map((x) => x.getBoundingClientRect()).find((r) => r.top >= -5 && r.top < innerHeight / 2);
  return { rotulo: b.parentElement.textContent.trim(), acimaDasSetas: c.bottom <= s.top, foraDoVideo: !v || c.left >= v.right, marca: !!document.querySelector('.brasa-acoes .brasa-marca svg') }; }));
check('ligado: botão "Baixar" no bloco da Brasa (com a chama), acima das setas e fora do vídeo', pos && pos.rotulo === 'Baixar' && pos.acimaDasSetas && pos.foraDoVideo && pos.marca, pos);

// vai até o primeiro vídeo (pula fotos)
const VID = FEED.recommend[0].itemList.find((i) => !i.imagePost), FOTO = FEED.recommend.flatMap((pg) => pg.itemList).find((i) => i.imagePost);
async function irPara(id) {
  for (let k = 0; k < 12; k++) {
    const atual = await p.evaluate(() => { const a = [...document.querySelectorAll('article')].find((x) => { const r = x.getBoundingClientRect(); return r.top <= innerHeight / 2 && r.bottom >= innerHeight / 2; }); return a && a.querySelector('[id^=xgwrapper-]').id.split('-').pop(); });
    if (atual === id) return true;
    await p.evaluate(() => document.querySelector('[data-e2e="feed-navigation-next"]').click()); await wait(400);
  }
  return false;
}
check('vídeo de teste na tela', await irPara(VID.id));
const cliques = await p.evaluate(() => window.__mock.cliquesPagina);
await p.evaluate(() => document.querySelector('.brasa-baixar').click());
const baixados = async (n) => until(async () => { const l = (await sw.evaluate(() => chrome.downloads.search({ state: 'complete' }))); return l.length >= n ? l : null; }, 30000, 300);
let l = await baixados(2);
const ler = (f) => fs.readFileSync(f);
const nomes = () => sw.evaluate(() => self.__brasaNomes.slice());
let N = await nomes();
const vid = l && l.find((d) => d.mime !== 'image/jpeg' && /^blob:/.test(d.url)), capa = N.find((x) => /_capa\.jpg$/.test(x));
const nomeVid = N.find((x) => /\.(mp4|webm)$/.test(x));
const autor = VID.author.uniqueId.replace(/[^\w.\-]+/g, '_');
const rel = (f) => f.split(/[\\/]Downloads[\\/]|[\\/]downloads[\\/]|playwright-artifacts[^\\/]*[\\/]/i).pop();
const esc = (s) => s.replace(/\./g, '\\.');
check(`nome: Brasa/${autor}/${autor}_AAAA-MM-DD_HH-MM-SS_${VID.id}.webm`, !!nomeVid && new RegExp(`^Brasa/${esc(autor)}/${esc(autor)}_\\d{4}-\\d{2}-\\d{2}_\\d{2}-\\d{2}-\\d{2}_${VID.id}\\.webm$`).test(nomeVid), nomeVid);
const marca = vid && ler(vid.filename).toString('latin1').match(/BRASA-VARIANTE:(\w+)$/);
check('versão escolhida: a maior em H.264 (720p), sem marca d\'água', marca && marca[1] === 'h264_720', marca && marca[1]);
check('arquivo é o vídeo inteiro com som (o clipe de teste + marca)', vid && fs.statSync(vid.filename).size > 200000);
check('capa baixada junto (mesmo nome + _capa.jpg)', !!capa && capa.startsWith(nomeVid.replace(/\.webm$/, '')), capa);
check('o vídeo saiu pela aba (Referer do TikTok); o CDN recusa de fora', st.cdn.some((x) => x.v === 'h264_720' && /tiktok\.com/.test(x.ref)) && !st.cdn.some((x) => x.v === 'marca'));
check('clique no botão não chega ao player (não pausa)', (await p.evaluate(() => window.__mock.cliquesPagina)) === cliques);
check('aviso "Baixado em Downloads"', /Baixado em Downloads/.test((await until(async () => (await estado(p)).toast)) || ''));
await p.screenshot({ path: path.join(SHOT, 'baixar-botao.png') });

// qualidade máxima → HEVC 1080
await p.evaluate(() => document.querySelector('#brasa-nav button').click()); await until(async () => (await estado(p)).menu);
await clicar(p, '.menu [data-aj="baixarHevc"]');
await p.evaluate(() => { const i = document.querySelector('brasa-ui').shadowRoot.querySelector('[data-baixar="pasta"]'); i.value = 'Meus TikToks?'; i.dispatchEvent(new Event('change')); });
await wait(300); await p.keyboard.press('Escape'); await p.mouse.click(900, 400).catch(() => {}); await wait(300);
await p.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
await p.keyboard.press('d');
l = await baixados(4);
N = await nomes();
const v2 = l && l.filter((d) => /^blob:/.test(d.url) && d.mime !== 'image/jpeg' && d.totalBytes > 200000).sort((a, b) => b.id - a.id)[0];
const nome2 = N.filter((x) => /\.(mp4|webm)$/.test(x)).pop();
check('atalho D baixa; qualidade máxima pega o HEVC 1080', v2 && /BRASA-VARIANTE:hevc_1080$/.test(ler(v2.filename).toString('latin1')), v2 && rel(v2.filename));
check('pasta ajustável (e limpa de caracteres proibidos): "Meus TikToks"', !!nome2 && /^Meus TikToks\//.test(nome2), nome2);

// D com campo de texto em foco não baixa
const n0 = (await sw.evaluate(() => chrome.downloads.search({}))).length;
await p.evaluate(() => { const i = document.createElement('input'); i.id = 'campo'; document.body.appendChild(i); i.focus(); });
await p.keyboard.press('d'); await wait(1000);
check('D com campo de texto em foco não baixa', (await sw.evaluate(() => chrome.downloads.search({}))).length === n0);
await p.evaluate(() => document.getElementById('campo').remove());

// carrossel de fotos
check('carrossel na tela', await irPara(FOTO.id));
await p.evaluate(() => document.querySelector('.brasa-baixar').click());
const nf = FOTO.imagePost.images.length;
const fotos = await until(async () => { const x = (await nomes()).filter((n) => /_foto\d\d\.jpg$/.test(n)); return x.length >= nf ? x : null; }, 20000);
const arqF = await until(async () => { const x = (await sw.evaluate(() => chrome.downloads.search({ state: 'complete' }))).filter((d) => d.totalBytes > 0 && d.totalBytes < 5000); return x.length >= nf + 2 ? x : null; }, 20000);
check(`carrossel: baixa as ${nf} fotos (_foto01…) e só elas`, !!fotos && fotos.length === nf && !!arqF && arqF.slice(-nf).every((d) => /BRASA-IMG/.test(ler(d.filename).toString('latin1'))), fotos);

// navegação interna: o botão aparece no Seguindo; desligar tira
await p.evaluate(() => window.__ir('/following'));
check('navegação interna: botão no Seguindo', !!(await until(async () => (await nBtn()) > 0)));
await p.evaluate(() => document.querySelector('#brasa-nav button').click()); await until(async () => (await estado(p)).menu);
await clicar(p, '.menu [data-aj="baixar"]');
check('desligar tira os botões na hora', !!(await until(async () => (await nBtn()) === 0, 3000, 100)));
const lerReg = () => sw.evaluate(async () => (await chrome.storage.local.get('br.log'))['br.log'].filter((x) => x.k === 'baixou').map((x) => x.a.join(' ')));
const reg = (await until(async () => { const r = await lerReg(); return r.some((x) => /^fotos/.test(x)) ? r : null; }, 8000)) || await lerReg();
check('registro: "Baixou um vídeo (720p H.264)", "(1080p HEVC)" e as fotos', reg.some((x) => /720p H\.264/.test(x)) && reg.some((x) => /1080p HEVC/.test(x)) && reg.some((x) => /^fotos/.test(x)), reg);
check('sem erros de script', erros.length === 0, erros.slice(0, 3));
await ctx.close();
fim();
