// Brasa — fundo da extensão (service worker): procura versão nova (regras 7 e 14), se recarrega quando a pasta muda (sem
// interromper um envio do guarda-foguinho), põe a versão nova nas abas abertas do TikTok, abre o menu pelo ícone (na aba do
// TikTok, o menu da página; fora dele, o popup) e cuida do selo do ícone. Nada de DOM aqui.
importScripts('defaults.js', 'i18n.js', 'guarda-regras.js', 'guarda-fundo.js');
const ext = globalThis.chrome;
const DEF = globalThis.BRASA_DEF;
const K = DEF.K;
const REPO = 'DredsGG/brasa';
const TT_TABS = ['https://www.tiktok.com/*'];
const TT_RE = /^https:\/\/www\.tiktok\.com\//;
const MAIN_JS = ['src/proto.js', 'src/page.js'];
// mesma lista e ordem do manifest (o teste recarga-e2e confere)
const CONTENT = ['src/defaults.js', 'src/i18n.js', 'src/novidades.js', 'src/comum.js', 'src/vendor/qrcode.js', 'src/apoio.js', 'src/core.js', 'src/menu.js', 'src/ui.js', 'src/conta.js', 'src/foco.js', 'src/guarda-regras.js', 'src/guarda.js', 'src/acoes.js', 'src/baixar.js', 'src/auto.js', 'src/engaja.js', 'src/entrada.js', 'src/comentarios.js'];

const cmpVer = (a, b) => {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0), pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d > 0 ? 1 : -1; }
  return 0;
};
const versaoAtual = () => ext.runtime.getManifest().version;
const tipoInstalacao = async () => { try { return (await ext.management.getSelf()).installType; } catch (_) { return 'development'; } };
async function salvarUpd(patch) {
  const cur = (await ext.storage.local.get(K.update))[K.update] || {};
  const novo = Object.assign({}, cur, patch);
  await ext.storage.local.set({ [K.update]: novo });
  return novo;
}

// ───────────────────────── atualização (regras 7 e 14 do hub) ─────────────────────────
// Releases do GitHub: ao abrir o navegador, na instalação, a cada 30 min, quando a página do TikTok abre ou volta a ficar visível
// (no máximo 1 vez a cada 10 min) e no botão do rodapé. Release com "URGENTE" no título = urgente: quadro sem X e a Brasa pausa
// até atualizar. Repo DredsGG/brasa (público desde a v1.0.0); 404 = "sem Release", sem erro e sem aviso.
async function procurar() {
  const antes = (await ext.storage.local.get(K.update))[K.update] || {};
  const base = { procuradoEm: Date.now(), atual: versaoAtual(), instalacao: await tipoInstalacao() };
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store', credentials: 'omit' });
    if (r.status === 404) return salvarUpd(Object.assign(base, { ultima: null, disponivel: false, urgente: false, erro: null, semRelease: true }));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const ultima = String(j.tag_name || '').replace(/^v/i, '');
    const asset = (re) => ((j.assets || []).find((a) => re.test(a.name)) || {}).browser_download_url || null;
    const tit = String(j.name || '') + ' ' + String(j.tag_name || '');
    const urgente = /\bURGENTE?\b/i.test(tit) && !/\b(not|não|nao|no)\s+urgente?\b/i.test(tit);
    const disponivel = !!ultima && cmpVer(ultima, versaoAtual()) > 0;
    if (disponivel && antes.ultima !== ultima) DEF.logar(urgente ? 'urgente' : 'versaoNova', [ultima], !urgente);
    return salvarUpd(Object.assign(base, { ultima, urgente, titulo: String(j.name || '').slice(0, 120), notas: String(j.body || '').slice(0, 4000), pagina: j.html_url || null,
      zip: asset(/\.zip$/i), disponivel, erro: null, semRelease: false }));
  } catch (e) {
    return salvarUpd(Object.assign(base, { erro: String((e && e.message) || e) }));
  }
}

