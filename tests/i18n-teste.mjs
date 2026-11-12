// Regra 13: as três línguas têm exatamente as mesmas chaves (inclusive dentro de objetos e listas), nenhuma vazia,
// as funções aceitam os mesmos argumentos e as Novidades existem nos três idiomas para cada versão. Uso: node i18n-teste.mjs
import fs from 'fs'; import path from 'path'; import vm from 'vm';
import { check, fim, EXT } from './lib.mjs';

const ctx = { navigator: { language: 'pt-BR', languages: ['pt-BR'] } }; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(EXT, 'src', 'i18n.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(EXT, 'src', 'novidades.js'), 'utf8'), ctx);
const { T, LANGS } = ctx.BRASA_I18N;
function folhas(o, pre = '') {
  const out = {};
  for (const [k, v] of Object.entries(o)) {
    const c = pre ? pre + '.' + k : k;
    if (v && typeof v === 'object') Object.assign(out, folhas(v, c));
    else out[c] = v;
  }
  return out;
}
const F = Object.fromEntries(LANGS.map((l) => [l, folhas(T[l])]));
check('três idiomas: pt, en, es', LANGS.join(',') === 'pt,en,es');
for (const l of ['en', 'es']) {
  const faltam = Object.keys(F.pt).filter((k) => !(k in F[l])), sobram = Object.keys(F[l]).filter((k) => !(k in F.pt));
  check(`${l}: mesmas chaves do pt`, !faltam.length && !sobram.length, { faltam: faltam.slice(0, 10), sobram: sobram.slice(0, 10) });
}
for (const l of LANGS) {
  const vazias = Object.entries(F[l]).filter(([, v]) => v === '' || v == null).map(([k]) => k);
  check(`${l}: nenhum texto vazio`, !vazias.length, vazias);
  const aridade = Object.entries(F.pt).filter(([k, v]) => typeof v === 'function' && (typeof F[l][k] !== 'function' || F[l][k].length !== v.length)).map(([k]) => k);
  check(`${l}: funções com os mesmos argumentos`, !aridade.length, aridade);
}
const N = ctx.BRASA_NOVIDADES;
const ver = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version;
for (const l of LANGS) check(`Novidades da v${ver} em ${l}`, Array.isArray(N[l][ver]) && N[l][ver].length > 0);
check('Novidades: mesmas versões nos 3 idiomas', ['en', 'es'].every((l) => Object.keys(N[l]).join() === Object.keys(N.pt).join()));
for (const l of ['en', 'es', 'pt_BR', 'pt_PT']) {
  const m = JSON.parse(fs.readFileSync(path.join(EXT, '_locales', l, 'messages.json'), 'utf8'));
  check(`_locales/${l}: descrição até 132 caracteres`, m.appDesc && m.appDesc.message.length <= 132 && m.actionTitle, m.appDesc && m.appDesc.message.length);
}
fim();
