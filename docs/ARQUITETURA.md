# Arquitetura (proposta — sujeita a confirmação na Fase 0)

```
┌──────────────────────── Computador ────────────────────────┐        ┌──────────── TV (Android TV) ───────────┐
│  Studio (UI)                                                 │        │                                        │
│   ├─ Assistente de conexão                                   │        │  Launcher TVSA (app comum, sem root)   │
│   ├─ Inventário + Limpeza                                    │  ADB   │   ├─ lê perfil.json                    │
│   ├─ Editor visual de layout (prévia 16:9)                   │ (LAN)  │   ├─ desenha fileiras/apps/tema        │
│   └─ Backup / Restauração / Deploy                           │◄──────►│   └─ atalhos p/ entradas HDMI          │
│                                                              │        │                                        │
│  Core (sem UI, 100% testável)                                │        │  Apps do sistema (só enable/disable)   │
│   ├─ adb/        cliente + ALLOWLIST de comandos             │        │                                        │
│   ├─ safety/     intocáveis, dry-run, snapshot, rollback     │        └────────────────────────────────────────┘
│   ├─ inventory/  pacotes, memória, info do dispositivo       │
│   ├─ debloat/    plano de limpeza + execução                 │
│   ├─ profile/    validação do perfil (JSON Schema)           │
│   └─ deploy/     instala APK, envia perfil, verifica         │
└──────────────────────────────────────────────────────────────┘
```

## Componentes

### Studio (computador)
- **Stack proposta:** TypeScript + Node.js; UI em React rodando como app desktop (Electron ou Tauri —
  decidir na Fase 0) ou, na primeira versão, como site local (`localhost`).
- **Core separado da UI**: toda regra de negócio e segurança fica no core, sem dependência de interface,
  para ser testada com o `FakeTvDevice`.
- **ADB**: usa o `adb` oficial do Android Platform-Tools (baixado/verificado pelo Studio) chamado por
  uma única classe com allowlist. Nada mais no código executa comandos na TV.

### Launcher (TV)
- **Stack proposta:** Kotlin + Jetpack Compose for TV (`androidx.tv`), minSdk compatível com Android TV 9+.
- Instalado como **app comum** (`adb install`), nunca como app de sistema.
- Lê o perfil de um local próprio do app (enviado pelo Studio). Se o perfil for inválido, usa o último
  perfil válido; se não houver, usa um layout padrão simples. **Nunca trava a tela inicial.**
- Meta de memória: bem abaixo do launcher padrão (medir na Fase 1 para definir o número).
- Sem permissão de internet na primeira versão (privacidade e leveza).

### Perfil (`shared/profile.schema.json`)
JSON versionado (`schemaVersion`) com: tema, papel de parede, relógio, fileiras (título + lista de apps),
atalhos de entrada, e o plano de limpeza. Validado no Studio **e** no Launcher.

### Catálogos (`shared/catalog/`)
Classificação de pacotes conhecidos em 🟢/🟡/🔴 com descrição em português e efeitos colaterais.
O 🔴 (intocáveis) é aplicado no core e não pode ser sobrescrito pela UI.

## Como trocar a tela inicial sem root (a decidir na Fase 4, ver PESQUISA.md)
1. **Preferido:** manter o launcher original instalado e ativo; o Launcher TVSA assume a tecla Home
   (seleção de "home padrão" quando o sistema permitir, ou serviço de acessibilidade que intercepta Home).
2. **Alternativo (com aviso):** desabilitar o launcher padrão (`pm disable-user`), cientes de que a busca
   por voz/Assistente e algumas teclas do controle podem parar, e de que existe um "fallback" do sistema
   que pode reativá-lo.

## Testes
- **Core:** testes unitários (Vitest ou `node:test`) contra o `FakeTvDevice`, que simula pacotes,
  memória, falhas de rede e respostas do `adb`.
- **UI:** testes ponta a ponta com Playwright simulando um usuário real.
- **Launcher:** testes de unidade (JUnit) e de interface (Compose UI test) com navegação por D-pad.
- **Regressão:** cada bug encontrado vira um teste em `**/tests/regression/`.
