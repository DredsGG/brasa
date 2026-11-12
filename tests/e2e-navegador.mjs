// v1.0.2: "modo navegador" do TikTok (vídeo aberto de uma grade: perfil, Explorar, busca), relato do André com print.
// TikTok simulado fiel ao medido em 2026-11-12 (ferramentas/medir-navegador.mjs, sem login): browse-video (o vídeo NÃO repete),
// arrow-left/right, browse-close, browse-like-icon (aria-pressed no elemento de cima), browse-follow. Nunca curte nem segue
// ninguém de verdade. Uso: node e2e-navegador.mjs
import path from 'path';
import { abrir, esperarGuia, check, fim, until, wait, estado, lerStorage, semTutorial, SHOT } from './lib.mjs';
import { rotas } from './mock.mjs';

const { ctx, sw } = await abrir();
await esperarGuia(ctx).then((g) => g && g.close());
await semTutorial(sw);
const st = await rotas(ctx);
const erros = [];
const aj = (o) => sw.evaluate((o) => chrome.storage.local.get('br.ajustes').then((l) => chrome.storage.local.set({ 'br.ajustes': Object.assign({}, l['br.ajustes'] || {}, o) })), o);
await aj({ baixar: true, auto: false, autoCurtir: false, autoSeguir: false, autoFoto: 2 });
st.seguindo.add('criador4'); // o último vídeo da grade é de quem você já segue
const mk = (p) => p.evaluate(() => window.__mock);
const bloco = (p) => p.evaluate(() => { const c = document.querySelector('.brasa-acoes'); if (!c) return null; const r = c.getBoundingClientRect(), s = document.querySelector('[data-e2e="arrow-right"]').getBoundingClientRect(), v = document.querySelector('[data-e2e="browse-video"]').getBoundingClientRect();
  const topo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { itens: [...c.querySelectorAll('.brasa-item')].map((i) => i.dataset.acao), visivel: r.width > 0 && r.top >= 0 && !!topo && c.contains(topo), acimaDasSetas: r.bottom <= s.top, dentroDoQuadro: !!c.closest('#navegador'), naBordaDoVideo: r.left < v.right + 60 }; });

