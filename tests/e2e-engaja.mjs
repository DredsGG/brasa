// v0.6.5: Auto curtir e Auto seguir (desligados de fábrica) + "Rolagem automática" do TikTok escondida.
// SÓ no TikTok simulado (mock.mjs, fiel ao medido: coração [data-e2e=like-icon] com aria-pressed; "Seguir"
// [data-e2e=cinema-video-info-follow]; digged/author.relation na API) — nunca curte nem segue ninguém de verdade.
// O ponto principal: nunca DESFAZER (clicar no coração já curtido ou no "Seguindo"). Uso: node e2e-engaja.mjs
import path from 'path';
import { abrir, esperarGuia, check, fim, until, wait, estado, clicar, lerStorage, semTutorial, SHOT } from './lib.mjs';
import { rotas } from './mock.mjs';

const { ctx, sw } = await abrir();
await esperarGuia(ctx).then((g) => g && g.close());
await semTutorial(sw);
const st = await rotas(ctx);
const erros = [];
const aj = (o) => sw.evaluate((o) => chrome.storage.local.get('br.ajustes').then((l) => chrome.storage.local.set({ 'br.ajustes': Object.assign({}, l['br.ajustes'] || {}, o) })), o);
await aj({ coment: false });
// o que a "API" diz: 7764 já curtido; criador3 já seguido
st.curtidos.add('7700000000000000004');
st.seguindo.add('criador3');

const mk = (p) => p.evaluate(() => window.__mock);
const telaId = (p) => p.evaluate(() => { const a = [...document.querySelectorAll('article')].find((x) => { const r = x.getBoundingClientRect(); return r.top <= innerHeight / 2 && r.bottom >= innerHeight / 2; }); return a ? a.querySelector('[id^=xgwrapper-]').id.split('-').pop() : null; });
const proximo = async (p) => { const antes = await telaId(p); await p.evaluate(() => document.querySelector('[data-e2e="feed-navigation-next"]').click()); return until(async () => { const d = await telaId(p); return d && d !== antes ? d : null; }, 5000, 100); };
const porque = (p) => p.evaluate(() => document.documentElement.getAttribute('data-brasa-engaja'));
// mexe no DOM de um vídeo que ainda vai chegar (estado "velho" da API vs. a página)
const noArtigo = (p, id, fn) => p.evaluate(([id, fn]) => { const w = document.querySelector('[id$="-' + id + '"]'); const a = w && w.closest('article'); if (!a) return false; new Function('a', fn)(a); return true; }, [id, fn]);
const nova = async (url) => { const p = await ctx.newPage(); p.on('pageerror', (e) => erros.push(String(e))); await p.goto(url); await until(() => p.evaluate(() => window.__mock && window.__mock.pronto)); return p; };

// ── sem conta: não faz nada
await aj({ autoCurtir: true, autoSeguir: true });
const p0 = await nova('https://www.tiktok.com/foryou');
await wait(4000);
let m = await mk(p0);
check('sem conta (botão Entrar): não curte nem segue', m.curtidas.length === 0 && m.seguiu.length === 0 && (await porque(p0)) === 'sem-conta', await porque(p0));
await p0.close();
await aj({ autoCurtir: false, autoSeguir: false });

// ── com conta, desligado de fábrica
const p = await nova('https://www.tiktok.com/foryou?login=1');
await wait(3500);
m = await mk(p);
const bl = await p.evaluate(() => [...document.querySelectorAll('.brasa-acoes .brasa-item')].map((i) => [i.dataset.acao, i.querySelector('button').getAttribute('aria-pressed'), i.querySelector('.brasa-rot').textContent]));
check('desligado de fábrica: nada curtido nem seguido', m.curtidas.length === 0 && m.seguiu.length === 0);
check('bloco da Brasa: "Curtir" e "Seguir" ao lado do Auto (desligados)', JSON.stringify(bl.filter((x) => ['auto', 'curtir', 'seguir'].includes(x[0]))) === JSON.stringify([['auto', 'false', 'Auto'], ['curtir', 'false', 'Curtir'], ['seguir', 'false', 'Seguir']]), bl);
check('a "Rolagem automática" do TikTok some com a Brasa ligada', await p.evaluate(() => [...document.querySelectorAll('[data-e2e="cinema-playback-control-autoscroll"]')].every((e) => getComputedStyle(e).display === 'none')));
const lugares = await p.evaluate(() => Object.fromEntries(['autott-canto', 'opc-auto', 'mm-auto', 'opc-outro'].map((id) => [id, getComputedStyle(document.getElementById(id)).display === 'none'])));
check('some também o botão do canto, o item do menu "…" e a linha da lista de opções (o resto da lista fica)', lugares['autott-canto'] && lugares['opc-auto'] && lugares['mm-auto'] && !lugares['opc-outro'], lugares);

