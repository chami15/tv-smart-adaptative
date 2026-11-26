# Segurança da TV — regras invioláveis

O objetivo é que **nenhuma ação do projeto possa danificar a TV, seus dados, a conexão ou o hardware**.
Estas regras valem para o código do Studio, do Launcher **e** para o Claude ao trabalhar no repositório.

## 1. O que nunca fazemos
| Proibido | Por quê |
|---|---|
| `su`, `adb root`, desbloquear bootloader, `fastboot`, recovery, gravar firmware/partições | Pode inutilizar a TV (brick) e anula garantia |
| `pm uninstall` (inclusive `-k --user 0`) em app de sistema | Difícil de reverter; usamos apenas `disable-user` |
| `rm`, `dd`, `wipe`, `format`, `pm clear` em apps de sistema, reset de fábrica | Perda de dados irreversível |
| `settings put` fora de uma lista explícita e revisada | Pode quebrar rede, imagem, som ou configurações regionais |
| Alterar rede, Wi-Fi, DNS, proxy, Bluetooth da TV | Risco de perder a conexão e o acesso |
| Mexer em brilho de fábrica, tensão, temperatura, overclock, modos de serviço do painel | Risco ao hardware |
| Enviar qualquer dado da TV para fora da rede local | Privacidade |

## 2. O que é permitido (allowlist inicial)
Somente leitura:
- `getprop [chave]`, `pm list packages [-s|-3|-d|-e|-f|-U]`, `pm list features`, `dumpsys meminfo`,
  `cat /proc/meminfo`, `wm size`, `wm density`, `cmd package resolve-activity` (home atual), `get-state`
- Conexão: `version`, `devices -l`, `connect`, `disconnect`, `pair`
- Implementado em `studio/core/src/adb/allowlist.ts` (somente leitura)

Escrita (desde a Fase 2) — `studio/core/src/adb/write-allowlist.ts`, lista **separada**:
- `pm disable-user --user 0 <pkg>` e `pm enable <pkg>`; intocáveis do núcleo nunca são desativados
- Só executável com um `WriteGrant` derivado de um plano validado, que libera exatamente os comandos dele
- Na **TV real**, executar planos fica bloqueado até liberação explícita do usuário (`TVSA_ALLOW_REAL_WRITES=1`);
  desfazer mudanças do próprio Studio é sempre permitido

Escrita (sempre com snapshot + dry-run + confirmação):
- `pm disable-user --user 0 <pkg>` / `pm enable <pkg>` — somente pacotes fora da lista 🔴
- `install -r <apk>` / `uninstall <pkg>` — **somente** o próprio Launcher TVSA
- `push` — somente para a pasta de dados do Launcher TVSA
- `am start` / `am force-stop` — para abrir o Launcher ou parar um app de forma temporária
- Definir home padrão — somente quando o sistema expõe um mecanismo suportado (Fase 4)
- Desativar o launcher original e seu fallback — **somente** por escolha explícita do usuário, com aviso
  dos efeitos (busca por voz pode parar) e desfazer disponível na mesma tela

Todos os argumentos são validados (nome de pacote por regex, IP:porta, caminho do APK dentro da pasta do
projeto) e passados como lista para `execFile`, nunca montados numa string de shell.

Qualquer comando fora da allowlist é **recusado pelo core**, não importa de onde venha.

## 3. Pacotes intocáveis (🔴) — lista inicial, por camadas (android → marca → modelo)
- Entradas e sintonizador: `com.android.tv.settings`, `com.android.tv` (Live TV/entradas), e os de cada
  marca — ex.: TCL `com.tcl.tv`, `com.tcl.tvinput`; chipsets `com.droidlogic.*`/`com.mediatek.*`
  relacionados a TV input (confirmar no inventário)
- Controle remoto: `com.google.android.tv.remote.service`, serviços Bluetooth
- Núcleo: `android`, `com.android.systemui`, `com.android.settings`, `com.android.providers.*`,
  `com.android.packageinstaller`/`com.google.android.packageinstaller`, `com.android.shell`
- Google: `com.google.android.gms`, `com.google.android.gsf`
- Rede: `com.android.networkstack*`, `com.android.wifi*`
- Atualização/fallback de launcher: `com.google.android.tungsten.setupwraith` (tratado à parte na Fase 4)

A lista definitiva fica em `shared/catalog/`. Marca/modelo desconhecido não "herda" liberações de outra
marca: tudo que não está no catálogo é 🟡 e exige confirmação individual.

## 3.1 Segurança do próprio Studio (página local)
- Servidor escuta **somente em `127.0.0.1`** (nunca `0.0.0.0`): ninguém da rede acessa o Studio.
- Token aleatório por execução + validação de `Host` e `Origin` em toda requisição.
- Backups e chaves ADB ficam no PC do usuário (`%USERPROFILE%`), fora do repositório.
- Inventários usados como fixture de teste passam por anonimização (sem número de série, MAC, IP, contas).

## 4. Fluxo obrigatório para qualquer escrita (implementado em `studio/core/src/changes/executor.ts`)
1. **Snapshot**: salvar no PC (`backups/<data>/`) a lista de pacotes com estado, home atual, versão do
   sistema e o perfil ativo.
2. **Plano (dry-run)**: gerar a lista exata de comandos e mostrar ao usuário em linguagem simples.
3. **Confirmação explícita**.
4. **Execução passo a passo**, parando no primeiro erro.
5. **Verificação**: a TV continua respondendo? O home abre? As entradas existem?
6. **Rollback automático** se a verificação falhar; rollback manual disponível sempre.

## 5. Proteção no próprio repositório
- `.claude/hooks/adb-guard.mjs` bloqueia comandos perigosos de `adb`/`fastboot` antes de executarem,
  com testes em `.claude/hooks/adb-guard.test.mjs`.
- `.claude/settings.json` reforça com regras de `deny`.
- Testes automatizados nunca conversam com uma TV real.
