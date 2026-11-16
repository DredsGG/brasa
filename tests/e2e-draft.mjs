// v1.0.3 · o editor das DMs do TikTok é Draft.js (React). O mock-dm usa um editor falso, que aceita qualquer jeito de digitar:
// foi por isso que os testes passavam e o guarda-foguinho nunca digitou de verdade (Registro do André, 2026-11-16: "não consegui
// digitar" na 1ª conversa e "a conversa não abriu" nas seguintes). Aqui o editor é um Draft.js DE VERDADE (0.11.7, React 17),
// e as funções de digitar/apagar são as do src/guarda.js (lidas do arquivo, sem cópia). Sem rede. Uso: node e2e-draft.mjs
import { chromium } from './node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path';
import { DIR, EXT, check, fim } from './lib.mjs';
const nm = (p) => fs.readFileSync(path.join(DIR, 'node_modules', p), 'utf8');
const fonte = fs.readFileSync(path.join(EXT, 'src', 'guarda.js'), 'utf8');
const ini = fonte.indexOf('  const textoEditor = () =>'), fimT = fonte.indexOf('  const norm = (s) =>');
check('guarda.js: achei o trecho de digitar/apagar', ini > 0 && fimT > ini);
const trecho = fonte.slice(ini, fimT);
const PAGINA = `<!doctype html><html><head><meta charset="utf-8"><style>${nm('draft-js/dist/Draft.css')}</style></head><body>
<div data-e2e="dm-new-input-editor" style="width:400px;min-height:40px"><div id="root"></div></div></body></html>`;
const APP = `window.__erros = []; addEventListener('error', (e) => window.__erros.push(String(e.message)));
const { Editor, EditorState } = Draft;
function App() { const [st, setSt] = React.useState(() => EditorState.createEmpty()); window.__texto = () => st.getCurrentContent().getPlainText();
  return React.createElement(Editor, { editorState: st, onChange: setSt, placeholder: 'Enviar uma mensagem...' }); }
class Limite extends React.Component { constructor(p) { super(p); this.state = { q: null }; } static getDerivedStateFromError(e) { return { q: String(e && e.message || e) }; } render() { return this.state.q ? React.createElement('b', { id: 'quebrou' }, this.state.q) : this.props.children; } }
ReactDOM.render(React.createElement(Limite, null, React.createElement(App)), document.getElementById('root'));`;
const FUNCS = `(() => { const SEL = { editor: '[data-e2e="dm-new-input-editor"] [contenteditable="true"]' }; const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function ate(fn, ms, passo) { const fim = Date.now() + ms; while (Date.now() < fim) { let v = null; try { v = fn(); } catch (_) {} if (v) return v; await wait(passo || 150); } return null; }
  ${trecho}
  window.__g = { escrever, limparEditor, textoEditor }; })()`;
// controle: o jeito da v1.0.2 (execCommand primeiro) — o teste tem de mostrar que ele QUEBRA o Draft.js, senão não prova nada
const ANTIGO = `(() => { const ed = document.querySelector('[data-e2e="dm-new-input-editor"] [contenteditable="true"]'); ed.focus();
  const s = getSelection(), r = document.createRange(); r.selectNodeContents(ed); r.collapse(false); s.removeAllRanges(); s.addRange(r);
  document.execCommand('insertText', false, '🔥 oi'); })()`;
const browser = await chromium.launch({ headless: true });
async function pagina() {
  const p = await browser.newPage();
  await p.setContent(PAGINA);
  for (const f of ['react/umd/react.development.js', 'react-dom/umd/react-dom.development.js', 'immutable/dist/immutable.js', 'draft-js/dist/Draft.js']) await p.addScriptTag({ content: nm(f) });
  await p.addScriptTag({ content: APP });
  await p.waitForSelector('[contenteditable="true"]');
  await p.evaluate(FUNCS);
  return p;
}
const FRASE = '🔥 bom dia, sequência mantida';
const p = await pagina();
const r = await p.evaluate(async (F) => { const e = await window.__g.escrever(F); await new Promise((x) => setTimeout(x, 300)); return { e, tela: window.__g.textoEditor(), draft: window.__texto() }; }, FRASE);
check('Draft.js de verdade: a Brasa digita (texto na tela)', r.e && r.e.ok && r.tela === FRASE, r);
check('Draft.js de verdade: o texto entra no ESTADO do editor (é o que o TikTok envia)', r.draft === FRASE, r.draft);
const l = await p.evaluate(async () => { const ok = await window.__g.limparEditor(); await new Promise((x) => setTimeout(x, 300)); return { ok, tela: window.__g.textoEditor(), draft: window.__texto() }; });
check('Draft.js de verdade: apagar (ensaio / falha) limpa a tela e o estado', l.ok && !l.tela && l.draft === '', l);
const sa = await p.evaluate(() => ({ quebrou: (document.getElementById('quebrou') || {}).textContent || null, erros: window.__erros }));
check('o editor não quebrou (sem erro do React)', !sa.quebrou && !sa.erros.length, sa);
// digitar de novo depois de apagar (a próxima conversa da rodada usa o mesmo editor)
const r2 = await p.evaluate(async (F) => { const e = await window.__g.escrever(F); await new Promise((x) => setTimeout(x, 300)); return { e, draft: window.__texto() }; }, 'segunda frase');
check('digita de novo depois de apagar', r2.e && r2.e.ok && r2.draft === 'segunda frase', r2);
// controle com o jeito antigo
const p2 = await pagina();
await p2.evaluate(ANTIGO); await p2.waitForTimeout(800);
const q = await p2.evaluate(() => ({ quebrou: (document.getElementById('quebrou') || {}).textContent || null, erros: window.__erros.slice(0, 1) }));
check('controle: o jeito antigo (execCommand) quebra o Draft.js — o teste enxerga o problema', !!q.quebrou || q.erros.length > 0, q);
await browser.close();
fim();