// ── Curtir pelo botão do bloco
await p.evaluate(() => document.querySelector('.brasa-acoes .brasa-curtir').click());
const ligou = !!(await until(async () => (await lerStorage(sw, 'br.ajustes')).autoCurtir === true, 3000));
const avisoC = await until(async () => { const t = (await estado(p)).toast; return t && /Curtir sozinho ligado/.test(t) ? t : null; }, 3000, 100);
check('botão "Curtir" liga a chave e avisa', ligou && !!avisoC, [ligou, (await estado(p)).toast]);
const id0 = await telaId(p);
const t0 = Date.now();
check('curtiu o vídeo da tela pelo coração do TikTok', !!(await until(async () => (await mk(p)).curtidas.includes(id0), 6000, 100)));
check('esperou ~2 s no vídeo antes de curtir', Date.now() - t0 >= 1700, Date.now() - t0);
await wait(3500);
m = await mk(p);
check('ficou no vídeo: não clica de novo (não desfaz a curtida)', m.curtidas.length === 1 && m.descurtidas.length === 0, m);
check('o coração ficou marcado (aria-pressed=true)', await p.evaluate(() => document.querySelector('[id$="-' + '7700000000000000001' + '"]').closest('article').querySelector('[data-e2e="like-icon"]').getAttribute('aria-pressed') === 'true'));
const id1 = await proximo(p);
check('próximo (foto): curte também', !!(await until(async () => (await mk(p)).curtidas.includes(id1), 6000, 100)), id1);
// 8308: a página diz "já curtido" (a API ainda diz que não — você curtiu agora há pouco, por exemplo)
await noArtigo(p, '7700000000000000003', "a.querySelector('[data-e2e=\"like-icon\"]').setAttribute('aria-pressed','true')");
await proximo(p);
await wait(4000);
m = await mk(p);
check('já curtido na página: não toca (não descurte)', !m.curtidas.includes('7700000000000000003') && m.descurtidas.length === 0 && (await porque(p)) === 'curtir-ja-curtido', [await porque(p), m.descurtidas]);
// 7764: a API diz "já curtido" (e a página, por algum atraso, não)
await noArtigo(p, '7700000000000000004', "a.querySelector('[data-e2e=\"like-icon\"]').setAttribute('aria-pressed','false')");
await proximo(p);
await wait(4000);
m = await mk(p);
check('já curtido segundo o TikTok (digged): não toca', !m.curtidas.includes('7700000000000000004') && m.descurtidas.length === 0 && (await porque(p)) === 'curtir-ja-curtido-api', await porque(p));
check('contagem do dia guardada (2 curtidas)', ((await lerStorage(sw, 'br.engaja')) || {}).curtidas === 2, await lerStorage(sw, 'br.engaja'));

// ── Seguir pelo menu (cartão)
await p.evaluate(() => document.querySelector('#brasa-nav button').click());
const e = await until(async () => { const s = await estado(p); return s.menu && /Seguir sozinho/.test(s.menuTexto) ? s : null; });
check('menu: cartões "Curtir sozinho" e "Seguir sozinho" com a frase de que nunca desfaz', !!e && /nunca desfaz uma curtida/.test(e.menuTexto) && /nunca deixa de seguir/.test(e.menuTexto) && /Hoje: 2 de 500/.test(e.menuTexto), e && e.menuTexto.slice(0, 300));
await clicar(p, '.menu [data-aj="autoSeguir"]');
check('ligar "Seguir sozinho" no menu grava a chave', !!(await until(async () => (await lerStorage(sw, 'br.ajustes')).autoSeguir === true, 3000)));
await p.keyboard.press('Escape');
// 7764 é de criador4 (não segue): segue
check('segue quem postou (criador4) pelo "Seguir" do TikTok', !!(await until(async () => (await mk(p)).seguiu.includes('criador4'), 8000, 150)));
check('o bloco mostra "Seguir" ligado', await p.evaluate(() => document.querySelector('.brasa-acoes .brasa-seguir').getAttribute('aria-pressed') === 'true'));
await p.screenshot({ path: path.join(SHOT, 'engaja-bloco.png') });
// próximo: criador5 (não segue) — espera o ritmo de 20 s entre um seguir e outro
const tSeg = Date.now();
await proximo(p);
await wait(3500);
check('ritmo: o segundo seguir espera (1 a cada 20 s)', !(await mk(p)).seguiu.includes('criador5') && (await porque(p)) !== 'seguiu', await porque(p));
check('depois do ritmo segue (criador5)', !!(await until(async () => (await mk(p)).seguiu.includes('criador5'), 25000, 300)) && Date.now() - tSeg >= 18000, Date.now() - tSeg);
// próximo vídeo (criador6): a API diz "não segue", mas a página já mostra "Seguindo" → não clica (clicar deixaria de seguir)
const idSeg = await p.evaluate(() => { const b = document.querySelector('[data-e2e="cinema-video-info-follow"][data-autor="criador6"]'); return b && b.closest('article').querySelector('[id^=xgwrapper-]').id.split('-').pop(); });
await noArtigo(p, idSeg, "const b=a.querySelector('[data-e2e=\"cinema-video-info-follow\"]'); b.setAttribute('aria-label','Seguindo'); b.textContent='Seguindo';");
await proximo(p);
await wait(4000);
m = await mk(p);
check('página mostra "Seguindo": não clica (não deixa de seguir)', !m.seguiu.includes('criador6') && m.deixou.length === 0 && /seguir-rotulo-outro/.test(await porque(p)), [await porque(p), m.deixou]);
check('nunca desfez nada (nenhuma descurtida, ninguém deixou de ser seguido)', m.descurtidas.length === 0 && m.deixou.length === 0);
const eng = await lerStorage(sw, 'br.engaja');
check('contagem do dia: seguidos 2, autores guardados', eng && eng.seguidos === 2 && eng.autores.includes('criador4') && eng.autores.includes('criador5'), eng);
const log = ((await lerStorage(sw, 'br.log')) || []).filter((x) => x.k === 'engaja').map((x) => x.a[0]);
check('registro: curtiu e seguiu', log.includes('curtiu') && log.includes('seguiu'), log);
await p.close();

