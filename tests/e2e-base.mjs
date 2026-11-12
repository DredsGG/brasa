// Fase 0 (v0.1.0): base. Uso: node e2e-base.mjs
import path from 'path';
import { abrir, esperarGuia, check, fim, until, wait, estado, clicar, texto, ponte, lerStorage, SHOT, VER } from './lib.mjs';
import { rotas, FEED } from './mock.mjs';

const { ctx, sw, extId } = await abrir();
const st = await rotas(ctx);

// guia abre na instalação
const guia = await esperarGuia(ctx);
check('guia COMO-INSTALAR abre na instalação (#usar)', guia && guia.url().endsWith('#usar'), guia && guia.url());
if (guia) {
  await guia.waitForSelector('.tabs button');
  const abas = await guia.$$eval('.tabs button', (b) => b.map((x) => x.textContent));
  check('guia tem os 4 navegadores', abas.join(',') === 'Chrome,Edge,Brave,Opera GX', abas);
  const ok3 = [];
  for (const l of ['en', 'es', 'pt']) { await guia.click(`nav.langs button[data-l="${l}"]`); ok3.push(await guia.textContent('h1')); }
  check('guia nos 3 idiomas', ok3[0].includes('how to install') && ok3[1].includes('cómo instalar') && ok3[2].includes('como instalar'), ok3);
  check('rodapé do guia: feito por Dreds · versão', (await guia.textContent('footer')).includes(`feito por Dreds · v${VER}`));
  await guia.screenshot({ path: path.join(SHOT, 'guia-pt.png'), fullPage: true });
  await guia.close();
}
check('registro: "Brasa vX instalada"', !!(await until(async () => ((await lerStorage(sw, 'br.log')) || []).find((e) => e.k === 'instalada' && e.a[0] === VER))));

const p = await ctx.newPage();
const erros = [];
p.on('pageerror', (e) => erros.push(String(e)));
p.on('console', (m) => { if (m.type() === 'error' && /brasa|chrome-extension/i.test(m.text())) erros.push(m.text()); });
await p.goto('https://www.tiktok.com/foryou');
await p.waitForSelector('article video', { state: 'attached' });

// tutorial na instalação nova
let e = await until(async () => { const s = await estado(p); return s.card ? s : null; });
check('tutorial na instalação nova', e && e.card.title === 'Como usar a Brasa', e && e.card);
await p.screenshot({ path: path.join(SHOT, 'tutorial-pt.png') });
await p.keyboard.press('Escape'); await wait(300);
check('tutorial fecha no Esc', !(await estado(p)).card);
const ob = await lerStorage(sw, 'br.onboard');
check('tutorial marcado como visto (não volta)', ob && ob.tutorial === 'visto', ob);

// botão na barra lateral
e = await until(async () => { const s = await estado(p); return s.btn ? s : null; });
check('botão "Brasa" na barra lateral, logo abaixo do "Mais"', e && e.btnLogoAbaixoDoMais && e.btnLabel === 'Brasa', e);
check('um Brasa só: com a barra lateral, o botão solto do canto NÃO aparece na tela', e && !e.flut, e && e.flut);
check('botão com o mesmo visual dos itens nativos (classes TUXButton do "Mais")', e && /TUXButton--secondary/.test(e.btnClasse) && e.btns === 1, e && e.btnClasse);

// o gancho do page.js guardou as respostas do feed (fetch + XHR), só em memória
await until(() => p.evaluate(() => window.__mock.pronto));
const stats = await until(async () => { const s = await ponte(p, 'stats'); return s && s.respostas >= 2 ? s : null; });
check('page.js leu /api/recommend/item_list/ (fetch) e /api/preload/item_list/ (XHR)', stats && stats.porRota.recommend >= 1 && stats.porRota.preload >= 1, stats);
const id0 = FEED.recommend[0].itemList[0].id;
const it0 = await ponte(p, 'item', id0);
check('item guardado em memória com autor e vídeo', it0 && it0.id === id0 && it0.autor && it0.autor.uniqueId === FEED.recommend[0].itemList[0].author.uniqueId && it0.video, it0);
const naPagina = await p.evaluate(() => window.__mock.renderizados.length);
check('o feed do site continua igual (fase 0 não filtra nada)', naPagina === FEED.recommend[0].itemList.length, naPagina);
const nadaGravado = await sw.evaluate(async () => JSON.stringify(await chrome.storage.local.get(null)));
check('nenhum item do feed vai para o storage (só memória)', !nadaGravado.includes(id0));

