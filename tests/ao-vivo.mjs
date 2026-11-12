// Teste AO VIVO em tiktok.com com perfil NOVO do Playwright, SEM login (nunca o perfil, os cookies ou a conta do André).
// Confere o que dá para conferir sem conta: botão na barra lateral, menu, gancho do feed (page.js), navegação interna e tema.
// Uso: node ao-vivo.mjs [light|dark]
import path from 'path';
import { abrir, esperarGuia, check, fim, until, wait, estado, ponte, SHOT, semTutorial } from './lib.mjs';
import { execFileSync } from 'child_process';

const tema = process.argv[2] === 'dark' ? 'dark' : 'light';
const { ctx, sw } = await abrir({ colorScheme: tema });
await esperarGuia(ctx).then((g) => g && g.close());
await semTutorial(sw);
const p = await ctx.newPage();
const erros = [];
p.on('pageerror', (e) => { if (/brasa/i.test(String(e.stack || e))) erros.push(String(e)); });
await p.goto('https://www.tiktok.com/foryou', { waitUntil: 'domcontentloaded' });
await wait(9000);
// Sem login o TikTok abre o convite "Entrar no TikTok" (e o "Pular" leva a um pedido de data de nascimento). Não mexemos nele:
// os cliques deste teste vão por script, por baixo do convite. Nada de login nem de dado pessoal.
await p.screenshot({ path: path.join(SHOT, `ao-vivo-${tema}-modal.png`) });
const modal = await p.evaluate(() => [...document.querySelectorAll('[class*="ModalContainer"], [role=dialog]')].map((m) => m.textContent.trim().slice(0, 160)));
console.log('modais abertos:', JSON.stringify(modal));

await p.evaluate(() => { window.__brCom = []; document.addEventListener('click', (e) => { const c = e.target.closest && e.target.closest('[data-e2e="comment-icon"]'); if (c) window.__brCom.push({ t: Math.round(performance.now()), confiavel: e.isTrusted, url: location.pathname }); }, true); });
let e = await until(async () => { const s = await estado(p); return s.btn ? s : null; }, 20000);
check(`[${tema}] botão "Brasa" na barra lateral real, logo abaixo do "Mais"`, e && e.btnLogoAbaixoDoMais && e.btns === 1 && !e.flut, e);
check(`[${tema}] sem conta no site real: o "Trocar de conta" não aparece`, !(await p.evaluate(() => !!document.querySelector('#brasa-conta'))));
const visual = await p.evaluate(() => {
  // compara com um item nativo visível (o "Mais" fica escondido pelo modo foco, de fábrica)
  const b = document.querySelector('#brasa-nav button'), m = document.querySelector('[data-e2e="nav-profile"] button') || document.querySelector('[data-e2e="nav-more-menu"]');
  if (!b || !m) return null;
  const rb = b.getBoundingClientRect(), rm = m.getBoundingClientRect();
  const cs = (x) => { const s = getComputedStyle(x.querySelector('.TUXButton-label') || x); return { f: s.fontSize, w: s.fontWeight, c: s.color }; };
  const ib = b.querySelector('svg').getBoundingClientRect(), im = m.querySelector('svg').getBoundingClientRect();
  return { brasa: { h: Math.round(rb.height), w: Math.round(rb.width), x: Math.round(rb.left), ...cs(b), icone: Math.round(ib.width) }, mais: { h: Math.round(rm.height), w: Math.round(rm.width), x: Math.round(rm.left), ...cs(m), icone: Math.round(im.width) } };
});
check(`[${tema}] mesmo tamanho, fonte e cor dos itens nativos (Perfil)`, visual && visual.brasa.h === visual.mais.h && visual.brasa.x === visual.mais.x && visual.brasa.f === visual.mais.f && visual.brasa.c === visual.mais.c && Math.abs(visual.brasa.icone - visual.mais.icone) <= 2, visual);
const st = await until(async () => { const s = await ponte(p, 'stats'); return s && s.respostas >= 1 ? s : null; }, 20000);
check(`[${tema}] page.js leu as respostas reais do feed`, st && st.emMemoria > 0, st);
const nArt = await p.evaluate(() => document.querySelectorAll('[data-e2e="recommend-list-item-container"]').length);
check(`[${tema}] com o modo foco ligado o feed real continua desenhando vídeos`, nArt > 0 && st.cfg && st.cfg.foco === true, { artigos: nArt, tirados: st.tirados || 0 });
await p.screenshot({ path: path.join(SHOT, `ao-vivo-${tema}.png`) });
await p.evaluate(() => document.querySelector('#brasa-nav button').click());
e = await until(async () => { const s = await estado(p); return s.menu ? s : null; });
const temaSite = await p.evaluate(() => document.documentElement.getAttribute('data-theme'));
check(`[${tema}] menu abre na página real, no tema do site (${temaSite})`, e && e.tema === temaSite, e && { tema: e.tema, txt: e.menuTexto.slice(0, 80) });
const barra = await p.evaluate(() => { const vis = (s) => { const x = document.querySelector(s); if (!x) return null; let y = x; while (y && y !== document.body) { const cs = getComputedStyle(y); if (cs.display === 'none' || +cs.opacity < 0.5) return false; y = y.parentElement; } return getComputedStyle(x).pointerEvents !== 'none'; };
  return { foryou: vis('[data-e2e="nav-foryou"]'), following: vis('[data-e2e="nav-following"]'), profile: vis('[data-e2e="nav-profile"]'), explore: vis('[data-e2e="nav-explore"]'), live: vis('[data-e2e="nav-live"]'), drama: vis('[data-e2e="nav-short-drama"]'), upload: vis('[data-e2e="nav-upload"]'), mais: vis('[data-e2e="nav-more-menu"]'), util: vis('[data-e2e="side-nav-utilities"]') }; });
