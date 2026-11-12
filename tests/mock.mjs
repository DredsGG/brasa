// TikTok simulado para os testes da Brasa, fiel ao que foi medido ao vivo em 2026-11-11 (sem login, perfil novo):
//  - <html data-theme="light|dark" data-tux-color-scheme>, barra lateral com os itens <h2><a data-e2e="nav-…"><button class="TUXButton …">
//    (Para você, Explorar, Seguindo, Novelas, LIVE, Carregar, Perfil) e o "Mais" em <div class="TUXTooltip-reference"><button data-e2e="nav-more-menu">;
//  - feed: <article data-e2e="recommend-list-item-container" id="one-column-item-N"> com <div id="xgwrapper-N-<id>"> e o <video>,
//    barra do player [data-e2e="anchoring-playback-chrome"], setas [data-e2e="feed-navigation-prev|next"];
//  - rede: /api/recommend/item_list/ por fetch e /api/preload/item_list/ por XHR (respostas de testes/fixtures/feed.json),
//    /api/following/item_list/ ao ir para Seguindo (/api/friends/item_list/ para Amigos); navegação interna por history.pushState, como o site.
// Parâmetros da URL do mock: theme=dark|light · nosidebar=1 (sem barra lateral, para o plano B) · xhrjson=1 (preload com responseType json)
//   login=1 (barra lateral de quem está logado: Mensagens, Amigos, Atividade, Loja — nomes do código do site) · planob=1 (feed por uma rota
//   que o filtro não pega, com os marcadores de anúncio no DOM) · banner=1 (janela flutuante de LIVE na página)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dmHtml, pacoteSequencia } from './mock-dm.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const VIDEO = fs.readFileSync(path.join(DIR, 'media', 'clip.webm'));
export const FEED = JSON.parse(fs.readFileSync(path.join(DIR, 'fixtures', 'feed.json'), 'utf8'));
// PNG 1×1 para capa e fotos
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

const ic = '<svg width="1em" height="1em" viewBox="0 0 48 48" fill="currentColor"><circle cx="24" cy="24" r="16"/></svg>';
const navBtn = (e2e, label, href, tag = 'h2') => {
  const btn = `<button class="TUXButton TUXButton--default TUXButton--medium TUXButton--secondary css-1t1gyuu-StyledTUXNavButton e1o9pl7m0" aria-disabled="false" type="button" data-key-interaction="nav_${e2e}" aria-label="${label}" role="listitem"><div class="TUXButton-content"><div class="TUXButton-iconContainer"><div class="css-a3bobw-DivIconWithRedDotContainer" style="font-size:32px">${ic}<div class="css-g9v39k-DivRedDotContainer"></div></div></div><div class="TUXButton-label">${label}</div></div></button>`;
  return `<${tag}><a data-e2e="nav-${e2e}" tabindex="-1" class="link-a11y-focus" href="${href}" data-discover="true">${btn}</a></${tag}>`;
};

