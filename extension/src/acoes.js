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
    const prox = document.querySelector('[data-e2e="feed-navigation-next"]'), ant = document.querySelector('[data-e2e="feed-navigation-prev"]');
    if (!prox) return null;
    let a = prox.parentElement;
    while (a && ant && !a.contains(ant)) a = a.parentElement;
    return a || prox.parentElement;
  }
  function caixa(criar) {
    let c = document.querySelector('.' + CLS);
    const a = ancora();
    if (c && c.isConnected) {
      // reposiciona se as setas apareceram/sumiram (navegação interna)
      if (a && c.parentElement !== a) { prepara(a); a.appendChild(c); c.className = CLS + ' sobre'; }
      else if (!a && !c.classList.contains('solta')) { document.body.appendChild(c); c.className = CLS + ' solta'; }
      return c;
    }
    if (!criar || !document.body) return null;
    c = document.createElement('div');
    c.innerHTML = `<span class="brasa-marca" title="Brasa">${ICO.app}</span>`;
    for (const ev of ['pointerdown', 'mousedown', 'mouseup', 'click', 'dblclick', 'wheel', 'keydown']) c.addEventListener(ev, (e) => e.stopPropagation());
    if (a) { prepara(a); c.className = CLS + ' sobre'; a.appendChild(c); } else { c.className = CLS + ' solta'; document.body.appendChild(c); }
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