async function aplicar() {
  const st = (await ext.storage.local.get(K.update))[K.update] || {};
  const pagina = st.pagina || `https://github.com/${REPO}/releases/latest`;
  if (await tipoInstalacao() === 'normal' && ext.runtime.requestUpdateCheck) {
    const res = await ext.runtime.requestUpdateCheck().then((r) => (r && r.status) || r).catch(() => 'no_update');
    if (res === 'update_available') { setTimeout(() => ext.runtime.reload(), 1500); return { modo: 'loja' }; }
  }
  // por pasta (modo desenvolvedor): baixa o zip do Release; o guia ensina a extrair por cima da pasta
  if (st.zip && /^https:\/\/github\.com\//.test(st.zip)) {
    try { await ext.downloads.download({ url: st.zip, conflictAction: 'uniquify', saveAs: false }); } catch (_) { await ext.tabs.create({ url: pagina }); }
  } else await ext.tabs.create({ url: pagina });
  await salvarUpd({ baixadoEm: Date.now() });
  return { modo: 'download' };
}

const INTERVALO_MIN_MS = 10 * 60 * 1000;
async function procurarSeVelho() {
  const st = (await ext.storage.local.get(K.update))[K.update] || {};
  if (st.procuradoEm && Date.now() - st.procuradoEm < INTERVALO_MIN_MS && st.atual === versaoAtual()) return st;
  return procurar();
}
function abrirGuia(ancora) {
  const a = /^#[a-z]+$/.test(ancora || '') ? ancora : '';
  return ext.tabs.create({ url: ext.runtime.getURL('COMO-INSTALAR.html') + a }).then(() => ({ ok: true }));
}

ext.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== 'brasa:update') return;
  const run = msg.cmd === 'check' ? procurar() : msg.cmd === 'check-soft' ? procurarSeVelho() : msg.cmd === 'apply' ? aplicar() : msg.cmd === 'guide' ? abrirGuia(msg.data)
    : msg.cmd === 'diag' ? tipoInstalacao().then((instalacao) => ({ instalacao }))
    : Promise.resolve({});
  run.then((r) => sendResponse(r || {}), (e) => sendResponse({ erro: String((e && e.message) || e) }));
  return true;
});

// ───────────────────────── baixar (fase 3) ─────────────────────────
// A aba busca o vídeo (o CDN do TikTok só entrega com o Referer do site) e manda um endereço blob:/data:; fotos e capa vêm direto.
// Salva em Downloads/<pasta>/<autor>/… sem perguntar. Confere que o download não foi interrompido.
const ultimosNomes = []; // os nomes pedidos ao navegador (diagnóstico e testes)
globalThis.__brasaNomes = ultimosNomes;
async function salvarArquivos(itens) {
  const ids = [];
  for (const it of (itens || []).slice(0, 40)) {
    if (!it || typeof it.url !== 'string' || !/^(https:|blob:https:\/\/www\.tiktok\.com\/|data:(video|image)\/)/.test(it.url)) return { ok: false, erro: 'endereco' };
    const nome = String(it.nome || 'Brasa/arquivo').replace(/\.\.+/g, '.').replace(/^[\\/]+/, '');
    let id;
    try { id = await ext.downloads.download({ url: it.url, filename: nome, conflictAction: 'uniquify', saveAs: false }); } catch (e) { return { ok: false, erro: String(e && e.message || e) }; }
    ids.push(id);
    ultimosNomes.push(nome); if (ultimosNomes.length > 50) ultimosNomes.shift();
  }
  // espera sair do "in_progress" (até 30 s) para saber se o navegador aceitou
  const fim = Date.now() + 30000;
  while (Date.now() < fim) {
    const l = await ext.downloads.search({}).then((all) => all.filter((d) => ids.includes(d.id)));
    if (l.some((d) => d.state === 'interrupted')) return { ok: false, erro: (l.find((d) => d.state === 'interrupted') || {}).error || 'interrupted', ids };
    if (l.length === ids.length && l.every((d) => d.state === 'complete')) return { ok: true, ids, arquivos: l.map((d) => d.filename) };
    await new Promise((r) => setTimeout(r, 300));
  }
  return { ok: true, ids, lento: true };
}
ext.runtime.onMessage.addListener((msg, sender, responder) => {
  if (!msg || msg.type !== 'brasa:baixar' || !sender || !sender.tab) return;
  if (msg.cmd === 'arquivos') { salvarArquivos(msg.itens).then(responder, (e) => responder({ ok: false, erro: String(e) })); return true; }
});

