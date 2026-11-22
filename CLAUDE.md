# CLAUDE.md — TV Smart Adaptative

Guia de trabalho para o Claude (e para qualquer pessoa) neste repositório. **Leia antes de qualquer tarefa.**

## O que é o projeto

Um "estúdio" no computador para **montar a sua própria TV**: você desenha o layout da tela inicial,
escolhe apps, limpa o que pesa na memória e, quando estiver satisfeito, **envia para a TV** pela rede local.

- **Studio** (computador): editor visual + gerenciador de limpeza + backup/restauração + deploy.
- **Launcher** (TV): tela inicial leve, instalada como app comum, que lê o perfil enviado pelo Studio.
- **Perfil**: um arquivo JSON versionado que descreve a TV montada (layout, apps, tema, limpeza).

### Adaptativa a qualquer TV
O projeto **não é amarrado a marca nem modelo**. O Studio detecta a TV e se adapta a ela:
- **Driver por plataforma** (`AndroidTvDriver`, futuramente `WebOsDriver`, `TizenDriver`…), cada um
  declarando suas **capacidades** (ler inventário, limpar, instalar launcher, assumir Home…). A UI só mostra
  o que a TV conectada realmente suporta.
- **Catálogo por camadas**: regras comuns do Android → regras por marca (`ro.product.brand`) → regras por
  modelo. Pacote desconhecido = 🟡 "não recomendado", nunca 🟢 por padrão.
- **Launcher adaptativo**: ajusta-se à resolução, à memória (modo leve em TVs de pouca RAM) e à versão do
  Android.
- **Nada de código com nome de marca/modelo fixo** fora do catálogo (`shared/catalog/`).

Suporte completo começa por **Android TV / Google TV de qualquer marca**. Outras plataformas entram depois,
com as capacidades possíveis em cada uma (ver matriz em `docs/ARQUITETURA.md`). Roku não permite trocar a
tela inicial.

### Ambiente do usuário
- PC com **Windows** (o código e os scripts precisam funcionar no Windows; testar caminhos com `\` e `adb.exe`).
- Studio é uma **página local no navegador** servida por um servidor Node em `127.0.0.1`.

Documentos principais:
- `docs/VISAO.md` — o produto e a experiência do usuário
- `docs/ARQUITETURA.md` — componentes, stack e fluxo de dados
- `docs/SEGURANCA.md` — **regras invioláveis** de segurança da TV
- `docs/ROADMAP.md` — fases do projeto e status
- `docs/PESQUISA.md` — pesquisa e fontes
- `docs/fases/` — plano detalhado de cada fase

## Regras invioláveis de segurança (resumo de `docs/SEGURANCA.md`)

1. **Nada de root, bootloader, recovery, fastboot ou firmware.** Nunca.
2. **Nunca desinstalar app de sistema.** Só `pm disable-user --user 0` (reversível com `pm enable`).
3. **Snapshot antes de qualquer escrita** na TV (lista de pacotes + estados + configurações tocadas).
4. **Dry-run por padrão**: mostrar o que vai mudar e pedir confirmação explícita.
5. **Lista de comandos permitidos** (allowlist) na camada ADB: comando fora da lista é recusado.
6. **Lista de pacotes intocáveis** (entradas HDMI/antena, controle remoto, rede, Play Services, SystemUI,
   Configurações, instalador de pacotes…) — nunca desabilitar, nem com confirmação.
7. **O launcher original nunca é desinstalado.** Pode ser *desativado* (opção explícita do usuário, com
   aviso), mas sempre existe um caminho de volta (rollback em 1 clique). **Tudo precisa ser reversível.**
8. **Privacidade**: nenhum dado da TV sai da rede local. Sem telemetria. Perfis e chaves ADB ficam no PC.

O hook `.claude/hooks/adb-guard.mjs` bloqueia comandos perigosos de `adb`/`fastboot` executados pelo Claude.
Não desative esse hook.

## Como trabalhamos: sempre em fases

Toda mudança — e **obrigatoriamente** toda mudança ou atualização grande — é dividida em fases bem definidas.

Cada fase tem um arquivo `docs/fases/FASE-XX-nome.md` com:
- **Objetivo** (1–2 frases) e **fora de escopo**
- **Entregáveis** (lista verificável)
- **Etapas** numeradas, pequenas o suficiente para um commit cada
- **Critérios de aceite** (como sabemos que terminou)
- **Riscos** e impacto na segurança da TV
- **Testes** que serão criados

Fluxo:
1. Planejar a fase (use `/nova-fase`) e **confirmar com o usuário** antes de implementar.
2. Implementar etapa por etapa, com commit por etapa.
3. Testar como usuário padrão (ver abaixo).
4. Atualizar `docs/ROADMAP.md` com o status.

Na dúvida sobre uma decisão de produto ou algo que afete a TV: **pergunte ao usuário**, não suponha.

## Bugs: testar como usuário e prevenir regressão

- Depois de cada etapa, testar o fluxo **como um usuário padrão** usaria (clicar, navegar, conectar,
  desconectar no meio, entradas erradas, TV desligada, rede caindo).
- Encontrou bug → use `/reportar-bug`:
  1. Reproduzir e descrever (passos, esperado, obtido).
  2. **Escrever primeiro um teste automatizado que falha** reproduzindo o bug.
  3. Corrigir até o teste passar.
  4. O teste fica para sempre na suíte (pasta de regressão do componente), com referência ao bug.
- Nunca pular, desativar ou "afrouxar" teste para fazer a suíte passar.

## Convenções

- Idioma: documentação, mensagens de UI e commits em **português (BR)**; código (nomes) em inglês.
- Commits pequenos e descritivos: `fase-02: adiciona allowlist de comandos adb`.
- Toda interação com a TV passa pela camada `core/adb` (nunca chamar `adb` solto no código da UI).
- Testes nunca falam com uma TV real; usam o **dispositivo simulado** (`FakeTvDevice`).
- Estrutura planejada (monorepo):
  ```
  studio/core    regras de negócio e segurança (drivers, adb, inventário…) — sem UI
  studio/server  servidor local (127.0.0.1) que expõe o core para a página
  studio/web     página do Studio (React + Vite)
  launcher/      app Android TV (Kotlin + Compose for TV)
  shared/        schema do perfil (JSON Schema) e catálogos de pacotes
  docs/          visão, arquitetura, segurança, roadmap, fases
  .claude/       configurações, comandos e hooks do Claude
  ```

## Comandos

- Testes do hook de segurança: `node --test .claude/hooks/adb-guard.test.mjs`
- (Demais comandos serão adicionados conforme as fases forem implementadas.)
