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
- `getprop`, `pm list packages [-s|-3|-d|-e]`, `dumpsys meminfo`, `dumpsys package <pkg>`,
  `cat /proc/meminfo`, `wm size`, `cmd package resolve-activity` (consultar home atual)

Escrita (sempre com snapshot + dry-run + confirmação):
- `pm disable-user --user 0 <pkg>` / `pm enable <pkg>` — somente pacotes fora da lista 🔴
- `install -r <apk>` / `uninstall <pkg>` — **somente** o próprio Launcher TVSA
- `push` — somente para a pasta de dados do Launcher TVSA
- `am start` / `am force-stop` — para abrir o Launcher ou parar um app de forma temporária
- Definir home padrão — somente quando o sistema expõe um mecanismo suportado (Fase 4)

Qualquer comando fora da allowlist é **recusado pelo core**, não importa de onde venha.

## 3. Pacotes intocáveis (🔴) — lista inicial, revisada a cada modelo
- Entradas e sintonizador: `com.tcl.tv`, `com.tcl.tvinput`, `com.android.tv.settings`,
  `com.droidlogic.*`/`com.mediatek.*` relacionados a TV input (confirmar por modelo)
- Controle remoto: `com.google.android.tv.remote.service`, serviços Bluetooth
- Núcleo: `android`, `com.android.systemui`, `com.android.settings`, `com.android.providers.*`,
  `com.android.packageinstaller`/`com.google.android.packageinstaller`, `com.android.shell`
- Google: `com.google.android.gms`, `com.google.android.gsf`
- Rede: `com.android.networkstack*`, `com.android.wifi*`
- Atualização/fallback de launcher: `com.google.android.tungsten.setupwraith` (tratado à parte na Fase 4)

A lista definitiva vem do inventário real da TV do usuário (Fase 1) e fica em `shared/catalog/`.

## 4. Fluxo obrigatório para qualquer escrita
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
