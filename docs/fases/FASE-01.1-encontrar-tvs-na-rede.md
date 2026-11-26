# Fase 1.1 — Encontrar TVs na rede + refinamentos da tela 🟨

**Objetivo:** o Studio lista sozinho as TVs da rede de casa, para o usuário não precisar ir até a TV
descobrir o IP; e a tela passa a usar melhor a largura do monitor, mantendo tudo simples.

**Fora de escopo:** conectar automaticamente (a autorização na TV continua obrigatória — é uma proteção do
Android), qualquer escrita na TV, abas laterais/menus complexos.

## Como a busca funciona (e por que é segura)
1. **Anúncios da própria TV (mDNS):** TVs Android/Google TV com Chromecast embutido se anunciam na rede
   (`_googlecast._tcp`) com nome e modelo ("TV da Sala", "Smart TV Pro"). TVs com "Depuração por Wi-Fi"
   também anunciam a porta ADB (`_adb-tls-connect._tcp`). O Studio só **pergunta** quem está na rede
   (consulta "legacy unicast": a resposta volta direto, sem precisar liberar porta no firewall).
2. **Porta de depuração (5555):** para cada IP da *sua* rede local (no máximo /24 = 254 endereços), o Studio
   tenta abrir e fechar na hora uma conexão TCP na porta 5555. Isso só diz "a depuração está ligada aqui"; não
   envia comando nenhum e não dispara o aviso na TV.
- Só redes privadas (10.x, 172.16–31.x, 192.168.x); adaptadores virtuais (WSL, Hyper-V, VirtualBox, Docker)
  ficam por último e no máximo 4 redes.
- Alto-falantes e grupos de som que também usam Chromecast são filtrados (não têm saída de vídeo).
- Nada sai da rede local; nada é gravado.

## Entregáveis
- [x] `core/discovery`: redes locais, teste de porta, consulta mDNS, junção dos resultados
- [x] Rota `POST /api/discover` (+ versão simulada no `dev:fake`)
- [x] Tela: "TVs encontradas na sua rede" no topo da conexão, com 1 clique para conectar; IP manual continua
- [x] Refinamentos: largura total da tela, cartões de resumo, apps ao lado das informações em telas largas
- [x] Testes unitários, de API e como usuário (Playwright)

## Etapas
1. Documentação (este plano) e Fase 1 marcada como concluída.
2. `core/discovery` com dependências injetáveis (rede, sockets) + testes.
3. Rota no servidor + descoberta simulada + testes.
4. Tela: lista de TVs encontradas + refinamentos de layout + testes e2e.
5. Teste exploratório como usuário (capturas de tela), correções com teste de regressão.

## Impacto na segurança
Nenhum comando ADB novo. A busca usa apenas consultas mDNS e aberturas de conexão TCP de leitura na rede
privada do próprio usuário.

## Critérios de aceite
- No modo simulado a lista mostra as TVs com nome e indica quais estão prontas para conectar.
- Clicar em "Conectar" numa TV encontrada leva ao mesmo fluxo de autorização da Fase 1.
- Sem TVs encontradas, a tela explica o que fazer e o IP manual continua disponível.
- CI verde no Windows e no Linux.

## Registro de execução
- Etapas 1–5 feitas. No teste como usuário, os cartões das TVs ficavam apertados (selo quebrando em duas
  linhas e nomes cortados) — reorganizados e conferidos em 1920px, 1280px e celular (sem rolagem lateral,
  agora coberto por teste e2e).
- A busca real não pôde ser testada aqui (o ambiente de desenvolvimento não tem rede doméstica);
  **falta o usuário confirmar na rede de casa** que a TV dele aparece na lista.
- **Bugs relatados pelo usuário ao atualizar** (todos com teste de regressão em `scripts/tests/` e
  `studio/server/tests/regression-bug-20261126-versao.test.ts`):
  1. `git pull` abortava porque o `npm install` no Windows reescrevia o `package-lock.json` → instalações
     agora usam `npm ci` e foi criado o `Atualizar-Studio.cmd`.
  2. Dependência nova não era instalada ao reabrir (o .cmd só instalava na primeira vez) → `scripts/preflight.mjs`
     confere e instala sozinho antes de abrir.
  3. Studio aberto durante a atualização continuava com a tela antiga sem avisar → aviso na tela + versão no rodapé.