check(`[${tema}] modo foco no site real: barra lateral inteira e clicável (Para você, Explorar, Seguindo, LIVE, Carregar, Perfil, Mais…)`, barra.foryou && barra.following && barra.profile && [barra.explore, barra.live, barra.drama, barra.upload, barra.mais].every((x) => x === true || x === null) && [barra.explore, barra.live, barra.mais].filter((x) => x === true).length >= 2, barra);
const sobre = await p.evaluate(() => { const r = document.querySelector('brasa-ui').shadowRoot.querySelector('.menu .pn').getBoundingClientRect(); const v = [...document.querySelectorAll('video')].map((x) => x.getBoundingClientRect()).find((x) => x.top >= -10 && x.height > 200); return { menu: [r.left, r.right].map(Math.round), video: v ? [v.left, v.right].map(Math.round) : null }; });
const comPainel = await p.evaluate(() => { const e = document.querySelector('[class*="--DivCommentSidebarTransitionWrapper"]'); return !!(e && e.getBoundingClientRect().width > 100); });
// com os comentários abertos (v0.6.2) o site empurra o vídeo para a esquerda: o menu aberto pode cobrir só a borda (até 90 px)
check(`[${tema}] menu não cobre o vídeo da tela (1280 px${comPainel ? ', comentários abertos: só a borda' : ''})`, sobre.video && sobre.menu[1] <= sobre.video[0] + (comPainel ? 90 : 0), { ...sobre, comPainel });
await p.screenshot({ path: path.join(SHOT, `ao-vivo-${tema}-menu.png`) });
await p.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
// navegação interna real: Explorar e volta para Para você
await p.evaluate(() => document.querySelector('[data-e2e="nav-explore"]').click());
await wait(4000);
e = await estado(p);
check(`[${tema}] depois de ir para Explorar (SPA): botão continua único`, e.btns <= 1 && e.hosts === 1, { url: p.url(), btns: e.btns, flut: e.flut });
await p.evaluate(() => document.querySelector('[data-e2e="nav-foryou"]').click());
await wait(4000);
e = await until(async () => { const s = await estado(p); return s.btn ? s : null; }, 10000);
check(`[${tema}] de volta ao Para você: botão no lugar`, e && e.btns === 1, p.url());
// fase 3: baixar o vídeo da tela no site real (sem login): arquivo com vídeo e som
await sw.evaluate(() => chrome.storage.local.get('br.ajustes').then((l) => chrome.storage.local.set({ 'br.ajustes': Object.assign({}, l['br.ajustes'] || {}, { baixar: true }) })));
await wait(1500);
const temBotao = await until(() => p.evaluate(() => document.querySelectorAll('.brasa-baixar').length), 10000);
check(`[${tema}] botão de baixar no bloco da Brasa no site real`, temBotao > 0, temBotao);
const posV = await p.evaluate(() => { const c = document.querySelector('.brasa-acoes'); if (!c) return null; const r = c.getBoundingClientRect(); const s = document.querySelector('[data-e2e="feed-navigation-prev"]'); const sr = s && s.getBoundingClientRect();
  const v = [...document.querySelectorAll('video')].map((x) => x.getBoundingClientRect()).find((b) => b.top <= innerHeight / 2 && b.bottom >= innerHeight / 2);
  const cobre = (a, b) => a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  return { caixa: [r.left, r.top, r.right, r.bottom].map(Math.round), naTela: r.top >= 0 && r.bottom <= innerHeight, cobreSetas: cobre(r, sr), cobreVideo: cobre(r, v) }; });
