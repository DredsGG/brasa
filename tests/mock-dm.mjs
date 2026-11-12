// Mensagens do TikTok simuladas (fase 2), fiéis ao que foi medido no Chrome do André em 2026-11-11 (só leitura):
//  - lista [data-e2e="dm-new-conversation-list"] > [data-e2e="dm-new-conversation-item"] com id "more-action-icon-0:1:<uid>:<uid>",
//    apelido (dm-new-conversation-nickname > --SpanNicknameText2), prévia (--SpanInfoExtract) e hora (--SpanInfoTime); carrega mais ao rolar;
//  - conversa: [data-e2e="dm-new-message-list"] com separadores [dm-new-time-separator] ("18:50" hoje; "9 de novembro de 2026, 23:33"
//    nos outros dias), mensagens [dm-new-chat-item] > --DivMessageHorizontalContainer (row-reverse = minha), [dm-warning];
//    20 por leva, mais antigas ao rolar para o topo;
//  - editor contenteditable role=textbox dentro de [dm-new-input-editor]; [dm-new-send-btn] só existe com texto; Enter também envia;
//  - a URL fica /messages ao abrir conversa; pacote protobuf com StreakValue (42 dias) vindo de im-api-sg.tiktok.com por XHR.
// Tudo que a página faz (abrir, digitar, enviar) vai para /__mock/ev, que o teste lê.
import path from 'path'; import fs from 'fs'; import { createRequire } from 'module'; import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const DIR = path.dirname(fileURLToPath(import.meta.url));
const P = require(path.join(DIR, '..', fs.existsSync(path.join(DIR, '..', 'instalada')) ? 'instalada' : 'extension', 'src', 'proto.js'));

export const EU = '7111111111111111111';
const conv = (n) => `0:1:${EU}:7000000000000000${String(n).padStart(3, '0')}`;
// m: [diasAtras, eu?, texto]
const cv = (n, apelido, previa, msgs, extra) => Object.assign({ id: conv(n), apelido, previa, msgs }, extra || {});
export const CONVS = [
  cv(1, 'Ana', 'oi!', [[3, true, 'a'], [3, false, 'b'], [1, false, 'ontem dela'], [1, true, 'ontem minha'], [0, false, 'hoje dela']]),
  cv(2, 'Bia', 'Você: já mandei', [[1, false, 'x'], [1, true, 'y'], [0, true, 'já mandei hoje']]),
  cv(3, 'Caio', 'sumido', [[4, true, 'velha'], [4, false, 'velha 2'], [0, false, 'apareceu hoje']]),
  cv(4, 'Duda', 'Sequência perdida', [[2, true, 'p'], [1, null, 'Sequência de 12 dias perdidos. Restaurar']]),
  cv(5, 'Enzo', 'não marcado', [[1, true, 'e1'], [1, false, 'e2']]),
  cv(6, 'Fabi', 'conversa longa', [[2, true, 'f'], [1, false, 'ontem'], ...Array.from({ length: 32 }, (_, i) => [0, false, 'hoje dela ' + i])]),
  cv(7, 'Hugo', 'provável', [[3, true, 'h'], [3, false, 'h'], [2, true, 'h'], [2, false, 'h'], [1, true, 'h'], [1, false, 'h']]),
  cv(8, 'Iris', 'falha no envio', [[1, false, 'i'], [1, true, 'i2']], { falha: true }),
  // grupos (medido 2026-11-11): id só número (19 dígitos), cabeçalho --DivChatHeader com "N membros" (--PGroupSize),
  // mensagem dos outros com o nome de quem mandou (--PNickname). m[3] = quem mandou.
  { id: '7300000000000000001', grupo: 4, apelido: 'Turma do Fogo', previa: 'Caio: bom dia', msgs: [[2, true, 'g'], [1, false, 'oi grupo', 'Ana'], [1, true, 'oi'], [0, false, 'bom dia', 'Caio']] },
  { id: '7300000000000000002', grupo: 3, apelido: 'Grupo parado', previa: 'Bia: alguém?', msgs: [[5, false, 'alguém?', 'Bia']] },
  ...Array.from({ length: 22 }, (_, i) => cv(20 + i, 'Pessoa ' + (i + 1), 'oi', [[5, false, 'oi']])),
  cv(9, 'Gabi', 'lá embaixo', [[1, false, 'g'], [1, true, 'g2']]),
  cv(10, 'Lia', 'envio não sai', [[1, false, 'l'], [1, true, 'oi de sempre']], { naoEnvia: true }),
  cv(11, 'Mia', 'tem rascunho', [[1, false, 'm'], [1, true, 'm2']], { rascunho: 'meu rascunho' }),
];
export const CONV = Object.fromEntries(CONVS.map((c) => [c.apelido, c.id]));

