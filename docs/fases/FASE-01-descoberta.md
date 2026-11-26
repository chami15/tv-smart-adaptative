# Fase 1 — Descoberta adaptativa (somente leitura) 🟨

**Objetivo:** abrir o Studio no navegador (Windows), conectar a **qualquer** Android TV / Google TV pela
rede, detectar automaticamente o que ela é e o que suporta, e salvar um inventário + snapshot no PC —
**sem alterar nada na TV**.

**Fora de escopo:** desativar apps, instalar o launcher, editor de layout, plataformas não-Android
(apenas a interface de driver fica pronta para elas).

## Entregáveis
- [x] Monorepo (npm workspaces): `studio/core`, `studio/server`, `studio/web`, `shared/`
- [x] `core/adb`: executor com **allowlist somente leitura**, validação de argumentos, timeout
- [x] `core/drivers`: interface `TvDriver` + `Capabilities`; `AndroidTvDriver` com detecção
- [x] `FakeTvDevice` com perfis simulados de várias marcas e cenários de falha
- [x] `core/inventory`: aparelho (marca, modelo, Android/API, Google TV ou Android TV, RAM, resolução,
      launcher atual), pacotes (sistema/usuário, ativo/desativado), memória por processo
- [x] `core/snapshot`: salva inventário em `%USERPROFILE%\TVSmartAdaptative\backups\<aparelho>\<data>\`
- [x] `studio/server`: 127.0.0.1 + token + Host/Origin
- [x] `studio/web`: assistente de conexão, tela "Minha TV" (inventário) — **nenhum botão de escrita**
- [x] `npm start` (Studio real) e `npm run dev:fake` (Studio com TV simulada)
- [x] CI GitHub Actions: Windows + Ubuntu
- [x] Ferramenta de exportar inventário **anonimizado** (para virar fixture de teste, com consentimento)

## Etapas (1 commit cada)
1. **Esqueleto do monorepo** — `package.json` raiz, TypeScript, Vitest, ESLint/Prettier, `.nvmrc` (Node 22),
   scripts compatíveis com Windows, CI com `windows-latest` e `ubuntu-latest`; CI também roda os testes
   do `adb-guard`.
2. **`core/adb` somente leitura** — `AdbExecutor` usando `execFile` (sem shell). Allowlist:
   `version`, `devices -l`, `connect <ip:porta>`, `disconnect`, `pair <ip:porta> <código>`,
   `shell getprop [chave]`, `shell pm list packages [-s|-3|-d|-e|-f|-U]`, `shell cat /proc/meminfo`,
   `shell dumpsys meminfo`, `shell wm size`, `shell wm density`,
   `shell cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME`.
   Validação: IP/porta, código de pareamento (6 dígitos), nomes de pacote. Timeout padrão. Localizar
   `adb.exe` (PATH ou configurado) com mensagem amigável se faltar.
3. **`FakeTvDevice`** — implementa a mesma interface do executor e responde a partir de fixtures:
   `tcl-googletv-2gb`, `philips-androidtv-9`, `xiaomi-mibox`, `sony-googletv-4k`, `generic-aosp`;
   cenários: TV desligada, conexão não autorizada (usuário não aceitou na TV), timeout, saída truncada/
   inesperada, queda no meio.
4. **Drivers + capacidades** — `TvDriver`, `Capabilities`, `AndroidTvDriver.detect()`
   (Android TV vs Google TV vs Fire OS por `getprop`/pacotes). Fire OS e não-Android: detectados e
   marcados "ainda não suportado" com explicação.
5. **Inventário** — parsers robustos (getprop, pm list, meminfo, wm size), modelo de dados
   `DeviceInventory`, classe de RAM (baixa/média/alta) e de resolução. Parsers nunca lançam exceção com
   saída estranha: devolvem campo "desconhecido".
6. **Snapshot** — grava JSON versionado + `packages.txt` legível; nome de pasta seguro no Windows; não
   sobrescreve snapshots antigos.
7. **Servidor local** — rotas `GET /api/status`, `POST /api/connect`, `POST /api/pair`,
   `GET /api/inventory`, `POST /api/snapshot`; somente 127.0.0.1; token; Host/Origin; erros traduzidos
   para português.
8. **Página: assistente de conexão** — passo a passo para ativar modo desenvolvedor e depuração
   (genérico para Android TV, com dicas por marca vindas do catálogo), campo de IP, pareamento por código,
   estados claros: "aceite na TV", "TV não encontrada", "adb não instalado".
9. **Página: Minha TV** — cartão do aparelho (marca, modelo, sistema, RAM, resolução, launcher atual),
   capacidades suportadas, lista de apps (sistema/usuário, ativo/desativado) com busca, botão
   "Salvar snapshot". Somente leitura.
10. **Testes como usuário (Playwright, TV simulada)** — fluxo feliz por marca simulada + fluxos de erro.
11. **Teste na sua TV real (manual, você executa)** — checklist abaixo; com seu consentimento, exportar o
    inventário anonimizado para virar fixture `real-user-01`.

## Impacto na segurança da TV
- **Nenhum comando de escrita.** A allowlist desta fase só tem leitura; qualquer outro comando é recusado
  pelo core (com teste provando a recusa).
- `connect`/`pair` só abrem a sessão ADB; a TV pede autorização na tela.
- Servidor não é acessível pela rede (127.0.0.1).

## Testes
- Unitários: allowlist (permite/recusa), validação de argumentos (injeção como `com.x; rm -rf /`),
  parsers com saídas reais e corrompidas, detecção de plataforma por fixture, nomes de pasta no Windows.
- Servidor: sem token → 401; `Host`/`Origin` estranhos → 403; erros do adb → mensagem amigável.
- Ponta a ponta (como usuário): conectar → ver inventário → salvar snapshot; TV desligada; usuário não
  aceita na TV; cabo de rede cai no meio; IP digitado errado; `adb.exe` ausente; atualizar a página no
  meio do fluxo; dois cliques rápidos em "Conectar".

## Checklist manual na TV real (você)
1. Ativar modo desenvolvedor e depuração na TV (o assistente explica).
2. `npm start` no Windows → o navegador abre o Studio.
3. Conectar pelo IP, aceitar na TV.
4. Conferir se marca/modelo/RAM/resolução batem com a TV.
5. Salvar snapshot e abrir a pasta no Explorer.
6. Confirmar que **nada mudou** na TV (tela inicial e apps iguais).

## Critérios de aceite
- Todos os testes passando no Windows e no Linux (CI).
- Studio reconhece todas as TVs simuladas e mostra capacidades corretas.
- Na sua TV real: inventário correto e snapshot salvo, sem nenhuma mudança na TV.

## Riscos e mitigação
| Risco | Mitigação |
|---|---|
| TV não aceita ADB pela rede sem USB antes | Assistente explica; pareamento por código (Android 11+) |
| Firewall do Windows bloqueia | Mensagem com instrução; adb só faz conexão de saída |
| Saídas de comando diferentes entre marcas | Parsers tolerantes + fixtures por marca + regressão |
| Vazamento de dados no fixture | Anonimizador com teste; só com consentimento |

**Rollback:** não há o que desfazer na TV nesta fase. Para "desconectar": `adb disconnect` e desligar a
depuração na TV.

## Registro de execução
- Etapas 1–11 implementadas, cada uma com commit próprio (4+5 e 8+9 juntas por dependência).
- Desvios do plano: ESLint ficou de fora (typecheck estrito + Prettier); comando extra na allowlist de leitura:
  `get-state` e `pm list features` (necessário para detectar TV sem depender de marca).
- **Bugs encontrados testando como usuário** (todos com teste de regressão):
  1. Campo de IP aceitava "tv da sala" como nome de host → `studio/web/tests/address.test.ts`.
  2. Backup de leitura corrompida era salvo como válido → `studio/core/tests/regression/bug-20261126-backup-de-inventario-corrompido.test.ts` (+ API + e2e).
  3. Exportador quebrava com backups antigos → `studio/core/tests/regression/bug-20261126-export-backup-antigo.test.ts`.
- Falta: etapa 11 manual — checklist na TV real do usuário (`docs/GUIA-USO.md`).