// menu abre no clique, ao lado da barra, sem cobrir o vídeo e sem deixar clique vazar para a página
// comentários abertos (v0.6.2) empurram o vídeo para a esquerda e o menu aberto cobre a borda dele: medido com eles fechados
await until(() => p.evaluate(() => window.__mock.cliquesComent >= 1), 6000); await p.evaluate(() => window.__comentarios(false)); await wait(300);
const antes = await p.evaluate(() => window.__mock.cliquesPagina);
await p.click('#brasa-nav button');
e = await until(async () => { const s = await estado(p); return s.menu ? s : null; });
check('menu abre no clique', !!e);
check('menu: abas Recursos e Registro, com as seções dos recursos', e && e.menuTexto.includes('Recursos') && e.menuTexto.includes('Registro') && e.menuTexto.includes('Modo foco'), e && e.menuTexto.slice(0, 200));
const caixa = await p.evaluate(() => { const r = document.querySelector('brasa-ui').shadowRoot.querySelector('.menu .pn').getBoundingClientRect(); const v = document.querySelector('article video').getBoundingClientRect(); return { menu: [r.left, r.top, r.right, r.bottom].map(Math.round), video: [v.left, v.top, v.right, v.bottom].map(Math.round), h: innerHeight }; });
check('menu não cobre o vídeo (1280 px, comentários fechados)', caixa.menu[2] <= caixa.video[0] && caixa.menu[3] <= caixa.h && caixa.menu[1] >= 0, caixa);
await clicar(p, '.pn .hd b'); await clicar(p, '.pn .sc'); await p.keyboard.press('ArrowDown');
const depois = await p.evaluate(() => ({ c: window.__mock.cliquesPagina, prox: window.__mock.proximos }));
check('cliques dentro do menu não chegam à página', depois.c === antes, { antes, depois });
await p.screenshot({ path: path.join(SHOT, 'menu-pt.png') });

// rodapé: itens, Dreds, versão
const foot = await p.evaluate(() => { const f = document.querySelector('brasa-ui').shadowRoot.querySelector('.menu .foot'); const a = f.querySelector('a.dreds');
  return { txt: f.textContent.replace(/\s+/g, ' '), href: a && a.href, target: a && a.target, rel: a && a.rel, acts: [...f.querySelectorAll('[data-act]')].map((b) => b.dataset.act), langs: [...f.querySelectorAll('.langs button')].map((b) => b.textContent) }; });
check('rodapé: Procurar atualização · Relatar bug · ? · Apoiar ♥', ['check', 'bug', 'help', 'apoio'].every((a) => foot.acts.includes(a)) && foot.txt.includes('Procurar atualização') && foot.txt.includes('Relatar bug') && foot.txt.includes('Apoiar ♥'), foot.acts);
check(`rodapé: "feito por Dreds · v${VER}" com Dreds → github.com/DredsGG`, foot.txt.includes(`feito por Dreds · v${VER}`) && foot.href === 'https://github.com/DredsGG' && foot.target === '_blank' && /noopener/.test(foot.rel), foot);
check('rodapé: PT · EN · ES', foot.langs.join(',') === 'PT,EN,ES', foot.langs);

// Procurar atualização com o repo inexistente (404): sem erro, sem aviso
await clicar(p, '.menu .foot [data-act=check]');
const msg = await until(async () => { const t = await texto(p, '.menu .foot .msg'); return t && t !== 'Procurando…' ? t : null; });
check('repo inexistente (404): "Você está na versão mais nova." e nenhum quadro', msg === 'Você está na versão mais nova.' && !(await estado(p)).card, msg);
const updSt = await lerStorage(sw, 'br.update');
check('404 grava semRelease sem erro', updSt && updSt.semRelease === true && !updSt.erro, updSt);