// ── quem você já segue com o botão "Seguindo" na tela (API relation 1): não clica
await sw.evaluate(() => chrome.storage.local.remove('br.engaja'));
await aj({ autoCurtir: false, autoSeguir: true });
const p2 = await nova('https://www.tiktok.com/foryou?login=1&seguindoVisivel=1');
await proximo(p2); await proximo(p2); // até 8308 (criador3, já seguido)
await wait(3500);
m = await mk(p2);
check('já segue (relation 1, botão "Seguindo" na tela): não clica', !m.seguiu.includes('criador3') && m.deixou.length === 0 && (await porque(p2)) === 'seguir-ja-segue', await porque(p2));
await p2.close();

// ── anúncio (modo foco desligado para ele aparecer): não curte nem segue
await aj({ foco: false, autoCurtir: true, autoSeguir: true });
await sw.evaluate(() => chrome.storage.local.remove('br.engaja'));
const p3 = await nova('https://www.tiktok.com/foryou?login=1');
for (let i = 0; i < 5; i++) { await proximo(p3); await wait(300); } // 7969, 9541, 8308, 7764, 6039 → anúncio (0001)
const idAd = await telaId(p3);
await wait(4000);
m = await mk(p3);
check('anúncio na tela: não curte nem segue', idAd === '7000000000000000001' && !m.curtidas.includes(idAd) && !m.seguiu.includes('marca_teste') && (await porque(p3)) === 'propaganda', [idAd, await porque(p3)]);
// teto do dia: com 500 curtidas hoje, para e avisa
const hoje = await sw.evaluate(() => { const x = new Date(); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; });
await sw.evaluate((d) => chrome.storage.local.set({ 'br.engaja': { dia: d, curtidas: 500, seguidos: 150, ids: [], autores: [] } }), hoje);
await wait(500);
const n0 = (await mk(p3)).curtidas.length, s0 = (await mk(p3)).seguiu.length;
const idT = await proximo(p3);
await wait(4000);
m = await mk(p3);
check('teto do dia (500 curtidas / 150 seguidos): para', m.curtidas.length === n0 && m.seguiu.length === s0, idT);
check('e avisa que volta amanhã', /volta a (curtir|seguir) amanhã/.test((await estado(p3)).toast || ''), (await estado(p3)).toast);
await p3.close();
await aj({ foco: true, autoCurtir: false, autoSeguir: false });

// ── "Rolagem automática" do TikTok: estava ligada → some e a Brasa desliga; Brasa desligada → volta
const p4 = await nova('https://www.tiktok.com/foryou?autott=1');
const desl = await until(async () => (await mk(p4)).autoTT.includes(false), 5000);
check('a "Rolagem automática" do TikTok estava ligada: a Brasa desligou uma vez', !!desl && (await mk(p4)).autoTT.length === 1, (await mk(p4)).autoTT);
check('e ela fica escondida (sem perigo de apertar)', await p4.evaluate(() => getComputedStyle(document.querySelector('[data-e2e="cinema-playback-control-autoscroll"]')).display === 'none'));
await p4.evaluate(() => document.querySelector('#brasa-nav button').click());
await until(async () => (await estado(p4)).menu);
await clicar(p4, '.menu [data-act=on]');
check('Brasa desligada: a chave do TikTok volta a aparecer e os botões saem', !!(await until(() => p4.evaluate(() => getComputedStyle(document.querySelector('[data-e2e="cinema-playback-control-autoscroll"]')).display !== 'none' && !document.querySelector('.brasa-acoes .brasa-curtir')), 4000)));
await clicar(p4, '.menu [data-act=on]');
await p4.keyboard.press('Escape');
// idioma
await aj({ lang: 'en' });
check('em inglês: "Like" e "Follow" no bloco', !!(await until(() => p4.evaluate(() => { const r = [...document.querySelectorAll('.brasa-acoes .brasa-rot')].map((x) => x.textContent); return r.includes('Like') && r.includes('Follow'); }), 5000)));
await aj({ lang: 'pt' });
check('sem erros de script', erros.length === 0, erros.slice(0, 3));
await ctx.close();
fim();