// ───────────────────────── ícone da extensão ─────────────────────────
// Na aba do TikTok o ícone abre/fecha o menu da página (sem popup nessa aba); em qualquer outra aba abre o popup com o mesmo menu.
async function injetar(tabId) {
  await ext.scripting.executeScript({ target: { tabId }, files: MAIN_JS, world: 'MAIN', injectImmediately: true });
  await ext.scripting.executeScript({ target: { tabId }, files: CONTENT, injectImmediately: true });
}
function popupDaAba(tabId, url) {
  if (tabId == null) return;
  ext.action.setPopup({ tabId, popup: TT_RE.test(url || '') ? '' : 'popup/popup.html' }).catch(() => {});
}
ext.tabs.onUpdated.addListener((tabId, info, tab) => { if (info.url || info.status === 'loading' || info.status === 'complete') popupDaAba(tabId, tab.url); });
ext.tabs.onActivated.addListener(({ tabId }) => { ext.tabs.get(tabId).then((t) => popupDaAba(tabId, t.url), () => {}); });
async function popupEmTodas() { try { for (const t of await ext.tabs.query({})) popupDaAba(t.id, t.url); } catch (_) {} }
ext.action.onClicked.addListener(async (tab) => {
  if (!tab || !TT_RE.test(tab.url || '')) return;
  try { await ext.tabs.sendMessage(tab.id, { type: 'brasa:menu' }); return; } catch (_) {}
  try { await injetar(tab.id); await new Promise((r) => setTimeout(r, 500)); await ext.tabs.sendMessage(tab.id, { type: 'brasa:menu' }); } catch (_) {}
});

// ───────────────────────── selo no ícone: "!" urgente, "OFF" desligada, "↑" versão nova ─────────────────────────
async function selo() {
  try {
    const aj = (await ext.storage.local.get(K.aj))[K.aj] || {};
    const on = aj.on !== false;
    const u = (await ext.storage.local.get(K.update))[K.update] || {};
    const nova = u.disponivel && u.ultima && cmpVer(u.ultima, versaoAtual()) > 0;
    const txt = nova && u.urgente ? '!' : !on ? 'OFF' : nova ? '↑' : '';
    await ext.action.setBadgeText({ text: txt });
    await ext.action.setBadgeBackgroundColor({ color: nova ? '#fe2c55' : '#545454' });
    if (ext.action.setBadgeTextColor) await ext.action.setBadgeTextColor({ color: '#ffffff' }).catch(() => {});
  } catch (_) {}
}
ext.storage.onChanged.addListener((ch, area) => { if (area === 'local' && (ch[K.aj] || ch[K.update])) selo(); });