// chave geral: desliga → selo OFF e linha no registro; liga de volta
await clicar(p, '.menu [data-act=on]');
const selo = await until(() => sw.evaluate(() => chrome.action.getBadgeText({})).then((b) => (b === 'OFF' ? b : null)));
check('desligar a Brasa: selo OFF no ícone', selo === 'OFF', selo);
await clicar(p, '.menu .tabs [data-aba=log]');
e = await until(async () => { const s = await estado(p); return s.aba === 'Registro' && s.menuTexto.includes('Brasa ligada: desligado') ? s : null; });
check('Registro mostra "Brasa ligada: desligado" e a instalação', e && e.menuTexto.includes(`Brasa v${VER} instalada`), e && e.menuTexto.slice(0, 300));
await p.screenshot({ path: path.join(SHOT, 'menu-registro.png') });
await clicar(p, '.menu [data-act=on]');
check('ligar de volta: selo some', !!(await until(() => sw.evaluate(() => chrome.action.getBadgeText({})).then((b) => (b === '' ? 'ok' : null)))));
await clicar(p, '.menu [data-log=limpar]');
check('Limpar apaga o registro', !!(await until(async () => { const l = await lerStorage(sw, 'br.log'); return Array.isArray(l) && l.length === 0 ? 'ok' : null; })));
await clicar(p, '.menu .tabs [data-aba=rec]');

// navegação interna (pushState): Seguindo
await p.keyboard.press('Escape'); await wait(200);
check('Esc fecha o menu', !(await estado(p)).menu);
await p.evaluate(() => { window.__semRecarga = 1; });
await p.click('[data-e2e="nav-following"]');
const st2 = await until(async () => { const s = await ponte(p, 'stats'); return s && s.porRota.following >= 1 ? s : null; });
check('navegação interna: page.js lê /api/following/item_list/', !!st2, st2);
await wait(1200);
e = await estado(p);
check('botão continua único depois da navegação', e.btn && e.btns === 1 && e.hosts === 1, e);
const kind = await sw.evaluate(async () => { const [t] = await chrome.tabs.query({ url: 'https://www.tiktok.com/*' }); return t.url; });
// v0.6.5: no Seguindo os comentários abrem sozinhos e a URL vira /@…/video/<id> (como o site); a página é a mesma
check('URL mudou sem recarregar', (/\/following$/.test(kind) || /\/@mock\/video\/\d+$/.test(kind)) && (await p.evaluate(() => window.__semRecarga === 1)), kind);

// tema escuro: o host acompanha o html[data-theme]
await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
check('tema escuro acompanha o TikTok', !!(await until(async () => (await estado(p)).tema === 'dark')));
await p.click('#brasa-nav button'); await until(async () => (await estado(p)).menu);
await p.screenshot({ path: path.join(SHOT, 'menu-escuro.png') });

// idiomas
await clicar(p, '.menu .foot .langs button[data-l="en"]');
e = await until(async () => { const s = await estado(p); return s.menuTexto.includes('Check for updates') ? s : null; });
check('EN: menu e rodapé em inglês', e && e.menuTexto.includes('made by Dreds') && e.menuTexto.includes('Features'), e && e.menuTexto.slice(0, 160));
await p.screenshot({ path: path.join(SHOT, 'menu-en.png') });
await clicar(p, '.menu .foot .langs button[data-l="es"]');
e = await until(async () => { const s = await estado(p); return s.menuTexto.includes('Buscar actualización') ? s : null; });
check('ES: menu e rodapé em espanhol', e && e.menuTexto.includes('hecho por Dreds') && e.menuTexto.includes('Funciones'));
await clicar(p, '.menu .foot .langs button[data-l="pt"]'); await wait(300);
check('idioma salvo só no storage.local', (await lerStorage(sw, 'br.ajustes')).lang === 'pt' && JSON.stringify(await sw.evaluate(() => chrome.storage.sync.get(null))) === '{}');