// pacote protobuf (StreakCommandMessage > StreakValue) da conversa da Ana: 42 dias
export function pacoteSequencia() {
  const user = (uid, ts) => P.codificar([[1, 0, BigInt(uid)], [2, 0, ts]]);
  const now = Math.floor(Date.now() / 1000);
  const sv = P.codificar([[1, 2, user(EU, now - 3600)], [1, 2, user('7000000000000000001', now - 7200)], [2, 0, now - 42 * 86400], [3, 0, 42], [4, 2, 'America/Sao_Paulo'], [5, 0, now + 86400], [100, 0, 1], [101, 2, CONV.Ana]]);
  return Buffer.from(P.codificar([[1, 0, 100001], [5, 2, P.codificar([[8, 2, P.codificar([[1, 0, 3], [2, 2, sv]])]])]]));
}

export function dmHtml(q) {
  const theme = q.get('theme') || 'dark';
  return `<!doctype html><html lang="pt-BR" data-theme="${theme}"><head><meta charset="utf-8"><title>Mensagens | TikTok (simulado)</title>
<style>
html,body{margin:0;background:${theme === 'dark' ? '#000' : '#fff'};color:${theme === 'dark' ? '#fff' : '#161823'};font-family:Arial,sans-serif}
.side{position:fixed;left:0;top:0;bottom:0;width:72px}
.wrap{position:fixed;left:72px;right:0;top:0;bottom:0;display:flex}
.lst{width:320px;overflow-y:auto;height:100%}
.it{display:flex;gap:8px;padding:8px;cursor:pointer}.it[aria-selected="true"]{background:#333}
.it img{width:40px;height:40px;border-radius:20px}
.box{flex:1;display:flex;flex-direction:column;height:100%}
.rol{flex:1;overflow-y:auto}
.sep{text-align:center;font-size:12px;opacity:.7;margin:8px}
.ci{padding:4px 12px}.hz{display:flex;gap:8px;align-items:center}
.ed{min-height:36px;border:1px solid #555;margin:8px;padding:6px}
</style></head><body>
<div class="side"><h2><a data-e2e="nav-foryou" href="/"><button class="TUXButton TUXButton--secondary" type="button"><div class="TUXButton-content"><div class="TUXButton-iconContainer"><svg width="24" height="24"></svg></div><div class="TUXButton-label">Para você</div></div></button></a></h2>
<div class="TUXTooltip-reference"><button class="TUXButton TUXButton--secondary" type="button" data-e2e="nav-more-menu"><div class="TUXButton-content"><div class="TUXButton-iconContainer"><svg width="24" height="24"></svg></div><div class="TUXButton-label">Mais</div></div></button></div></div>
<div class="wrap">
  <div class="lst css-l1-7937d88b--DivScrollWrapper" id="lst"><div data-e2e="dm-new-conversation-list" class="css-l2-7937d88b--DivConversationListContainer" id="lista"></div></div>
  <div data-e2e="dm-new-chatbox" class="box" id="box"></div>
</div>
<script>
(() => {
  const CONVS = ${JSON.stringify(CONVS)};
  const ev = (o) => fetch('/__mock/ev', { method: 'POST', body: JSON.stringify(Object.assign({ guarda: location.hash.includes('brasa-guarda') }, o)) });
  const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const quando = (dAtras, i) => { const d = new Date(); d.setDate(d.getDate() - dAtras); d.setHours(dAtras === 0 ? Math.max(0, new Date().getHours() - 1) : 10, i % 60, 0, 0); return d; };
  const rotulo = (d, dAtras) => { const hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); return dAtras === 0 ? hm : d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear() + ', ' + hm; };
  const lista = document.getElementById('lista'), box = document.getElementById('box');
  let nLista = 0, aberta = null, mostradas = 0;
  function item(c) {
    const it = document.createElement('div');
    it.setAttribute('data-e2e', 'dm-new-conversation-item'); it.className = 'it css-i-7937d88b--DivItemWrapper'; it.id = 'more-action-icon-' + c.id; it.tabIndex = 0; it.setAttribute('aria-selected', 'false');
    it.innerHTML = '<div class="css-a-7937d88b--DivItemInfo"><div data-e2e="dm-new-conversation-avatar" class="css-b-7937d88b--DivInfoAvatarWrapper"><span class="css-c-7937d88b--SpanAvatarContainer"><img class="css-d-7937d88b--ImgAvatar" src="/media/capa.png"></span></div>'
      + '<div class="css-e-7937d88b--DivInfoTextWrapper"><p data-e2e="dm-new-conversation-nickname" class="css-f-7937d88b--PInfoNickname2"><span class="css-g-7937d88b--SpanNicknameText2">' + c.apelido + '</span></p>'
      + '<p class="css-h-7937d88b--PInfoExtractTime"><span class="css-i-7937d88b--SpanInfoExtract">' + c.previa + '</span><span class="css-j-7937d88b--SpanInfoTime">18:50</span></p></div></div>';
    it.addEventListener('click', () => abrir(c, it));
    return it;
  }
  function maisLista() { const fim = Math.min(CONVS.length, nLista + 25); for (; nLista < fim; nLista++) lista.appendChild(item(CONVS[nLista])); }
  maisLista();
  document.getElementById('lst').addEventListener('scroll', (e) => { const s = e.target; if (s.scrollTop + s.clientHeight >= s.scrollHeight - 5) setTimeout(maisLista, 300); });
  function msgEl(m, i) {
    const d = document.createElement('div');
    if (m[1] === null) { d.className = 'sep css-s-7937d88b--DivSystemMessage'; d.textContent = m[2]; return d; }
    d.setAttribute('data-e2e', 'dm-new-chat-item'); d.className = 'ci css-k-7937d88b--DivChatItemWrapper';
    d.innerHTML = '<div class="css-v-7937d88b--DivMessageVerticalContainer"><div class="hz css-w-7937d88b--DivMessageHorizontalContainer" style="flex-direction:' + (m[1] ? 'row-reverse' : 'row') + '">'
      + '<a><span data-e2e="chat-avatar"></span></a><div>' + (m[3] && !m[1] ? '<p class="css-pn-7937d88b--PNickname">' + m[3] + '</p>' : '') + '<div data-e2e="dm-new-message-text" class="css-t-7937d88b--DivTextContainer"><p class="css-p-7937d88b--PText"></p></div></div><div data-e2e="dm-warning"></div></div></div>';
    d.querySelector('p').textContent = m[2];
    if (m.falha) d.querySelector('[data-e2e="dm-warning"]').textContent = 'Falha no envio. Toque para tentar de novo.';
    return d;
  }
  function desenhar() {
    const ml = document.getElementById('ml'); ml.innerHTML = '';
    const ms = aberta.msgs.slice(-mostradas);
    let ultimoDia = null;
    ms.forEach((m, i) => {
      if (m[0] !== ultimoDia) { ultimoDia = m[0]; const s = document.createElement('div'); s.setAttribute('data-e2e', 'dm-new-time-separator'); s.className = 'sep'; s.textContent = rotulo(quando(m[0], i), m[0]); ml.appendChild(s); }
      ml.appendChild(msgEl(m, i));
    });
  }
  function abrir(c, it) {
    lista.querySelectorAll('[aria-selected="true"]').forEach((x) => x.setAttribute('aria-selected', 'false'));
    it.setAttribute('aria-selected', 'true');
    if (box.innerHTML) { setTimeout(() => montar(c), 700); return; }
    montar(c);
  }
  function montar(c) {
    ev({ t: 'abriu', conv: c.id });
    aberta = c; mostradas = Math.min(20, c.msgs.length);
    box.innerHTML = (c.grupo ? '<div class="css-h-7937d88b--DivChatHeader"><span data-e2e="top-chat-avatar"></span><div class="css-nc-7937d88b--DivNameContainer"><p class="css-n-7937d88b--PNickname" data-e2e="dm-new-chat-nickname">' + c.apelido + '</p><p class="css-gs-7937d88b--PGroupSize">' + c.grupo + ' membros</p></div></div>'
      : '<div data-e2e="dm-new-conversation-header"><p class="css-n-7937d88b--PNickname" data-e2e="dm-new-chat-nickname">' + c.apelido + '</p></div>')
      + '<div class="rol" id="rol"><div data-e2e="dm-new-message-list" class="css-m-7937d88b--DivChatMain" id="ml"></div></div>'
      + '<div data-e2e="dm-new-chat-bottom"><div data-e2e="message-input-area" id="area"><div data-e2e="dm-new-input-editor" class="css-q-7937d88b--DivEditorContainer"><div class="DraftEditor-root"><div class="ed notranslate public-DraftEditor-content" contenteditable="true" role="textbox" aria-label="Enviar uma mensagem..." id="ed"></div></div></div></div></div>';
    desenhar();
    if (c.rascunho) { document.getElementById('ed').textContent = c.rascunho; setTimeout(() => document.getElementById('ed').dispatchEvent(new Event('input')), 0); }
    const rol = document.getElementById('rol'); rol.scrollTop = rol.scrollHeight;
    rol.addEventListener('scroll', () => { if (rol.scrollTop <= 2 && mostradas < aberta.msgs.length) setTimeout(() => { const h = rol.scrollHeight; mostradas = Math.min(aberta.msgs.length, mostradas + 20); desenhar(); rol.scrollTop = rol.scrollHeight - h; }, 300); });
    const ed = document.getElementById('ed'), area = document.getElementById('area');
    const atual = () => ed.textContent.trim();
    const botao = () => { let b = document.querySelector('[data-e2e="dm-new-send-btn"]'); if (atual() && !b) { b = document.createElement('div'); b.setAttribute('data-e2e', 'dm-new-send-btn'); b.setAttribute('role', 'button'); b.textContent = 'Enviar'; b.addEventListener('click', enviar); area.appendChild(b); } if (!atual() && b) b.remove(); };
    ed.addEventListener('input', () => { if (atual()) ev({ t: 'digitou', conv: c.id, texto: atual() }); else ev({ t: 'limpou', conv: c.id }); botao(); });
    ed.addEventListener('paste', (e) => { e.preventDefault(); ed.textContent += e.clipboardData.getData('text/plain'); ed.dispatchEvent(new Event('input')); });
    ed.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } });
    function enviar() {
      const t = atual(); if (!t) return;
      if (c.naoEnvia) { ev({ t: 'naoSaiu', conv: c.id, texto: t }); return; } // o envio não sai (rede, botão que não responde)
      const m = [0, true, t]; if (c.falha) m.falha = true;
      c.msgs.push(m); mostradas++;
      ev({ t: 'enviou', conv: c.id, texto: t });
      ed.textContent = ''; botao();
      setTimeout(() => { desenhar(); rol.scrollTop = rol.scrollHeight; }, 400);
    }
  }
  // pacote binário das DMs (como o get_by_conversation do site): traz a sequência da Ana
  const x = new XMLHttpRequest(); x.open('POST', 'https://im-api-sg.tiktok.com/v1/message/get_by_conversation'); x.responseType = 'arraybuffer'; x.send(new Uint8Array([8, 1]));
  window.__dm = { CONVS };
})();
</script></body></html>`;
}
