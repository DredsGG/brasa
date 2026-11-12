// Brasa — bloco de botões da Brasa na tela do vídeo (v0.6.1, pedido do André: "mais visível, para saber que é da extensão").
// Uma cápsula com a chama da Brasa e um botão redondo com rótulo para cada recurso (Baixar, Auto), logo ACIMA das setas
// "vídeo anterior / próximo vídeo" do TikTok, à direita: área vazia nos dois layouts medidos, sem cobrir o vídeo nem as setas.
// Os botões agem no vídeo que está no meio da tela.
// Medido em 2026-11-11: setas [data-e2e="feed-navigation-prev|next"] à direita, no meio da altura (x≈1286–1326, y≈402–498 em 1366×900);
// a coluna de ações (curtir…) começa mais abaixo (y≈614). Plano B (sem setas): a cápsula fica fixa à direita, no alto.
(() => {
  'use strict';
  const BRASA = globalThis.BRASA;
  if (!BRASA || BRASA.dead) return;
  const { ICO } = BRASA.C;
  const CLS = 'brasa-acoes', ST = 'brasa-acoes-css';
  const CSS = `
.${CLS}{all:initial;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;gap:8px;width:48px;padding:6px 0 8px;border-radius:24px;
  background:rgba(0,0,0,.55);border:1.5px solid #fe2c55;box-shadow:0 2px 10px rgba(0,0,0,.3);z-index:20;font-family:TikTokFont,Arial,sans-serif}
.${CLS}.sobre{position:absolute;left:50%;bottom:calc(100% + 16px);transform:translateX(-50%)}
.${CLS}.solta{position:fixed;right:22px;top:96px}
.${CLS}.quadro{position:absolute;z-index:30}
.${CLS} .brasa-marca{display:flex;align-items:center;justify-content:center;width:20px;height:20px;color:#fe2c55}
.${CLS} .brasa-marca svg{width:18px;height:18px}
.${CLS} .brasa-item{display:flex;flex-direction:column;align-items:center;gap:3px}
.${CLS} button{all:unset;box-sizing:border-box;width:40px;height:40px;border-radius:20px;display:flex;align-items:center;justify-content:center;cursor:pointer;
  background:#fe2c55;color:#fff;transition:transform .1s ease-out,background .1s ease-out}
.${CLS} button:hover{transform:scale(1.08)}
.${CLS} button:focus-visible{outline:2px solid #fff;outline-offset:2px}
.${CLS} button svg{width:22px;height:22px;display:block}
.${CLS} button[aria-pressed=false]{background:rgba(255,255,255,.12);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.75)}
.${CLS} .brasa-rot{font:700 11px/14px TikTokFont,Arial,sans-serif;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.7);white-space:nowrap}
`;
  function garantirCss() {
    if (document.getElementById(ST)) return;
    const s = document.createElement('style'); s.id = ST; s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }
  // onde a cápsula mora: o contêiner comum das setas do feed
  function ancora() {
    // feed: feed-navigation-*; modo navegador (vídeo aberto de perfil/Explorar/busca, v1.0.2): arrow-right/arrow-left
    const vis = (e) => !!e && e.getBoundingClientRect().width > 0;
    const quadro = !!camadaDoQuadro(); // o quadro cobre a página: as setas dele valem
    const prox = quadro ? document.querySelector('[data-e2e="arrow-right"]') : [document.querySelector('[data-e2e="feed-navigation-next"]')].find(vis);
    const ant = quadro ? document.querySelector('[data-e2e="arrow-left"]') : [document.querySelector('[data-e2e="feed-navigation-prev"]')].find(vis);
    if (!prox) return null;
    let a = prox.parentElement;
    while (a && ant && !a.contains(ant)) a = a.parentElement;
    return a || prox.parentElement;
  }
  // v1.0.2 · modo navegador: o contêiner das setas do quadro corta o que sai dele (medido ao vivo: o bloco ficava invisível),
  // então o bloco mora na camada fixa do quadro e fica posicionado logo acima das setas, na mesma coluna
  function camadaDoQuadro() {
    const x = document.querySelector('[data-e2e="browse-close"]');
    if (!x || !(x.getBoundingClientRect().width > 0)) return null; // só com o quadro aberto (o fechar visível)
    for (let n = x.parentElement; n && n !== document.body; n = n.parentElement) if (getComputedStyle(n).position === 'fixed') return n;
    return null;
  }
  function posicionarNoQuadro(c, camada) {
    const setas = ['arrow-left', 'arrow-right'].map((k) => document.querySelector(`[data-e2e="${k}"]`)).filter((e) => e && e.getBoundingClientRect().width > 0);
    if (!setas.length) return;
    const R = camada.getBoundingClientRect(), topo = Math.min(...setas.map((e) => e.getBoundingClientRect().top)), s = setas[setas.length - 1].getBoundingClientRect();
    const left = Math.round(s.left + s.width / 2 - R.left - 24), bottom = Math.round(R.bottom - topo + 16);
    if (c.style.left !== left + 'px') c.style.left = left + 'px';
    if (c.style.bottom !== bottom + 'px') c.style.bottom = bottom + 'px';
  }
  function caixa(criar) {
    let c = document.querySelector('.' + CLS);
    const camada = camadaDoQuadro();
    if (camada) {
      if (!(c && c.isConnected) && criar && document.body) { c = novaCaixa(); }
      if (!c || !c.isConnected && !criar) return null;
      if (c.parentElement !== camada) camada.appendChild(c);
      if (c.className !== CLS + ' quadro') { c.className = CLS + ' quadro'; c.style.top = ''; }
      posicionarNoQuadro(c, camada);
      return c;
    }
    if (c && c.classList.contains('quadro')) { c.style.left = c.style.bottom = ''; c.remove(); c = null; } // o quadro fechou
    const a = ancora();
    if (c && c.isConnected) {
      // reposiciona se as setas apareceram/sumiram (navegação interna)
      if (a && c.parentElement !== a) { prepara(a); a.appendChild(c); c.className = CLS + ' sobre'; }
      else if (!a && !c.classList.contains('solta')) { document.body.appendChild(c); c.className = CLS + ' solta'; }
      return c;
    }
    if (!criar || !document.body) return null;
    c = novaCaixa();
    if (a) { prepara(a); c.className = CLS + ' sobre'; a.appendChild(c); } else { c.className = CLS + ' solta'; document.body.appendChild(c); }
    return c;
  }
  function novaCaixa() {
    const c = document.createElement('div');
    c.innerHTML = `<span class="brasa-marca" title="Brasa">${ICO.app}</span>`;
    for (const ev of ['pointerdown', 'mousedown', 'mouseup', 'click', 'dblclick', 'wheel', 'keydown']) c.addEventListener(ev, (e) => e.stopPropagation());
    return c;
  }
  const prepara = (a) => { if (getComputedStyle(a).position === 'static') a.style.position = 'relative'; };
  // garante o item `chave` (ordem menor = mais acima); criar() devolve o <button>
  function item(chave, ordem, rotulo, criar) {
    garantirCss();
    const c = caixa(true);
    if (!c) return;
    let it = c.querySelector(`.brasa-item[data-acao="${chave}"]`);
    if (!it) {
      it = document.createElement('div');
      it.className = 'brasa-item'; it.dataset.acao = chave; it.dataset.ordem = ordem;
      it.appendChild(criar());
      const r = document.createElement('span'); r.className = 'brasa-rot'; it.appendChild(r);
      const depois = [...c.querySelectorAll('.brasa-item')].find((x) => +x.dataset.ordem > ordem);
      c.insertBefore(it, depois || null);
    }
    const r = it.querySelector('.brasa-rot'); if (r.textContent !== rotulo) r.textContent = rotulo;
  }
  function tirar(chave) {
    for (const it of document.querySelectorAll(`.${CLS} .brasa-item[data-acao="${chave}"]`)) it.remove();
    for (const c of document.querySelectorAll('.' + CLS)) if (!c.querySelector('.brasa-item')) c.remove();
  }
  BRASA.acoes = { item, tirar, CLS };
  BRASA.onStop(() => { for (const c of document.querySelectorAll('.' + CLS)) c.remove(); const s = document.getElementById(ST); if (s) s.remove(); });
})();