// Relatar bug: abre o Issues do repo com versão e diagnóstico (sem URL, sem nome de perfil, sem desc de vídeo)
const nova = ctx.waitForEvent('page');
await clicar(p, '.menu .foot [data-act=bug]');
const rel = await nova.catch(() => null);
const url = rel ? decodeURIComponent(rel.url()) : '';
check('Relatar bug abre DredsGG/brasa/issues/new com versão e diagnóstico', url.startsWith('https://github.com/DredsGG/brasa/issues/new') && url.includes(`Brasa v${VER}`) && url.includes('main=1') && url.includes('btn=sidebar'), url.slice(0, 160));
const autor0 = FEED.recommend[0].itemList[0].author.uniqueId;
check('diagnóstico sem nome de perfil, id ou texto de vídeo', url && !url.includes(autor0) && !url.includes(id0) && !url.includes('/following'));
if (rel) await rel.close();

// Apoiar ♥: Brasil → QR + código igual ao de referência (apoio.md)
await p.bringToFront();
if (!(await estado(p)).menu) { await p.click('#brasa-nav button'); await until(async () => (await estado(p)).menu); }
await clicar(p, '.menu .foot [data-act=apoio]');
e = await until(async () => { const s = await estado(p); return s.card && s.card.title === 'De onde você é?' ? s : null; });
check('Apoiar abre "De onde você é?" com Brasil destacado em PT', !!e && await p.evaluate(() => !!document.querySelector('brasa-ui').shadowRoot.querySelector('.apc.hl[data-ap="br"]')));
await clicar(p, '[data-ap="br"]'); await wait(200);
const REF = {
  livre: '00020126580014br.gov.bcb.pix0136fa525dad-afca-4683-845d-eee7225a53e35204000053039865802BR5918Andre Miller Fleck6009Sao Paulo62070503***63047D61',
  5: '00020126580014br.gov.bcb.pix0136fa525dad-afca-4683-845d-eee7225a53e352040000530398654045.005802BR5918Andre Miller Fleck6009Sao Paulo62070503***6304C8ED',
  10: '00020126580014br.gov.bcb.pix0136fa525dad-afca-4683-845d-eee7225a53e3520400005303986540510.005802BR5918Andre Miller Fleck6009Sao Paulo62070503***6304DCD7',
  25: '00020126580014br.gov.bcb.pix0136fa525dad-afca-4683-845d-eee7225a53e3520400005303986540525.005802BR5918Andre Miller Fleck6009Sao Paulo62070503***63044036',
};
const pix = () => p.evaluate(() => document.querySelector('brasa-ui').shadowRoot.querySelector('.apcp').getAttribute('data-pix'));
check('Pix R$ 10 (padrão) igual ao de referência (apoio.md)', (await pix()) === REF[10], await pix());
for (const v of [5, 25]) { await clicar(p, `.apv[data-v="${v}"]`); await wait(150); check(`Pix R$ ${v} igual ao de referência`, (await pix()) === REF[v]); }
await clicar(p, '.apv[data-v="outro"]'); await wait(150);
check('Outro valor vazio = valor livre igual ao de referência', (await pix()) === REF.livre);
await p.evaluate(() => { const i = document.querySelector('brasa-ui').shadowRoot.querySelector('.apo input'); i.value = '12,50'; i.dispatchEvent(new Event('input')); });
await wait(150);
check('Outro valor 12,50 → campo 54 05 12.50', /540512\.50/.test(await pix()), await pix());
await clicar(p, '.apv[data-v="10"]'); await wait(150);
check('QR desenhado', await p.evaluate(() => !!document.querySelector('brasa-ui').shadowRoot.querySelector('.qr svg path')));
await p.screenshot({ path: path.join(SHOT, 'apoiar-br.png') });
await clicar(p, '[data-back]'); await wait(150); await clicar(p, '[data-ap="int"]'); await wait(150);
check('Outro país → botão do GitHub Sponsors', ((await texto(p, '.card')) || '').includes('GitHub Sponsors'));
await p.keyboard.press('Escape'); await wait(250);
check('Apoiar fecha no Esc', !(await estado(p)).card);

