// Brasa — leitor de protobuf sem esquema, só para ACHAR a sequência (foguinho) nos pacotes que o próprio TikTok recebe.
// Formato medido no código do site em 2026-11-11 (im_proto.StreakValue, dentro de StreakCommandMessage, tipo 100001):
//   1 users[] {1 uid int64, 2 timestamp int64} · 2 streak_start int64 · 3 streak_counter int32 (dias) · 4 streak_timezone string ·
//   5 restorable_before int64 · 6 remain_restore_cnt · 7 streak_level · 8 streak_start_original · 9 streak_timezone_offset ·
//   100 conversation_type · 101 conversation_id string ("0:1:<uid>:<uid>" a dois; grupo = só número)
// Procura qualquer submensagem com o campo 101 (texto "n:n:n:n") e o campo 3 (número): é um StreakValue.
// Roda no mundo MAIN (page.js) e no Node (testes). Nada aqui fala com a rede nem guarda nada.
(() => {
  const TAG101 = [0xaa, 0x06]; // (101 << 3) | 2 em varint
  function varint(u8, i) {
    let r = 0n, s = 0n;
    for (let k = 0; k < 10; k++) {
      if (i >= u8.length) return null;
      const b = u8[i++];
      r |= BigInt(b & 0x7f) << s; s += 7n;
      if (!(b & 0x80)) return [r, i];
    }
    return null;
  }
  // lê os campos de [ini, fim); devolve null se não for uma mensagem válida
  function campos(u8, ini, fim) {
    const out = [];
    let i = ini;
    while (i < fim) {
      const t = varint(u8, i); if (!t) return null;
      i = t[1];
      const n = Number(t[0] >> 3n), w = Number(t[0] & 7n);
      if (n < 1 || n > 536870911) return null;
      if (w === 0) { const v = varint(u8, i); if (!v) return null; out.push({ n, w, v: v[0] }); i = v[1]; }
      else if (w === 1) { if (i + 8 > fim) return null; out.push({ n, w, a: i, b: i + 8 }); i += 8; }
      else if (w === 5) { if (i + 4 > fim) return null; out.push({ n, w, a: i, b: i + 4 }); i += 4; }
      else if (w === 2) { const l = varint(u8, i); if (!l) return null; const len = Number(l[0]); i = l[1]; if (len < 0 || i + len > fim) return null; out.push({ n, w, a: i, b: i + len }); i += len; }
      else return null;
    }
    return i === fim ? out : null;
  }
  const dec = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { fatal: true }) : null;
  const texto = (u8, c) => { try { return dec.decode(u8.subarray(c.a, c.b)); } catch (_) { return null; } };
  const num = (v) => (v > 9007199254740991n ? v.toString() : Number(v));
  function comoSequencia(u8, cs) {
    const c101 = cs.find((c) => c.n === 101 && c.w === 2), c3 = cs.find((c) => c.n === 3 && c.w === 0);
    if (!c101 || !c3) return null;
    const conv = texto(u8, c101);
    if (!conv || !(/^\d+:\d+:\d+:\d+$/.test(conv) || /^\d{10,}$/.test(conv))) return null; // a dois ou grupo
    const dias = Number(c3.v);
    if (dias < 0 || dias > 100000) return null;
    const pega = (n) => { const c = cs.find((x) => x.n === n && x.w === 0); return c ? num(c.v) : null; };
    const c4 = cs.find((c) => c.n === 4 && c.w === 2);
    const users = [];
    for (const cu of cs.filter((c) => c.n === 1 && c.w === 2)) {
      const sub = campos(u8, cu.a, cu.b); if (!sub) continue;
      const uid = sub.find((x) => x.n === 1 && x.w === 0), ts = sub.find((x) => x.n === 2 && x.w === 0);
      users.push({ uid: uid ? uid.v.toString() : null, ts: ts ? num(ts.v) : null });
    }
    return { conv, dias, inicio: pega(2), fuso: c4 ? texto(u8, c4) : null, restauravelAte: pega(5), restauracoes: pega(6), nivel: pega(7), users };
  }
  const temTag = (u8) => { for (let i = 0; i + 1 < u8.length; i++) if (u8[i] === TAG101[0] && u8[i + 1] === TAG101[1]) return true; return false; };
  // varre (até `prof` níveis) e devolve as sequências achadas; gz recebe os trechos gzip para abrir depois (assíncrono)
  function varrer(u8, ini, fim, prof, achadas, gz) {
    if (prof > 12) return;
    const cs = campos(u8, ini, fim);
    if (!cs) return;
    const s = comoSequencia(u8, cs);
    if (s) achadas.push(s);
    for (const c of cs) {
      if (c.w !== 2 || c.b - c.a < 2) continue;
      if (u8[c.a] === 0x1f && u8[c.a + 1] === 0x8b) { if (gz) gz.push(u8.slice(c.a, c.b)); continue; }
      varrer(u8, c.a, c.b, prof + 1, achadas, gz);
    }
  }
  function acharSequencias(u8, gz) {
    if (!(u8 instanceof Uint8Array)) u8 = new Uint8Array(u8);
    const achadas = [];
    if (u8.length >= 2 && u8[0] === 0x1f && u8[1] === 0x8b) { if (gz) gz.push(u8); return achadas; }
    if (!temTag(u8) && !gz) return achadas;
    varrer(u8, 0, u8.length, 0, achadas, gz);
    return achadas;
  }
  // versão completa: abre também os trechos gzip (websocket do TikTok pode vir comprimido)
  async function acharSequenciasTudo(u8) {
    const gz = [];
    const achadas = acharSequencias(u8, gz);
    for (const g of gz.slice(0, 8)) {
      try {
        if (typeof DecompressionStream === 'undefined') break;
        const ab = await new Response(new Blob([g]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
        achadas.push(...acharSequencias(new Uint8Array(ab)));
      } catch (_) {}
    }
    return achadas;
  }
  // para os testes: monta bytes de protobuf
  function codificar(campos) {
    const out = [];
    const vint = (v) => { v = BigInt(v); do { let b = Number(v & 0x7fn); v >>= 7n; if (v) b |= 0x80; out.push(b); } while (v); };
    for (const [n, w, v] of campos) {
      vint((BigInt(n) << 3n) | BigInt(w));
      if (w === 0) vint(v);
      else { const b = typeof v === 'string' ? Array.from(new TextEncoder().encode(v)) : Array.from(v); vint(b.length); out.push(...b); }
    }
    return new Uint8Array(out);
  }
  const api = { acharSequencias, acharSequenciasTudo, codificar, campos };
  globalThis.BRASA_PROTO = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})();