const p = await ctx.newPage(); p.on('pageerror', (e) => erros.push(String(e)));
await p.goto('https://www.tiktok.com/explore?login=1');
await until(() => p.evaluate(() => window.__mock && window.__mock.pronto && document.querySelectorAll('#grade a').length > 0));
await wait(1500);
check('na grade (sem vídeo aberto) não há bloco da Brasa', !(await bloco(p)));
await p.click('#grade a'); // clique de verdade, como abrir o vídeo de um perfil
await until(() => p.evaluate(() => !!document.querySelector('[data-e2e="browse-video"]')));
const id0 = (await mk(p)).nav.id;
check('abriu o vídeo no quadro (URL do vídeo)', /\/@criador1\/video\//.test(p.url()) && !!id0, p.url());
const b0 = await until(() => bloco(p), 5000);
check('bloco da Brasa no quadro: Baixar e Auto, logo acima das setas do quadro', !!b0 && b0.visivel && b0.acimaDasSetas && b0.dentroDoQuadro && b0.itens.includes('baixar') && b0.itens.includes('auto') && b0.itens.includes('curtir') && b0.itens.includes('seguir'), b0);
await p.screenshot({ path: path.join(SHOT, 'navegador-bloco.png') });

// Baixar pelo botão do bloco: o vídeo do quadro
await p.evaluate(() => document.querySelector('.brasa-acoes .brasa-baixar').click());
const dl = await until(async () => { const l = await sw.evaluate(() => chrome.downloads.search({ state: 'complete' })); return l.length ? l : null; }, 30000, 300);
check('Baixar no quadro baixa o vídeo da tela (pela aba, sem marca d\'água)', !!dl && st.cdn.some((x) => /tiktok\.com/.test(x.ref)) && !st.cdn.some((x) => x.v === 'marca'), dl && dl.map((d) => d.filename.split(/[\\/]/).pop()));

// Auto: o vídeo do quadro NÃO repete; no fim a Brasa passa pela seta do quadro, uma vez
await aj({ auto: true });
const fins0 = (await mk(p)).nav.fins;
const passou = await until(async () => { const m = await mk(p); return m.nav.proximos >= 1 && m.nav.id !== id0 ? m.nav : null; }, 20000, 200);
check('Auto no quadro: no fim do vídeo passou para o próximo pela seta do quadro', !!passou && passou.fins > fins0, passou);
// relato do André (print): o próximo era um carrossel de fotos (/photo/) e a Brasa sumia (só o Baixar) e não passava
check('o próximo é um carrossel de fotos (URL /photo/)', passou && passou.foto && /\/photo\//.test(p.url()), p.url());
const bf = await until(() => bloco(p), 4000);
check('no carrossel do quadro o bloco continua inteiro (Baixar, Auto, Curtir, Seguir)', !!bf && ['baixar', 'auto', 'curtir', 'seguir'].every((x) => bf.itens.includes(x)) && bf.visivel, bf);
const passouFoto = await until(async () => { const m = await mk(p); return m.nav.proximos >= 2 ? m.nav : null; }, 12000, 200);
const mostr = passouFoto ? passouFoto.mostrados : [], iF = mostr.findIndex((x) => x.foto), msFoto = iF >= 0 && mostr[iF + 1] ? mostr[iF + 1].t - mostr[iF].t : null;
check('Auto passa o carrossel depois de N s (2 s no teste) pela seta do quadro', !!passouFoto && !passouFoto.foto && msFoto >= 1800 && msFoto < 6000, { msFoto, mostr });
await wait(1200);
check('passou uma vez em cada (vídeo e carrossel)', (await mk(p)).nav.proximos === 2, (await mk(p)).nav);
await aj({ auto: false });

// Curtir sozinho no quadro: curte o vídeo da tela (o aria-pressed fica no elemento de cima do ícone) e não desfaz
await aj({ autoCurtir: true });
const idAgora = (await mk(p)).nav.id;
check('Curtir sozinho no quadro: curtiu o vídeo da tela', !!(await until(async () => (await mk(p)).curtidas.includes(idAgora), 8000, 150)), (await mk(p)).curtidas);
await wait(4000);
check('ficou no vídeo: não clicou de novo (não descurtiu)', (await mk(p)).curtidas.filter((x) => x === idAgora).length === 1 && (await mk(p)).descurtidas.length === 0);
// Seguir sozinho: segue quem você ainda não segue
await aj({ autoSeguir: true });
const autor = await p.evaluate(() => document.getElementById('nv-user').textContent);
check('Seguir sozinho no quadro: seguiu quem postou', !!(await until(async () => (await mk(p)).seguiu.includes(autor), 8000, 150)), [autor, (await mk(p)).seguiu]);
// próximo vídeo: de quem você já segue (botão "Seguindo", outra classe) → não clica
await p.click('[data-e2e="arrow-right"]');
await until(async () => (await p.evaluate(() => document.getElementById('nv-user').textContent)) === 'criador4', 5000);
await wait(4500);
check('já segue (botão "Seguindo"): não clica (nunca deixa de seguir)', (await mk(p)).deixou.length === 0 && !(await mk(p)).seguiu.includes('criador4'), [(await mk(p)).seguiu, (await mk(p)).deixou]);
check('nunca desfez nada no quadro', (await mk(p)).descurtidas.length === 0 && (await mk(p)).deixou.length === 0);
await aj({ autoCurtir: false, autoSeguir: false });

// fechar o quadro: o bloco sai junto
await p.click('[data-e2e="browse-close"]');
await wait(1500);
check('fechou o quadro: o bloco da Brasa sai junto', !(await bloco(p)) && /\/explore/.test(p.url()), [await bloco(p), p.url()]);
check('sem erros de script', erros.length === 0, erros.slice(0, 3));
await ctx.close();
fim();