// versão nova (regra 14): quadro no meio, X adia 1 h
st.gh = { tag: 'v9.9.9', name: 'v9.9.9', body: '- Uma coisa nova\n- Outra' };
await sw.evaluate(() => chrome.storage.local.set({ 'br.update': { procuradoEm: 0 } }));
await p.evaluate(() => window.dispatchEvent(new Event('focus')));
e = await until(async () => { const s = await estado(p); return s.card && /Nova versão v9.9.9/.test(s.card.title) ? s : null; }, 15000);
check('versão nova: quadro "Nova versão v9.9.9" com X', e && e.card.x, e && e.card);
await p.screenshot({ path: path.join(SHOT, 'versao-nova.png') });
const badge = await until(() => sw.evaluate(() => chrome.action.getBadgeText({})).then((b) => (b === '↑' ? b : null)));
check('selo ↑ no ícone', badge === '↑', badge);
await clicar(p, '.card .x'); await wait(300);
const ad = await lerStorage(sw, 'br.adiado');
check('X adia 1 h', ad && ad.ultima === '9.9.9' && ad.ate - Date.now() > 59 * 60e3, ad);
check('quadro some depois do X', !(await estado(p)).card);
check('registro: "Versão nova no GitHub: v9.9.9"', !!(await until(async () => ((await lerStorage(sw, 'br.log')) || []).find((x) => x.k === 'versaoNova' && x.a[0] === '9.9.9'))));

// versão URGENTE: sem X, Esc não fecha, pausa (banner "pausada"), selo !
st.gh = { tag: 'v9.9.10', name: 'v9.9.10 URGENTE', body: '- Correção grave' };
await sw.evaluate(() => chrome.storage.local.set({ 'br.update': { procuradoEm: 0 } }));
await p.evaluate(() => window.dispatchEvent(new Event('focus')));
e = await until(async () => { const s = await estado(p); return s.card && /Atualize para a v9.9.10/.test(s.card.title) ? s : null; }, 15000);
check('URGENTE: quadro sem X', e && !e.card.x, e && e.card);
await p.keyboard.press('Escape'); await wait(300);
check('URGENTE: Esc não fecha', !!(await estado(p)).card);
check('URGENTE: selo "!"', (await until(() => sw.evaluate(() => chrome.action.getBadgeText({})).then((b) => (b === '!' ? b : null)))) === '!');
await p.screenshot({ path: path.join(SHOT, 'urgente.png') });
const dl = ctx.waitForEvent('page').catch(() => null);
await clicar(p, '.card .go');
e = await until(async () => { const s = await estado(p); return s.card && /Downloads/.test(s.card.text) ? s : null; });
check('Atualizar (por pasta) baixa o zip do Release e explica extrair por cima', !!e);
st.gh = null;
await sw.evaluate(() => chrome.storage.local.set({ 'br.update': { procuradoEm: 0 } }));
await p.evaluate(() => window.dispatchEvent(new Event('focus')));
check('sem release de novo: quadro urgente some', !!(await until(async () => !(await estado(p)).card)));

// popup: o ícone fora do TikTok abre o mesmo menu
const tabs = await sw.evaluate(async () => { const out = []; for (const t of await chrome.tabs.query({})) out.push({ url: t.url, popup: await chrome.action.getPopup({ tabId: t.id }) }); return out; });
const naTT = tabs.find((t) => /tiktok\.com/.test(t.url)), fora = tabs.find((t) => !/tiktok\.com/.test(t.url));
check('na aba do TikTok o ícone não tem popup (abre o menu da página)', naTT && naTT.popup === '', naTT);
check('fora do TikTok o ícone abre o popup', !fora || /popup\/popup\.html$/.test(fora.popup), fora);
const pop = await ctx.newPage();
await pop.setViewportSize({ width: 360, height: 600 });
await pop.goto(`chrome-extension://${extId}/popup/popup.html`);
const popTxt = await until(async () => { const t = await pop.evaluate(() => { const r = document.getElementById('app').shadowRoot; return r && r.querySelector('.pn') ? r.querySelector('.pn').textContent.replace(/\s+/g, ' ') : null; }); return t; });
check('popup: mesmo menu, "Abrir o TikTok" e o rodapé', popTxt && popTxt.includes('Abrir o TikTok') && popTxt.includes('Recursos') && popTxt.includes(`feito por Dreds · v${VER}`), popTxt && popTxt.slice(0, 200));
await pop.screenshot({ path: path.join(SHOT, 'popup.png') });
await pop.evaluate(() => document.getElementById('app').shadowRoot.querySelector('[data-act=help]').click());
check('popup: "?" abre o tutorial', !!(await until(() => pop.evaluate(() => { const c = document.getElementById('app').shadowRoot.querySelector('.card'); return c && !c.hidden && /Como usar a Brasa/.test(c.textContent); }))));
await pop.close();

