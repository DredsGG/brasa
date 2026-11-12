// Brasa — v0.6.4 · Trocar de conta (pedido do André, "como no Salva Stories", feito pelo Sair do próprio TikTok).
// O TikTok web não tem "Trocar de conta" para a conta do André (medido 2026-11-12: nem no "Mais" nem no menu do avatar; o
// experimento webapp_switch_account do site está desligado). Então a Brasa faz o caminho de quem usa: "Mais" → "Sair"
// (o painel do Mais abre transparente, para não piscar) e, quando a página volta sem conta, abre o "Entrar" do TikTok, onde a
// pessoa escolhe ou entra na outra conta. A Brasa nunca lê, guarda nem digita senha, cookie ou dado de login.
// Medido: Sair = [data-e2e="logout-entrance"] dentro do painel do "Mais" ([data-e2e="see-more-popup"]); também existe no menu
// escondido do avatar [data-e2e="profile-icon"]. Entrar = #header-login-button. O site tem o experimento confirm_logout: se ele
// pedir confirmação, quem confirma é a pessoa, no quadro do TikTok.
(() => {
  'use strict';
  const M = globalThis.BRASA_MENU, C = globalThis.BRASA_COMUM;
  if (!M || !C) return;
  const { esc } = C;
  const ICO_TROCA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3l4 4-4 4"/><path d="M21 7H9a4 4 0 0 0-4 4"/><path d="M7 21l-4-4 4-4"/><path d="M3 17h12a4 4 0 0 0 4-4"/></svg>';
  M.addSecao({
    id: 'conta', ordem: 45,
    html: (T, ctx) => M.cartao(ctx, 'conta', ICO_TROCA, T['set.conta'], T.featConta_,
      ctx.onde === 'pagina' ? `<div class="campo"><button type="button" class="btn sec" data-conta="agora">${esc(T.contaAgora)}</button></div>` : ''),
    wire(el) { const b = el.querySelector('[data-conta="agora"]'); if (b) b.addEventListener('click', () => { if (globalThis.BRASA && globalThis.BRASA.conta) globalThis.BRASA.conta.trocar(); }); },
  });

  const BRASA = globalThis.BRASA;
  if (!BRASA || BRASA.dead || !BRASA.barraExtra) return;
  const ext = BRASA.ext, K = BRASA.DEF.K;
  const L = () => BRASA.L();
  const K_TROCA = 'br.troca'; // { em } — a troca começou: quando a página voltar sem conta, abre o "Entrar"
  const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

  const logado = () => !document.querySelector('#header-login-button')
    && !!document.querySelector('[data-e2e="profile-icon"],[data-e2e="nav-messages"],[data-e2e="nav-activity"],[data-e2e="nav-friends"]');
  const sairVisivel = () => [...document.querySelectorAll('[data-e2e="logout-entrance"]')].find((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }) || null;
  const envioRodando = async () => { try { const e = (await ext.storage.local.get(K.envio))[K.envio]; return !!(e && e.ate && e.ate > Date.now()); } catch (_) { return false; } };

  let trocando = false;
  async function trocar() {
    if (trocando || BRASA.dead) return;
    const T = L();
    if (BRASA.menu && BRASA.menu.aberto) BRASA.menu.fechar();
    if (!logado()) { BRASA.toast(T.contaJaFora); abrirEntrar(); return; }
    if (await envioRodando()) { BRASA.toast(T.contaOcupado, 6000); BRASA.log('conta', ['ocupado'], false); return; }
    const ok = await BRASA.confirmar({ titulo: T.contaConfTitulo, texto: T.contaConfTexto, sim: T.contaSim, nao: T.contaNao });
    if (!ok) return;
    if (await envioRodando()) { BRASA.toast(T.contaOcupado, 6000); return; } // começou um envio enquanto a pessoa lia
    trocando = true;
    // esconde só o painel novo que o "Mais" abre (transparente), até clicar no Sair
    const antes = new Set(document.body.children);
    const escondidos = new Map();
    const esconder = () => { for (const n of document.body.children) if (!antes.has(n) && !escondidos.has(n) && n.tagName !== 'BRASA-UI' && n.querySelector && (n.querySelector('[data-e2e="see-more-popup"],[data-e2e="logout-entrance"]') || n.matches('[data-e2e="see-more-popup"]'))) { escondidos.set(n, n.style.opacity); n.style.setProperty('opacity', '0', 'important'); } };
    const mo = new MutationObserver(esconder);
    const devolver = () => { mo.disconnect(); for (const [n, op] of escondidos) if (n.isConnected) n.style.opacity = op; escondidos.clear(); };
    try {
      let sair = sairVisivel();
      let abriu = null;
      if (!sair) {
        const mais = document.querySelector('[data-e2e="nav-more-menu"]');
        if (mais) {
          mo.observe(document.body, { childList: true, subtree: true });
          mais.click(); abriu = mais; esconder();
          for (let t = 0; t < 40 && !(sair = sairVisivel()); t++) { await pausa(50); esconder(); }
        }
      }
      if (!sair) { // plano B: o menu escondido do avatar
        const av = document.querySelector('[data-e2e="profile-icon"]');
        if (av) { av.click(); for (let t = 0; t < 30 && !(sair = document.querySelector('[data-e2e="logout-entrance"]')); t++) await pausa(50); }
      }
      if (!sair) {
        if (abriu) { abriu.click(); await pausa(200); }
        devolver();
        BRASA.toast(T.contaSemSair, 7000); BRASA.log('conta', ['semSair'], false);
        return;
      }
      await ext.storage.local.set({ [K_TROCA]: { em: Date.now() } });
      BRASA.log('conta', ['sair']);
      sair.click();
      // o TikTok pode pedir confirmação (experimento confirm_logout): a pessoa confirma no quadro dele
      await pausa(1200);
      devolver();
      if (logado() && document.querySelector('[role="dialog"],[class*="DivModalContainer"]')) BRASA.toast(T.contaConfirmeTT, 7000);
    } finally { devolver(); trocando = false; }
  }

  // depois da troca a página volta sem conta: abre o "Entrar" do TikTok (uma vez, até 3 min depois)
  function abrirEntrar() {
    const b = document.querySelector('#header-login-button');
    if (!b) return false;
    b.click();
    return true;
  }
  let conferiu = false;
  async function depoisDeSair() {
    if (conferiu || BRASA.dead) return;
    let t = null; try { t = (await ext.storage.local.get(K_TROCA))[K_TROCA]; } catch (_) {}
    if (!t || !t.em) { conferiu = true; return; }
    if (Date.now() - t.em > 180000) { conferiu = true; ext.storage.local.remove(K_TROCA).catch(() => {}); return; }
    if (logado()) return; // ainda saindo (ou a pessoa cancelou no quadro do TikTok: a marca vence em 3 min)
    if (!document.querySelector('#header-login-button')) return; // página ainda montando
    conferiu = true;
    await ext.storage.local.remove(K_TROCA).catch(() => {});
    await pausa(800);
    if (abrirEntrar()) { BRASA.toast(L().contaEscolha, 6000); BRASA.log('conta', ['entrar']); }
  }
  const tDepois = setInterval(depoisDeSair, 700);

  BRASA.barraExtra({
    id: 'brasa-conta', icone: ICO_TROCA, rotulo: () => L()['set.conta'],
    mostrar: () => BRASA.ativo() && BRASA.S.conta && logado(),
    clique: () => trocar(),
  });
  BRASA.conta = { trocar, logado };
  BRASA.onStop(() => { clearInterval(tDepois); });
})();
