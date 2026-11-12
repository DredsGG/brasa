#!/usr/bin/env bash
# Roda os testes pedidos em paralelo e resume. Uso: bash rodar.sh i18n-teste e2e-base recarga-e2e ao-vivo
cd "$(dirname "$0")"; mkdir -p shots
for t in "$@"; do ( timeout 900 node "$t.mjs" > "shots/$t.log" 2>&1; echo "EXIT $?" >> "shots/$t.log" ) & done; wait
for t in "$@"; do echo "== $t"; grep -E "✘|checagens|EXIT|Error|TimeoutError" "shots/$t.log"; done