// várias abas: cada aba do TikTok tem um botão só
const p2 = await ctx.newPage();
await p2.goto('https://www.tiktok.com/foryou?theme=dark');
e = await until(async () => { const s = await estado(p2); return s.btn ? s : null; });
check('segunda aba: um botão, um host, tema escuro', e && e.btns === 1 && e.hosts === 1 && e.tema === 'dark', e);
await p2.screenshot({ path: path.join(SHOT, 'aba2-escuro.png') });
await p2.close();

// plano B: sem barra lateral → botão solto no canto depois de 8 s, com aviso no registro
const p3 = await ctx.newPage();
await p3.goto('https://www.tiktok.com/foryou?nosidebar=1');
e = await until(async () => { const s = await estado(p3); return s.flut ? s : null; }, 20000);
check('sem barra lateral: botão Brasa solto no canto (plano B)', !!e);
await p3.evaluate(() => document.querySelector('brasa-ui').shadowRoot.querySelector('.flut').click());
check('o botão solto abre o mesmo menu', !!(await until(async () => (await estado(p3)).menu)));
check('registro avisa que a barra lateral sumiu', !!(await until(async () => ((await lerStorage(sw, 'br.log')) || []).find((x) => x.k === 'semBotao'))));
await p3.close();

// tela cheia: o host vai para dentro do elemento em tela cheia
await p.bringToFront();
await p.keyboard.press('Escape');
const fs1 = await p.evaluate(async () => { try { await document.querySelector('article').requestFullscreen(); } catch (e) { return 'erro ' + e.message; } await new Promise((r) => setTimeout(r, 1500)); return document.fullscreenElement ? document.fullscreenElement.contains(document.querySelector('brasa-ui')) : 'sem-fs'; });
check('tela cheia: quadros e menu continuam visíveis (host dentro do elemento em tela cheia)', fs1 === true || fs1 === 'sem-fs', fs1);
await p.evaluate(() => document.fullscreenElement && document.exitFullscreen()).catch(() => {});

// v0.6.4: perfil, Seguindo, busca e hashtag (medido): itens da barra dentro de <div TUXTooltip-reference>, e o site tira o que
// for colocado dentro deles. O botão tem de ficar logo abaixo do "Mais", fixo (antes ele piscava e sumia).
const p4 = await ctx.newPage(); p4.on('pageerror', (x) => erros.push(String(x)));
await p4.goto('https://www.tiktok.com/@alguem?barra=tooltip');
await until(() => p4.evaluate(() => !!document.querySelector('#brasa-nav button')), 10000);
const amostras = [];
for (let i = 0; i < 12; i++) { amostras.push(await p4.evaluate(() => { const w = document.querySelector('#brasa-nav'); const b = w && w.querySelector('button'); const r = b && b.getBoundingClientRect(); return !!(w && r.width > 0 && w.parentElement.id === 'navc' && w.previousElementSibling && w.previousElementSibling.querySelector('[data-e2e="nav-more-menu"]')); })); await wait(250); }
check('barra com itens em TUXTooltip (perfil, Seguindo, busca): Brasa logo abaixo do "Mais" e fixo por 3 s', amostras.every(Boolean), amostras);
check('o site não precisou tirar o botão de dentro de um item', !(await p4.evaluate(() => window.__removidosPeloSite || 0)));
check('e um Brasa só (sem o solto do canto)', !(await estado(p4)).flut);
await p4.close();
check('sem erros de script na página', erros.length === 0, erros.slice(0, 3));
await ctx.close();
fim();
