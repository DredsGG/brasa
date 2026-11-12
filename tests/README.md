# Testes da Brasa

Playwright 1.63 + Chromium, perfil novo e temporário em cada rodada (nunca um perfil de verdade). `npm i` uma vez nesta pasta.
`BRASA_NAV=edge` ou `BRASA_NAV=brave` roda os mesmos testes no navegador instalado (Windows).
A extensão vem de `../extension` (no repo) ou `../instalada` (no PC de quem desenvolve).

| Teste | O quê | Onde |
|---|---|---|
| `node i18n-teste.mjs` | PT/EN/ES com as mesmas chaves, Novidades, descrição ≤ 132 | Node |
| `node guarda-regras-teste.mjs` | regras do guarda-foguinho e leitor de protobuf | Node |
| `node e2e-base.mjs` | botão, menu, popup, rodapé, tutorial, aviso de versão nova, Apoiar, gancho do feed | TikTok simulado |
| `node e2e-foco.mjs` | modo foco (fetch e XHR), contador, barra lateral inteira clicável, plano B | TikTok simulado |
| `node e2e-guarda.mjs` | guarda-foguinho **só com as Mensagens simuladas** (nada é enviado de verdade) | Mensagens simuladas |
| `node e2e-grupos.mjs` | guarda-foguinho em grupos e a lista da aba Foguinho | Mensagens simuladas |
| `node e2e-baixar.mjs` | baixar (CDN simulado recusa sem o Referer do site, como o real) | TikTok simulado |
| `node e2e-auto.mjs` | rolagem automática e travas | TikTok simulado |
| `node e2e-coment.mjs` | comentários abertos no Para você, Seguindo e Amigos | TikTok simulado |
| `node e2e-conta.mjs` | Trocar de conta pelo Sair do TikTok (simulado: ninguém sai de conta nenhuma) | TikTok simulado |
| `node e2e-engaja.mjs` | Curtir/Seguir sozinho: nunca desfaz, ritmo e teto do dia; Rolagem automática do TikTok escondida | TikTok simulado |
| `node e2e-entrada.mjs` | entrada direta que cai num vídeo solto ("Você pode gostar") vai para o Para você; link de fora fica e abre Comentários | TikTok simulado |
| `node e2e-navegador.mjs` | o vídeo aberto de uma grade (perfil, Explorar, busca): bloco, Baixar, Auto (vídeo e carrossel), Curtir/Seguir | TikTok simulado |
| `node recarga-e2e.mjs` | reinjeção e recarga pela pasta esperando o envio (≈2 min) | TikTok simulado |
| `node ao-vivo.mjs light\|dark` | tiktok.com real, **sem login**: botão, modo foco, download real, rolagem real | site real |
| `node navegadores-teste.mjs` | carrega nos Chromium instalados (Chromium, Edge, Brave; Chrome e Opera GX se houver) | — |
| `node desempenho.mjs 10 com\|sem` | 10 min de feed real com e sem a Brasa (CPU, heap, nós) | site real |
| `node prints-github.mjs [pasta]` | os prints do README, no TikTok simulado e em inglês | TikTok simulado |

`bash rodar.sh <testes…>` roda vários em paralelo e resume. Cada um termina em `TUDO PASSOU`.

O vídeo de teste (`media/clip.webm`) foi gerado com ffmpeg (testsrc2 + seno de 440 Hz), sem conteúdo de terceiros. A fixture do feed (`fixtures/feed.json`) tem o formato das respostas medidas no site sem login, com **todos** os criadores, legendas, sons, efeitos e ids trocados por dados inventados, mais itens sintéticos (anúncio, LIVE, loja) com os campos que o próprio TikTok usa. As conversas das Mensagens simuladas (`mock-dm.mjs`) também são inventadas.