// ───────────────────────── versão nova na pasta (modo desenvolvedor) ─────────────────────────
// O navegador não deixa a extensão trocar os próprios arquivos. Quando a versão nova chega na pasta (zip extraído por cima, ou
// gravada pela IA com o manifest por último), a extensão percebe em até 1 min e se recarrega; depois se injeta em todas as abas
// abertas do TikTok, sem recarregar a página. Se o guarda-foguinho estiver enviando (br.envio), espera ele terminar.
let recargaPendente = null;
// v0.6.3: além da versão, a marca de entrega instalada/build.txt (gravada por ÚLTIMO, depois do manifest). Assim uma entrega
// que corrige arquivos sem trocar a versão também recarrega. A marca carregada fica no storage.session (zera a cada recarga).
const BUILD_K = 'br.build';
const lerBuild = async () => { try { const r = await fetch(ext.runtime.getURL('build.txt') + '?t=' + Date.now(), { cache: 'no-store' }); return r.ok ? (await r.text()).trim().slice(0, 80) : ''; } catch (_) { return ''; } };
async function buildCarregado() {
  try {
    const s = (await ext.storage.session.get(BUILD_K))[BUILD_K];
    if (s != null) return s;
    const b = await lerBuild(); await ext.storage.session.set({ [BUILD_K]: b }); return b;
  } catch (_) { return null; }
}
buildCarregado();
const anotarDisco = (o) => ext.storage.local.set({ [K.disco]: Object.assign({ em: Date.now(), rodando: versaoAtual() }, o) }).catch(() => {});
async function envioEmAndamento() {
  try { const e = (await ext.storage.local.get(K.envio))[K.envio]; return !!(e && e.ate && e.ate > Date.now()); } catch (_) { return false; }
}
async function conferirDisco() {
  if (await tipoInstalacao() !== 'development') return;
  try {
    const r = await fetch(ext.runtime.getURL('manifest.json') + '?t=' + Date.now(), { cache: 'no-store' });
    const versaoDisco = (await r.json()).version;
    const bDisco = await lerBuild(), bCarregado = await buildCarregado();
    const mudouBuild = !!bDisco && bCarregado != null && bDisco !== bCarregado;
    const noDisco = versaoDisco && (versaoDisco !== versaoAtual() || !mudouBuild ? versaoDisco : `${versaoDisco} (${bDisco})`);
    if (!noDisco || (versaoDisco === versaoAtual() && !mudouBuild) || recargaPendente === noDisco) { anotarDisco({ noDisco, estado: recargaPendente === noDisco ? 'recarregando' : 'igual' }); return; }
    if (await envioEmAndamento()) { anotarDisco({ noDisco, estado: 'esperando-envio' }); return; }
    anotarDisco({ noDisco, estado: 'recarregando' });
    DEF.logar('recarga', [noDisco]);
    recargaPendente = noDisco;
    setTimeout(async () => {
      if (await envioEmAndamento()) { recargaPendente = null; return; } // começou um envio nesse meio-tempo: tenta no próximo minuto
      ext.runtime.reload();
    }, 15000); // dá tempo de o resto dos arquivos terminar de chegar
  } catch (_) { /* manifest no meio da gravação: tenta no próximo minuto */ }
}
async function injetarNasAbas() {
  try {
    for (const t of await ext.tabs.query({ url: TT_TABS })) {
      if (t.discarded) continue;
      injetar(t.id).catch(() => {});
    }
  } catch (_) {}
}

const agendar = () => {
  ext.alarms.create('br-procura', { delayInMinutes: 1, periodInMinutes: 30 });
  ext.alarms.create('br-disco', { delayInMinutes: 1, periodInMinutes: 1 });
};
ext.alarms.onAlarm.addListener((a) => {
  if (a.name === 'br-procura') procurar();
  if (a.name === 'br-disco') conferirDisco();
});
ext.runtime.onStartup.addListener(() => { agendar(); procurar(); selo(); popupEmTodas(); });
ext.runtime.onInstalled.addListener(async (d) => {
  agendar();
  selo();
  popupEmTodas();
  // regra 12: instalação nova → tutorial na primeira abertura do TikTok; atualização → quadro de novidades
  try {
    const ob = (await ext.storage.local.get(K.onboard))[K.onboard];
    if (d.reason === 'install' && !ob) await ext.storage.local.set({ [K.onboard]: { tutorial: 'pendente', visto: versaoAtual() } });
    if (d.reason === 'update' && !ob) await ext.storage.local.set({ [K.onboard]: { tutorial: 'pulado', visto: d.previousVersion || '' } });
  } catch (_) {}
  if (d.reason === 'install') { DEF.logar('instalada', [versaoAtual()]); ext.tabs.create({ url: ext.runtime.getURL('COMO-INSTALAR.html#usar') }); }
  if (d.reason === 'update') {
    if (d.previousVersion && d.previousVersion !== versaoAtual()) DEF.logar('atualizada', [d.previousVersion, versaoAtual()]);
    await salvarUpd({ acabouDeAtualizar: { de: d.previousVersion || null, para: versaoAtual(), em: Date.now() }, disponivel: false, atual: versaoAtual() });
  }
  injetarNasAbas();
  procurar();
});
// o service worker pode dormir: garante os alarmes sempre que acordar
ext.alarms.get('br-disco').then((a) => { if (!a) agendar(); }, () => agendar());