check(`[${tema}] bloco da Brasa visível, sem cobrir as setas nem o vídeo`, posV && posV.naTela && !posV.cobreSetas && !posV.cobreVideo, posV);
await p.screenshot({ path: path.join(SHOT, `ao-vivo-${tema}-bloco.png`) });
await p.evaluate(() => { const b = [...document.querySelectorAll('.brasa-baixar')].find((x) => { const r = x.getBoundingClientRect(); return r.top > 0 && r.bottom < innerHeight; }) || document.querySelector('.brasa-baixar'); b && b.click(); });
const dl = await until(async () => { const l = await sw.evaluate(() => chrome.downloads.search({ state: 'complete' })); const v = l.filter((d) => /^video\//.test(d.mime || '') || d.totalBytes > 300000).sort((x, y) => y.totalBytes - x.totalBytes)[0]; return v || null; }, 45000, 500);
const nomeDl = await sw.evaluate(() => (self.__brasaNomes || []).slice(-2));
let streams = '';
try { streams = dl ? execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name', '-of', 'csv=p=0', dl.filename]).toString().trim().split(/\s+/).join(' ') : ''; } catch (e) { streams = 'ffprobe: ' + e.message.slice(0, 80); }
check(`[${tema}] vídeo real baixado pela aba, com vídeo e som (AAC)`, dl && /audio/.test(streams) && /video/.test(streams), { bytes: dl && dl.totalBytes, streams, nome: nomeDl });
// v0.6.2: comentários abertos de fábrica no site real (abrem sozinhos; a URL vira /@…/video/…); a rolagem abaixo roda COM eles abertos
const PAINEL_C = '[class*="--DivCommentSidebarTransitionWrapper"]';
const comAberto = await until(() => p.evaluate((sel) => { const e = document.querySelector(sel); return !!(e && e.getBoundingClientRect().width > 100); }, PAINEL_C), 12000, 300);
check(`[${tema}] comentários abriram sozinhos no Para você real`, !!comAberto && /\/video\/\d+/.test(p.url()), { url: p.url(), cliques: await p.evaluate(() => window.__brCom), log: await sw.evaluate(async () => ((await chrome.storage.local.get('br.log'))['br.log'] || []).filter((x) => x.k === 'coment')), icone: await p.evaluate(() => document.querySelectorAll('[data-e2e="comment-icon"]').length), paineis: await p.evaluate(() => [...document.querySelectorAll('[class*="--DivCommentSidebarTransitionWrapper"],[class*="--SectionCommentSidebarContainer"],[class*="--DivSidePanelCommentPanelRoot"]')].map((e) => { const r = e.getBoundingClientRect(); return [String(e.className).match(/--(\w+)/)[1], Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; })), modal: await p.evaluate(() => !!document.querySelector('[class*="DivModalContainer"]')), porque: await p.evaluate(() => document.documentElement.getAttribute('data-brasa-coment')), meio: await p.evaluate(() => { const a = [...document.querySelectorAll('[data-e2e="recommend-list-item-container"]')].map((x) => x.getBoundingClientRect()); return a.map((r) => [Math.round(r.top), Math.round(r.bottom)]).slice(0, 4).concat([[innerHeight]]); }) });
// fase 4: rolagem automática no site real: leva o vídeo da tela para 1 s do fim e confere que passou uma vez
await sw.evaluate(() => chrome.storage.local.get('br.ajustes').then((l) => chrome.storage.local.set({ 'br.ajustes': Object.assign({}, l['br.ajustes'] || {}, { auto: true }) })));
await p.mouse.move(5, 5); await wait(1200);
const meio = () => p.evaluate(() => { const a = [...document.querySelectorAll('[data-e2e="recommend-list-item-container"]')].find((x) => { const r = x.getBoundingClientRect(); return r.top <= innerHeight / 2 && r.bottom >= innerHeight / 2; }); if (!a) return null; const w = a.querySelector('[id^="xgwrapper-"]'); if (w) return w.id.split('-').pop(); const l = a.querySelector('a[href*="/video/"],a[href*="/photo/"]'); const m = l && l.href.match(/\/(?:video|photo)\/(\d+)/); return m ? m[1] : 'pos' + [...document.querySelectorAll('[data-e2e="recommend-list-item-container"]')].indexOf(a); }); // fotos não têm xgwrapper
// garante um vídeo (não foto) na tela
for (let k = 0; k < 5; k++) { const temVideo = await p.evaluate(() => { const a = [...document.querySelectorAll('[data-e2e="recommend-list-item-container"]')].find((x) => { const r = x.getBoundingClientRect(); return r.top <= innerHeight / 2 && r.bottom >= innerHeight / 2; }); const v = a && a.querySelector('video'); return !!(v && v.duration > 3); }); if (temVideo) break; await p.evaluate(() => document.querySelector('[data-e2e="feed-navigation-next"]').click()); await wait(2500); }
const antesAuto = await meio();
await p.evaluate(() => { window.__brNext = 0; window.__brCl = []; window.__brAuto = 0; let brUlt = false; document.addEventListener('brasa:auto-passou', () => { window.__brAuto++; brUlt = true; setTimeout(() => { brUlt = false; }); }); document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('[data-e2e="feed-navigation-next"]')) { window.__brNext++; const a = [...document.querySelectorAll('[data-e2e="recommend-list-item-container"]')].find((x) => { const r = x.getBoundingClientRect(); return r.top <= innerHeight / 2 && r.bottom >= innerHeight / 2; }); const v = a && a.querySelector('video'); window.__brCl.push({ brasa: brUlt, tipo: a ? [...new Set([...a.querySelectorAll('[class*="--"]')].slice(0, 12).map((x) => (String(x.className).match(/--(\w+)/) || [])[1]))].join(',') : 'sem artigo', t: Math.round(performance.now()), dur: v && +v.duration.toFixed(2), cur: v && +v.currentTime.toFixed(2) }); } }, true); });
await p.evaluate(() => { const a = [...document.querySelectorAll('[data-e2e="recommend-list-item-container"]')].find((x) => { const r = x.getBoundingClientRect(); return r.top <= innerHeight / 2 && r.bottom >= innerHeight / 2; }); const v = a.querySelector('video'); v.muted = true; v.play().catch(() => {}); v.currentTime = Math.max(0, v.duration - 1.2); });
const depoisAuto = await until(async () => { const m = await meio(); return m && m !== antesAuto ? m : null; }, 15000, 200);
const comAindaAberto = await p.evaluate((sel) => { const e = document.querySelector(sel); return !!(e && e.getBoundingClientRect().width > 100); }, PAINEL_C);
check(`[${tema}] rolagem automática no site real: no fim do vídeo passou para o próximo, com os comentários abertos`, !!depoisAuto && comAindaAberto, { de: antesAuto, para: depoisAuto, comAindaAberto });
await wait(2500);
const nNext = await p.evaluate(() => window.__brAuto), cl = await p.evaluate(() => window.__brCl);
// 2º clique legítimo: o vídeo novo era curto e terminou dentro da janela (durou ≥ quase toda a duração dele desde o 1º clique)
const legit = cl.length === 2 && cl[1].dur > 0 && (cl[1].t - cl[0].t) / 1000 >= cl[1].dur - 0.6;
check(`[${tema}] passou uma vez só (1 clique da Brasa no "próximo")`, nNext === 1 || legit, { cliques: nNext, cl, legit, agora: await meio(), depoisAuto });
// v0.6.5: a "Rolagem automática" do TikTok some; sem conta o Curtir/Seguir sozinho não age (só lê)
const autoTT = await p.evaluate(() => { const l = [...document.querySelectorAll('[data-e2e="cinema-playback-control-autoscroll"]')]; return { n: l.length, escondidas: l.filter((e) => getComputedStyle(e).display === 'none').length, marca: document.documentElement.hasAttribute('data-brasa-semautott') }; });
check(`[${tema}] "Rolagem automática" do TikTok escondida no site real`, autoTT.marca && autoTT.n === autoTT.escondidas, autoTT);
check(`[${tema}] botões Curtir e Seguir no bloco da Brasa no site real`, await p.evaluate(() => !!document.querySelector('.brasa-acoes .brasa-curtir') && !!document.querySelector('.brasa-acoes .brasa-seguir')));
const curtidoras = await p.evaluate(() => [...document.querySelectorAll('[data-e2e="like-icon"]')].slice(0, 3).map((e) => [e.getAttribute('role'), e.getAttribute('aria-pressed')]));
const seguirRot = await p.evaluate(() => [...document.querySelectorAll('[data-e2e="cinema-video-info-follow"]')].slice(0, 2).map((e) => e.getAttribute('aria-label')));
check(`[${tema}] o medido segue igual: coração role=button com aria-pressed, "Seguir" com rótulo`, curtidoras.length > 0 && curtidoras.every((x) => x[0] === 'button' && /^(true|false)$/.test(x[1])) && seguirRot.every((x) => /^(Seguir|Follow)$/.test(x || '')), { curtidoras, seguirRot });
check(`[${tema}] sem erro de script da Brasa`, erros.length === 0, erros.slice(0, 3));
await ctx.close();
fim();