// layout medido em 2026-11-12 no Seguindo, perfil, busca e hashtag: cada item da barra num <div TUXTooltip-reference> em vez
// de <h2>; e o React do site tira o que for colocado dentro desse <div> (?barra=tooltip)
export function tiktokHtml(q, caminho) {
  let h = tiktokHtml0(q, caminho);
  if (q.get('barra') === 'tooltip') {
    h = h.replace(/<h2><a data-e2e="nav-/g, '<div class="TUXTooltip-reference css-q-7937d88b--StyledTUXTooltip"><a data-e2e="nav-').replace(/<\/a><\/h2>/g, '</a></div>');
    h = h.replace('</body>', `<script>setInterval(() => { for (const w of document.querySelectorAll('#navc > .TUXTooltip-reference')) for (const c of [...w.children]) if (!c.matches('a[data-e2e], button[data-e2e]')) { c.remove(); window.__removidosPeloSite = (window.__removidosPeloSite || 0) + 1; } }, 300);</script></body>`);
  }
  return h;
}
function tiktokHtml0(q, caminho) {
  const theme = q.get('theme') || 'light', semBarra = q.get('nosidebar') === '1';
  const dark = theme === 'dark';
  return `<!doctype html><html lang="pt-BR" data-theme="${theme}" data-tux-color-scheme="${theme}" dir="ltr"><head><meta charset="utf-8"><title>TikTok (simulado)</title>
<style>
:root{--tux-colorPrimary:${dark ? '#ff3b5c' : '#fe2c55'};--tux-colorTextPrimary:${dark ? '#ffffffe6' : '#161823'}}
html,body{margin:0;background:${dark ? '#000' : '#fff'};color:${dark ? 'rgba(255,255,255,.9)' : '#161823'};font-family:TikTokFont,Arial,Tahoma,sans-serif}
.side{position:fixed;left:0;top:0;bottom:0;width:240px;padding:16px;box-sizing:border-box}
.navc{display:flex;flex-direction:column;gap:4px;margin-top:40px}
.navc h2{margin:0;font-size:21px}
.TUXButton{display:flex;align-items:center;width:208px;height:40px;border:0;background:transparent;color:inherit;font:500 16px/21px TikTokFont,Arial,sans-serif;cursor:pointer;border-radius:4px;padding:0 8px}
.TUXButton:hover{background:${dark ? 'rgba(255,255,255,.08)' : 'rgba(22,24,35,.06)'}}
.TUXButton-content{display:flex;align-items:center;gap:12px}.TUXButton-iconContainer{display:flex}
.side.recolhida .TUXButton-label{display:none}.side.recolhida .TUXButton{width:48px}
a[aria-current] .TUXButton-label{color:var(--tux-colorPrimary)}
.col{margin-left:256px;height:100vh;overflow-y:auto;scroll-snap-type:y mandatory}
article{height:100vh;position:relative;scroll-snap-align:start;display:flex;justify-content:center;align-items:center}
article video{height:86vh;aspect-ratio:9/16;background:#000;border-radius:16px}
article [data-e2e="video-desc"]{position:absolute;left:24px;bottom:80px;max-width:300px}
.chrome{position:absolute;left:0;right:0;bottom:0;height:64px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;box-sizing:border-box}
.chrome .grp{display:flex;align-items:center;gap:8px}.chrome button{background:none;border:0;color:#fff;cursor:pointer;height:40px;min-width:40px}
.setas{position:fixed;right:24px;top:40%;display:flex;flex-direction:column;gap:16px}
body.coment .col{margin-right:384px} body.coment .setas{right:408px}
.setas button{width:40px;height:40px;border-radius:20px;border:0;background:${dark ? '#2e2e2e' : '#f1f1f2'};cursor:pointer}
</style></head><body>
<div id="app">
${semBarra ? '' : `<div class="side" id="side"><a data-e2e="tiktok-logo" href="/">TikTok</a>
  <div class="navc" id="navc">
    ${navBtn('foryou', 'Para você', '/')}${navBtn('explore', 'Explorar', '/explore')}${navBtn('following', 'Seguindo', '/following')}${navBtn('short-drama', 'Novelas', '/shortdrama')}${navBtn('live', 'LIVE', '/live')}
    ${q.get('login') === '1' ? navBtn('friends', 'Amigos', '/friends') + navBtn('activity', 'Atividade', '/activity') + navBtn('messages', 'Mensagens', '/messages') + navBtn('shop', 'Loja', 'https://shop.tiktok.com') : ''}
    ${navBtn('upload', 'Carregar', '/tiktokstudio/upload?from=webapp&tab=video', 'div')}${navBtn('profile', 'Perfil', '/@')}
    <div class="TUXTooltip-reference css-1r5snri-StyledTUXTooltip e1o9pl7m1"><button class="TUXButton TUXButton--default TUXButton--medium TUXButton--secondary css-1t1gyuu-StyledTUXNavButton e1o9pl7m0" aria-disabled="false" type="button" data-e2e="nav-more-menu" data-key-interaction="nav_more" aria-label="Mais" role="listitem" aria-pressed="false"><div class="TUXButton-content"><div class="TUXButton-iconContainer"><div class="css-a3bobw-DivIconWithRedDotContainer"><div class="TUXAlertBadgeDot-reference">${ic}<div class="TUXAlertBadgeDot TUXAlertBadgeDot--small"></div></div><div class="css-g9v39k-DivRedDotContainer"></div></div></div><div class="TUXButton-label">Mais</div></div></button></div>
  </div>
  ${q.get('login') === '1' ? '<div data-e2e="profile-icon" aria-label="Abrir o menu de configurações" aria-haspopup="true" style="display:none"></div>'
    : '<button id="header-login-button" class="css-l-7937d88b--StyledLeftSidePrimaryButtonRedesign" style="margin-top:16px;width:208px;height:40px;border:0;border-radius:4px;background:#fe2c55;color:#fff;font-weight:700">Entrar</button>'}
  <div data-e2e="side-nav-utilities" style="position:absolute;bottom:16px">Obter app</div></div>`}
<main class="col" id="col"></main>
<div class="css-q-7937d88b--DivAutoScrollButtonContainer e1vta1sk0" id="autott-canto" style="position:fixed;right:66px;bottom:20px;width:40px;height:40px;background:#444">A</div>
<div id="opcoes" style="position:fixed;left:260px;top:4px;font-size:10px;background:#222;color:#fff"><div class="row" id="opc-auto"><div><span data-e2e="auto-scroll">↻</span></div><span>Rolagem automática</span></div><div class="row" id="opc-outro"><div><span data-e2e="report-icone">!</span></div><span>Denunciar</span></div><div data-e2e="more-menu-popover_autoscroll" id="mm-auto">Rolagem automática</div></div>
${q.get('banner') === '1' ? '<div class="css-9x-7937d88b--DivLiveFloatWrapper e1" id="banner-live" style="position:fixed;right:80px;bottom:20px;width:200px;height:120px;background:#333;color:#fff">LIVE flutuante</div>' : ''}
<div class="css-c0-7937d88b--DivCommentSidebarTransitionWrapper" id="comentarios" style="display:none;position:fixed;right:0;top:0;bottom:0;width:384px;background:#222;color:#fff"><button type="button" aria-label="exit" id="coment-x" style="position:absolute;right:32px;top:32px;width:28px;height:28px">×</button><section class="css-c1-7937d88b--SectionCommentSidebarContainer" style="height:100%">comentários</section></div>
<div class="css-rp-7937d88b--RightPanelContainer" id="painel-video" style="display:none;position:fixed;right:0;top:0;bottom:0;width:400px;background:${dark ? '#121212' : '#fff'};color:${dark ? '#fff' : '#000'}">
  <div data-testid="tux-web-tab-bar" style="display:flex;gap:24px;padding:36px 16px 0"><div class="tux-web-canary tux-interaction-container__ohUjRG_v1_8_0" data-testid="tux-web-tab-bar-container" style="height:40px"><button type="button" class="tux-button__element__ZBq38f_v1_8_0" data-testid="tux-web-tab-bar" id="aba-coment">Comentários</button></div><div class="tux-web-canary tux-interaction-container__ohUjRG_v1_8_0" data-testid="tux-web-tab-bar-container" style="height:40px"><button type="button" class="tux-button__element__ZBq38f_v1_8_0" data-testid="tux-web-tab-bar" id="aba-rel">Você pode gostar</button></div></div>
  <div class="css-tc-7937d88b--DivTabContainer" id="pv-coment" style="display:none"><div class="css-cm-7937d88b--DivCommentMain"><div class="css-cl-7937d88b--DivCommentListContainer"><div data-e2e="comment-level-1">um comentário</div></div></div></div>
  <div class="css-rt-7937d88b--DivRelatedTabContainer" id="pv-rel" style="height:600px">grade de vídeos sugeridos</div></div>
<div id="navegador" style="display:none;position:fixed;inset:0;background:#000;color:#fff;z-index:50">
  <button type="button" data-e2e="browse-close" role="button" aria-label="Fechar" style="position:absolute;left:20px;top:20px;width:40px;height:40px;z-index:3">X</button>
  <div id="nv-videos" style="position:absolute;left:0;top:0;width:822px;height:100%;overflow:hidden"></div>
  <div class="css-sw-7937d88b--DivVideoSwitchWrapper" style="position:absolute;left:762px;top:378px;width:40px;height:96px;overflow:hidden;border-radius:100px;display:flex;flex-direction:column;gap:16px;z-index:2"><!-- medido no código do site: 36x80, overflow hidden -->
    <button type="button" data-e2e="arrow-left" role="button" aria-label="Ir para o vídeo anterior" style="width:40px;height:40px">^</button>
    <button type="button" data-e2e="arrow-right" role="button" aria-label="Ir para o próximo vídeo" style="width:40px;height:40px">v</button>
  </div>
  <div id="nv-info" style="position:absolute;left:858px;top:20px;right:20px">
    <div style="display:flex;gap:12px;align-items:center"><span data-e2e="browse-username" id="nv-user"></span><div data-e2e="browse-follow" class="css-bw-7937d88b--DivBtnWrapper" id="nv-follow"></div></div>
    <div style="display:flex;gap:16px;margin-top:40px"><div role="button" tabindex="0" aria-pressed="false" id="nv-like" class="css-lk-7937d88b--ButtonActionItem"><span data-e2e="browse-like-icon" class="css-li-7937d88b--SpanIconWrapper" style="display:inline-block;width:32px;height:32px;background:#444">L</span><strong data-e2e="browse-like-count">12K</strong></div>
      <div><span data-e2e="browse-comment-icon" class="css-ci-7937d88b--SpanIconWrapper" style="display:inline-block;width:32px;height:32px;background:#444">C</span></div></div>
    <div class="css-cl-7937d88b--DivCommentListContainer" style="margin-top:20px;height:400px">comentários</div>
  </div>
</div>
<div class="setas"><button data-e2e="feed-navigation-prev" aria-label="Ir para o vídeo anterior">▲</button><button data-e2e="feed-navigation-next" aria-label="Ir para o próximo vídeo">▼</button></div>
</div>
<script>
(() => {
  const M = window.__mock = { cliquesComent: 0, cliquesPagina: 0, teclas: 0, proximos: 0, renderizados: [], respostas: [], curtidas: [], descurtidas: [], seguiu: [], deixou: [], autoTT: [] };
  window.__autoTT = ${q.get('autott') === '1'};
  // conta (medido 2026-11-12): logado = "Mais" abre um painel com [data-e2e=see-more-popup] e o Sair [data-e2e=logout-entrance];
  // deslogado = botão #header-login-button abre o quadro "Entrar no TikTok". ?confirmar=1 = experimento confirm_logout do site.
  const evm = (o) => fetch('/__mock/ev', { method: 'POST', body: JSON.stringify(Object.assign({ mock: 'conta' }, o)), keepalive: true }).catch(() => {});
  const maisBtn = document.querySelector('[data-e2e="nav-more-menu"]');
  let maisPainel = null;
  if (maisBtn) maisBtn.addEventListener('click', () => {
    if (maisPainel) { maisPainel.remove(); maisPainel = null; return; }
    evm({ t: 'abriuMais' });
    maisPainel = document.createElement('div'); maisPainel.className = 'css-mp-7937d88b--DivMoreMenuContainer';
    maisPainel.style.cssText = 'position:fixed;left:240px;bottom:40px;width:280px;background:#2a2a2a;color:#fff;padding:8px;border-radius:8px;z-index:50';
    maisPainel.innerHTML = '<ul data-e2e="see-more-popup" role="listbox"><li><button role="listitem">Gerais</button></li></ul>'
      + (${q.get('login') === '1'} ? '<ul data-e2e="see-more-popup" role="listbox"><li><button role="listitem">Central de Ajuda</button></li><li><button data-e2e="logout-entrance" role="listbox">Sair</button></li></ul>' : '');
    document.body.appendChild(maisPainel);
    const sair = maisPainel.querySelector('[data-e2e="logout-entrance"]');
    if (sair) sair.addEventListener('click', async () => {
      const op = getComputedStyle(maisPainel).opacity;
      await evm({ t: 'clicouSair', opacidadeMais: op });
      maisPainel.remove(); maisPainel = null;
      const sairDeVez = async () => { await evm({ t: 'saiu' }); const u = new URL(location.href); u.searchParams.delete('login'); location.href = u.href; };
      if (${q.get('confirmar') === '1'}) {
        const d = document.createElement('div'); d.className = 'css-cf-7937d88b--DivModalContainer'; d.setAttribute('role', 'dialog'); d.id = 'confirma-sair-quadro';
        d.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:60';
        d.innerHTML = '<div style="background:#222;color:#fff;padding:24px;border-radius:8px">Tem certeza de que deseja sair?<br><button id="cancela-sair">Cancelar</button><button id="confirma-sair">Sair</button></div>';
        document.body.appendChild(d);
        d.querySelector('#confirma-sair').addEventListener('click', sairDeVez);
        d.querySelector('#cancela-sair').addEventListener('click', () => d.remove());
      } else sairDeVez();
    });
  });
  const entrarBtn = document.getElementById('header-login-button');
  if (entrarBtn) entrarBtn.addEventListener('click', () => {
    evm({ t: 'abriuEntrar' });
    const d = document.createElement('div'); d.className = 'css-md-7937d88b--DivModalContainer'; d.id = 'quadro-entrar';
    d.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:60';
    d.innerHTML = '<div style="background:#222;color:#fff;padding:24px;border-radius:8px"><h2>Entrar no TikTok</h2><button>Usar código QR</button><button>Usar telefone ou e-mail</button></div>';
    document.body.appendChild(d);
  });
  document.addEventListener('click', (e) => { if (e.isTrusted || e.detail >= 0) M.cliquesPagina++; });
  document.addEventListener('keydown', (e) => { M.teclas++; if (e.key === 'ArrowDown') proximo(); });
  const col = document.getElementById('col');
  let n = 0;
  function render(itens) {
    for (const it of itens) {
      const i = n++;
      const a = document.createElement('article');
      a.id = 'one-column-item-' + i; a.dataset.scrollIndex = i; a.setAttribute('shape', 'vertical'); if (${q.get('artigo') !== 'sem'}) a.dataset.e2e = 'recommend-list-item-container'; // ?artigo=sem: feed sem esse contêiner (plano B dos comentários)
      a.className = 'css-evcxon-ArticleItemContainer e1lr75930';
      const foto = !!it.imagePost;
      a.innerHTML = '<section data-e2e="feed-video" aria-label="Assistir em tela cheia"><div id="xgwrapper-' + i + '-' + it.id + '" class="xgplayer-container tiktok-web-player">'
        + (foto ? '<img src="' + it.imagePost.images[0].imageURL.urlList[0] + '" style="height:86vh;aspect-ratio:9/16"><div data-e2e="anchoring-photo-control">1/' + it.imagePost.images.length + '</div>'
          : '<video data-version="0.5.1" preload="" crossorigin="anonymous" src="' + (it.video && it.video.playAddr || '/media/clip.webm') + '" playsinline muted ' + (i === 0 ? 'autoplay' : '') + '></video>') + '</div></section>'
        + '<div data-e2e="anchoring-playback-chrome" data-tux-color-scheme="dark" class="chrome"><div class="grp"><button type="button" data-e2e="anchoring-playback-control-play" aria-label="Pausar">II</button><span data-e2e="anchoring-playback-time">00:00</span></div>'
        + '<div class="grp"><div data-e2e="cinema-playback-control-speed"><button type="button" aria-label="Velocidade 1.0x">1.0x</button></div><button type="button" data-e2e="cinema-playback-control-captions" aria-label="Legendas">CC</button><div data-e2e="cinema-playback-control-volume"><button type="button" aria-label="Volume">V</button></div><button type="button" data-e2e="more-menu-icon" aria-label="Mais">…</button>'
          + '<div data-e2e="cinema-playback-control-autoscroll" data-cinema-playback-control="autoscroll" data-cinema-playback-measure="autoscroll-control" class="autott"><label>Rolagem automática</label><input type="checkbox" role="switch" name="cinema-mode-autoscroll" value="cinema-mode-autoscroll"' + (window.__autoTT ? ' checked' : '') + '></div></div></div>'
        + '<div data-e2e="anchoring-engagement-vertical" class="css-v1-7937d88b--DivVerticalEngagement" style="position:absolute;right:20px;bottom:72px;display:flex">'
        + '<section class="css-s1-7937d88b--SectionActionBarContainer" style="display:flex;flex-direction:column;gap:10px;align-items:center;color:#fff;font:700 12px Arial">'
        + ['like', 'comment', 'favorite', 'share'].map((k) => '<div class="css-a-7937d88b--DivActionItemAvailability"><div ' + (k === 'like' ? 'role="button" tabindex="0" aria-label="Curtir vídeo" aria-pressed="' + !!it.digged + '" ' : '') + 'data-e2e="' + k + '-icon" class="css-b-7937d88b--ButtonActionItemV1" style="display:flex;flex-direction:column;align-items:center"><span style="width:20px;height:20px;background:#fff;border-radius:4px;display:block"></span><strong data-e2e="' + k + '-count">12K</strong></div></div>').join('')
        + '</section></div>'
        + (it.author && (it.author.relation === 0 || ${q.get('seguindoVisivel') === '1'}) ? '<div class="css-f-7937d88b--DivCreatorFollow"><button type="button" data-e2e="cinema-video-info-follow" data-autor="' + it.author.uniqueId + '" aria-label="' + (it.author.relation === 0 ? 'Seguir' : 'Seguindo') + '">' + (it.author.relation === 0 ? 'Seguir' : 'Seguindo') + '</button></div>' : '')
        + '<div data-e2e="video-desc">' + String(it.desc || '').replace(/</g, '&lt;') + '</div>'
        + (it.isAd ? '<div data-e2e="sponsored-tag">Patrocinado</div>' : '') + (it.containerType === 2 ? '<div data-e2e="anchoring-live-frame">LIVE</div>' : '');
      if (${q.get('coluna') === 'unica'}) a.querySelector('[data-e2e="anchoring-engagement-vertical"]').remove(); // layout medido: uma coluna só, fora do vídeo
      else a.querySelector('[data-e2e="comment-icon"]').addEventListener('click', () => { M.cliquesComent++; window.__comentarios(!comAberto); });
      // coração (como o site: alterna; aria-pressed é o estado) e "Seguir" (vira "Seguindo" e some depois de 3 s; clicar em "Seguindo" deixa de seguir)
      const li = a.querySelector('[data-e2e="like-icon"]');
      if (li) li.addEventListener('click', () => { const on = li.getAttribute('aria-pressed') === 'true'; if (on) M.descurtidas.push(it.id); else M.curtidas.push(it.id); li.setAttribute('aria-pressed', String(!on)); });
      const fb = a.querySelector('[data-e2e="cinema-video-info-follow"]');
      if (fb) fb.addEventListener('click', () => {
        const au = fb.dataset.autor, seguia = fb.getAttribute('aria-label') !== 'Seguir';
        if (seguia) { M.deixou.push(au); return; }
        M.seguiu.push(au);
        document.querySelectorAll('[data-e2e="cinema-video-info-follow"][data-autor="' + au + '"]').forEach((b) => { b.setAttribute('aria-label', 'Seguindo'); b.textContent = 'Seguindo'; setTimeout(() => b.closest('div').remove(), 3000); });
      });
      const att = a.querySelector('[data-e2e="cinema-playback-control-autoscroll"] input');
      att.addEventListener('click', () => { window.__autoTT = att.checked; M.autoTT.push(att.checked); document.querySelectorAll('[name="cinema-mode-autoscroll"]').forEach((x) => { x.checked = att.checked; }); }); // como o site: vale para o feed todo
      const vid = a.querySelector('video');
      if (vid) {
        vid.addEventListener('click', () => { if (vid.paused) vid.play(); else vid.pause(); });
        // como o player do TikTok (xgplayer, loop): no fim, volta ao 0 e toca de novo
        vid.addEventListener('ended', () => { M.fins = (M.fins || 0) + 1; vid.currentTime = 0; vid.play().catch(() => {}); });
      }
      col.appendChild(a);
      M.renderizados.push(it.id);
    }
  }
  let pag = 0;
  async function carregar() {
    const r = await fetch(${q.get('planob') === '1' ? "'/api/escape/item_list/?aid=1988'" : "'/api/recommend/item_list/?aid=1988&count=' + (pag++)"});
    const j = await r.json();
    M.respostas.push({ via: 'fetch', n: (j.itemList || []).length });
    render(j.itemList || []);
  }
  function preload() {
    return new Promise((ok) => {
      const x = new XMLHttpRequest();
      x.open('GET', '/api/preload/item_list/?aid=1988');
      if (${q.get('xhrjson') === '1'}) x.responseType = 'json';
      x.onload = () => { const j = x.responseType === 'json' ? x.response : JSON.parse(x.responseText); M.respostas.push({ via: 'xhr', n: (j.itemList || []).length }); M.preloadIds = (j.itemList || []).map((i) => i.id); ok(); };
      x.send();
    });
  }
  function proximo() {
    M.proximos++;
    const arts = [...col.querySelectorAll('article')];
    const i = arts.findIndex((a) => a.getBoundingClientRect().top >= -5);
    const alvo = arts[Math.min(arts.length - 1, i + 1)];
    if (alvo && comAberto) history.replaceState({}, '', '/@mock/video/' + alvo.querySelector('[id^=xgwrapper-]').id.split('-').pop()); // como o site: a URL acompanha
    if (alvo) { alvo.scrollIntoView(); document.querySelectorAll('article video').forEach((v) => { if (v.closest('article') === alvo) { v.play().catch(() => {}); } else v.pause(); }); }
    if (i >= arts.length - 3) carregar();
  }
  document.querySelector('[data-e2e="feed-navigation-next"]').addEventListener('click', proximo);
  if (${q.get('coluna') === 'unica'}) {
    const cu = document.createElement('div'); cu.setAttribute('data-e2e', 'anchoring-engagement-vertical'); cu.style.cssText = 'position:fixed;right:90px;top:55%;color:#fff';
    cu.innerHTML = '<div data-e2e="comment-icon" class="css-b-7937d88b--ButtonActionItemV1" style="width:48px;height:60px;background:#444">C</div>';
    cu.firstChild.addEventListener('click', () => { M.cliquesComent++; window.__comentarios(!comAberto); });
    document.body.appendChild(cu);
  }
  document.getElementById('coment-x').addEventListener('click', () => window.__comentarios(false));
  // página de um vídeo aberto direto (/@x/video/id), medida 2026-11-12: abas "Comentários | Você pode gostar" (sem aria-selected; a
  // inativa fica com a cor a 48%), abre em "Você pode gostar"; vídeos da /api/related/item_list/; sem login: 1 vídeo e sem setas
  M.abas = []; let modoVideo = false;
  const corAba = (b, on) => { b.style.color = on ? '${dark ? 'rgb(255, 255, 255)' : 'rgb(0, 0, 0)'}' : '${dark ? 'rgba(255, 255, 255, 0.48)' : 'rgba(0, 0, 0, 0.48)'}'; };
  window.__abaVideo = (qual) => {
    document.getElementById('pv-coment').style.display = qual === 'coment' ? 'block' : 'none';
    document.getElementById('pv-rel').style.display = qual === 'rel' ? 'block' : 'none';
    corAba(document.getElementById('aba-coment'), qual === 'coment'); corAba(document.getElementById('aba-rel'), qual === 'rel');
  };
  document.getElementById('aba-coment').addEventListener('click', (e) => { M.abas.push({ aba: 'coment', confiavel: e.isTrusted }); window.__abaVideo('coment'); });
  document.getElementById('aba-rel').addEventListener('click', (e) => { M.abas.push({ aba: 'rel', confiavel: e.isTrusted }); window.__abaVideo('rel'); });
  const setasEl = document.querySelector('.setas');
  // modo navegador (vídeo aberto de uma grade: perfil/Explorar/busca), medido 2026-11-12 (ferramentas/medir-navegador.mjs):
  // o vídeo NÃO repete (no fim ele para), setas arrow-left/right, coração com aria-pressed no elemento de cima, browse-follow
  M.nav = { proximos: 0, anteriores: 0, fins: 0 };
  let nvLista = [], nvI = 0, nvOrigem = '/explore';
  const nvEl = document.getElementById('navegador');
  function nvMostrar(i) {
    nvI = Math.max(0, Math.min(nvLista.length - 1, i)); const it = nvLista[nvI];
    const foto = !!it.imagePost; // carrossel: URL /@x/photo/id e o tocador de fotos do site (código: DivPhotoVideoContainer > DivSwiperContainer > ImgPhotoSlide)
    history.pushState({}, '', '/@' + it.author.uniqueId + (foto ? '/photo/' : '/video/') + it.id); M.nav.id = it.id; M.nav.foto = foto; (M.nav.mostrados = M.nav.mostrados || []).push({ id: it.id, foto, t: Date.now() });
    document.getElementById('nv-videos').innerHTML = foto
      ? '<div class="css-pv-7937d88b--DivPhotoVideoContainer extb1210" style="width:100%;height:100%"><div class="css-sc-7937d88b--DivSwiperContainer" style="width:100%;height:100%">' + it.imagePost.images.map((im) => '<img class="css-is-7937d88b--ImgPhotoSlide" src="' + im.imageURL.urlList[0] + '" style="height:86vh">').join('') + '</div><div class="css-pc-7937d88b--DivPhotoControlContainer">&bull; &bull;</div></div>'
      : '<div data-e2e="browse-video" class="css-bp-7937d88b--DivBasicPlayerWrapper" style="width:100%;height:100%"><div id="xgwrapper-2-' + it.id + '" class="xgplayer-container"><video src="/media/clip.webm" muted autoplay playsinline style="height:86vh"></video></div></div>';
    const v = document.querySelector('#nv-videos video'); if (v) { v.addEventListener('ended', () => { M.nav.fins++; }); v.play().catch(() => {}); }
    document.getElementById('nv-user').textContent = it.author.uniqueId;
    const seg = it.author.relation === 0;
    document.getElementById('nv-follow').innerHTML = seg ? '<button type="button" class="css-sf-7937d88b--StyledFollowButtonTux">Seguir</button>' : '<button type="button" class="css-sg-7937d88b--StyledFollowingButtonTux">Seguindo</button>';
    const fb = document.querySelector('#nv-follow button');
    fb.addEventListener('click', () => { if (fb.textContent === 'Seguir') { M.seguiu.push(it.author.uniqueId); it.author.relation = 1; document.getElementById('nv-follow').innerHTML = '<button type="button" class="css-sg-7937d88b--StyledFollowingButtonTux">Seguindo</button>'; } else M.deixou.push(it.author.uniqueId); });
    document.getElementById('nv-like').setAttribute('aria-pressed', String(!!it.digged));
    document.querySelector('[data-e2e="arrow-left"]').setAttribute('aria-disabled', String(nvI === 0));
    document.querySelector('[data-e2e="arrow-right"]').setAttribute('aria-disabled', String(nvI >= nvLista.length - 1));
  }
  document.getElementById('nv-like').addEventListener('click', () => { const l = document.getElementById('nv-like'), it = nvLista[nvI]; const on = l.getAttribute('aria-pressed') === 'true'; if (on) M.descurtidas.push(it.id); else M.curtidas.push(it.id); it.digged = !on; l.setAttribute('aria-pressed', String(!on)); });
  document.querySelector('[data-e2e="arrow-right"]').addEventListener('click', () => { if (nvI < nvLista.length - 1) { M.nav.proximos++; nvMostrar(nvI + 1); } });
  document.querySelector('[data-e2e="arrow-left"]').addEventListener('click', () => { if (nvI > 0) { M.nav.anteriores++; nvMostrar(nvI - 1); } });
  document.querySelector('[data-e2e="browse-close"]').addEventListener('click', () => { nvEl.style.display = 'none'; document.getElementById('nv-videos').innerHTML = ''; history.pushState({}, '', nvOrigem); M.nav.fechou = true; });
  async function grade(rota) {
    const r = await fetch(rota + '?aid=1988'); const j = await r.json(); M.respostas.push({ via: 'fetch-grade', n: (j.itemList || []).length });
    nvLista = (j.itemList || []).slice(); // vídeos e carrosséis de fotos (como num perfil)
    col.innerHTML = '<div id="grade" style="display:grid;grid-template-columns:repeat(4,160px);gap:8px">' + nvLista.map((it, i) => '<a href="/@' + it.author.uniqueId + (it.imagePost ? '/photo/' : '/video/') + it.id + '" data-i="' + i + '" style="display:block;height:220px;background:#333;color:#fff">' + it.id.slice(-4) + '</a>').join('') + '</div>';
    col.querySelectorAll('#grade a').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); nvOrigem = location.pathname; nvEl.style.display = 'block'; nvMostrar(+a.dataset.i); }));
  }
  async function paginaDeVideo(id) {
    modoVideo = true; M.modoVideo = true;
    document.getElementById('painel-video').style.display = 'block'; document.body.classList.add('pagvideo');
    window.__abaVideo('rel');
    const r = await fetch('/api/related/item_list/?aid=1988&itemID=' + id); const j = await r.json(); M.respostas.push({ via: 'fetch-related', n: (j.itemList || []).length });
    const lista = ${q.get('setas') === '1'} ? j.itemList : (j.itemList || []).slice(0, 1); // com conta (visto no relato): vários e com setas
    if (!${q.get('setas') === '1'}) setasEl.style.display = 'none';
    render(lista);
  }
  function sairDaPaginaDeVideo() { if (!modoVideo) return; modoVideo = false; M.modoVideo = false; document.getElementById('painel-video').style.display = 'none'; document.body.classList.remove('pagvideo'); setasEl.style.display = ''; }
  // navegação interna como o site: pushState sem recarregar
  // comentários como o site (medido): abrir troca a URL para /@perfil/video/<id> e empurra o vídeo e as setas; fechar volta a URL
  let comAberto = false, urlFeed = '/foryou';
  const idTela = () => { const a = [...col.querySelectorAll('article')].find((x) => { const r = x.getBoundingClientRect(); return r.top <= innerHeight / 2 && r.bottom >= innerHeight / 2; }); return a && a.querySelector('[id^=xgwrapper-]').id.split('-').pop(); };
  window.__comentarios = (on, semUrl) => {
    if (on === comAberto) return; comAberto = on;
    document.getElementById('comentarios').style.display = on ? 'block' : 'none'; document.body.classList.toggle('coment', on);
    if (semUrl) return;
    if (on) { urlFeed = location.pathname; history.pushState({}, '', '/@mock/video/' + idTela()); } else history.pushState({}, '', urlFeed);
  };
  window.__ir = async (p) => {
    window.__comentarios(false, true); sairDaPaginaDeVideo(); M.irs = (M.irs || []).concat(p);
    history.pushState({}, '', p);
    col.innerHTML = ''; n = 0;
    if (p.startsWith('/following')) { const r = await fetch('/api/following/item_list/?aid=1988'); const j = await r.json(); M.respostas.push({ via: 'fetch-following', n: j.itemList.length }); render(j.itemList); }
    else if (p.startsWith('/explore')) await grade('/api/explore/item_list/');
    else if (p.startsWith('/friends')) { const r = await fetch('/api/friends/item_list/?aid=1988'); const j = await r.json(); M.respostas.push({ via: 'fetch-friends', n: j.itemList.length }); render(j.itemList); }
    else if (p === '/' || p.startsWith('/foryou')) { pag = 0; await carregar(); }
  };
  document.querySelectorAll('a[data-e2e^="nav-"]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); window.__ir(a.getAttribute('href')); }));
  (async () => {
    const p = location.pathname;
    if (p.startsWith('/following') || p.startsWith('/friends')) await window.__ir(p + location.search);
    else if (${q.get('restaura') === '1'}) {
      // como o site com conta (visto no Chrome do André): lembra os comentários abertos e troca a URL para /@x/video/id na carga,
      // ANTES de o feed aparecer
      history.replaceState({}, '', '/@mock/video/7700000000000000001'); window.__comentarios(true, true); comAberto = true;
      await new Promise((r) => setTimeout(r, 2500)); await carregar(); await preload();
    }
    else if (${q.get('vaiParaVideo') === '1'} && (p === '/' || p.startsWith('/foryou'))) {
      // o TikTok (com conta?) leva a entrada direta para um vídeo: a URL vira /@x/video/id logo depois da carga
      await new Promise((r) => setTimeout(r, 300));
      history.replaceState({}, '', '/@mock/video/7700000000000000001'); await paginaDeVideo('7700000000000000001');
    }
    else if (p.startsWith('/explore')) await grade('/api/explore/item_list/');
    else if (p.startsWith('/@') && p.includes('/video/')) await paginaDeVideo(p.split('/').pop());
    else if (p === '/' || p.startsWith('/foryou')) { await carregar(); await preload(); }
    M.pronto = true;
  })();
})();
</script></body></html>`;
}

// Liga o mock no contexto: tiktok.com (HTML, API, mídia) e o GitHub (Releases). Devolve o estado mutável (st.gh = release falsa).
export async function rotas(ctx) {
  // curtidos (ids) e seguindo (uniqueIds): o que a resposta da API diz (digged / author.relation), como com conta
  const st = { gh: null, ghHits: 0, api: [], ev: [], atrasoDm: 0, curtidos: new Set(), seguindo: new Set() };
  await ctx.route('https://www.tiktok.com/**', async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname.startsWith('/media/')) {
      if (u.pathname.endsWith('.webm')) return route.fulfill({ status: 200, contentType: 'video/webm', body: VIDEO, headers: { 'access-control-allow-origin': '*' } });
      return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    }
    if (u.pathname.startsWith('/api/')) {
      st.api.push(u.pathname);
      let body = null;
      if (u.pathname === '/api/recommend/item_list/') { const i = Math.min(+(u.searchParams.get('count') || 0), FEED.recommend.length - 1); body = FEED.recommend[i]; }
      else if (u.pathname === '/api/preload/item_list/') body = FEED.preload;
      else if (u.pathname === '/api/related/item_list/') body = FEED.recommend[1];
      else if (u.pathname === '/api/explore/item_list/') body = FEED.recommend[0]; // grade do Explorar (modo navegador) // "Você pode gostar" / vídeos relacionados
      else if (u.pathname === '/api/following/item_list/' || u.pathname === '/api/friends/item_list/') body = FEED.following; // Amigos: mesma forma (rota do código do site)
      else if (u.pathname === '/api/escape/item_list/') body = FEED.escape;
      if (body && Array.isArray(body.itemList)) body = Object.assign({}, body, { itemList: body.itemList.map((it) => Object.assign({}, it, { digged: st.curtidos.has(String(it.id)), author: it.author && Object.assign({}, it.author, { relation: st.seguindo.has(it.author.uniqueId) ? 1 : 0 }) })) });
      if (body) return route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify(body) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"statusCode":0}' });
    }
    if (u.pathname === '/__mock/ev') { try { st.ev.push(Object.assign({ em: Date.now() }, JSON.parse(route.request().postData() || '{}'))); } catch (_) {} return route.fulfill({ status: 204, body: '' }); }
    if (u.pathname.startsWith('/messages')) {
      if (st.atrasoDm > 0) { const ms = st.atrasoDm; st.atrasoDm = 0; await new Promise((r) => setTimeout(r, ms)); } // página que demora (aba "congelada")
      return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: dmHtml(u.searchParams) });
    }
    if (u.pathname === '/favicon.ico') return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: tiktokHtml(u.searchParams, u.pathname) });
  });
  // CDN de vídeo como o medido: só entrega com o Referer do TikTok (fora da página: 403); cada versão leva uma marca no fim do
  // arquivo para o teste saber qual foi baixada (marca d'água = 'marca'). Imagens (capa, fotos) entregam direto.
  st.cdn = [];
  await ctx.route('https://v16-webapp-prime.tiktok.com/**', (route) => {
    const r = route.request(), u = new URL(r.url()), ref = r.headers().referer || '';
    st.cdn.push({ v: u.searchParams.get('v'), ref: ref.slice(0, 40), recurso: r.resourceType() });
    if (!/^https:\/\/www\.tiktok\.com\//.test(ref)) return route.fulfill({ status: 403, contentType: 'text/html', body: '<html>403</html>' });
    return route.fulfill({ status: 200, contentType: 'video/webm', body: Buffer.concat([VIDEO, Buffer.from('BRASA-VARIANTE:' + u.searchParams.get('v'))]), headers: { 'access-control-allow-origin': 'https://www.tiktok.com', 'access-control-allow-credentials': 'true' } });
  });
  await ctx.route('https://p16-common-sign.tiktokcdn.com/**', (route) => route.fulfill({ status: 200, contentType: 'image/jpeg', body: Buffer.concat([PNG, Buffer.from('BRASA-IMG:' + new URL(route.request().url()).pathname + new URL(route.request().url()).search)]) }));
  await ctx.route('https://im-api-sg.tiktok.com/**', (route) => route.fulfill({ status: 200, contentType: 'application/x-protobuf', body: pacoteSequencia(), headers: { 'access-control-allow-origin': 'https://www.tiktok.com', 'access-control-allow-credentials': 'true' } }));
  await ctx.route('https://api.github.com/**', async (route) => {
    st.ghHits++;
    if (!st.gh) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"message":"Not Found"}' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tag_name: st.gh.tag, name: st.gh.name, body: st.gh.body, html_url: 'https://github.com/DredsGG/brasa/releases/tag/' + st.gh.tag, assets: [{ name: `brasa-${st.gh.tag}.zip`, browser_download_url: `https://github.com/DredsGG/brasa/releases/download/${st.gh.tag}/brasa-${st.gh.tag}.zip` }] }) });
  });
  await ctx.route('https://github.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>github simulado</body></html>' }));
  return st;
}
