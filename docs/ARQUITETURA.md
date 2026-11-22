# Arquitetura

## Visão geral

```
┌──────────────────────────── PC (Windows) ────────────────────────────┐        ┌────────── Qualquer TV ──────────┐
│  Navegador → http://127.0.0.1:<porta>  (studio/web — React + Vite)    │        │                                 │
│        ▲  token de sessão + checagem de Host/Origin                   │        │  Android TV / Google TV         │
│        ▼                                                              │        │   (TCL, Philips, Sony, Xiaomi,  │
│  studio/server (Node, só escuta em 127.0.0.1)                          │  LAN   │    Hisense, Semp, AOC…)         │
│        ▼                                                              │◄──────►│   └─ Launcher TVSA (app comum)  │
│  studio/core (TypeScript, sem UI, 100% testável)                      │  ADB   │                                 │
│   ├─ drivers/     AndroidTvDriver (futuro: WebOs, Tizen…)              │        │  (futuro) webOS / Tizen         │
│   │                └─ declara Capabilities                             │        └─────────────────────────────────┘
│   ├─ adb/         executa adb.exe com ALLOWLIST + validação de args    │
│   ├─ safety/      intocáveis, dry-run, snapshot, rollback              │
│   ├─ inventory/   info do aparelho, pacotes, memória, home atual       │
│   ├─ catalog/     resolve 🟢🟡🔴 por camadas (android → marca → modelo) │
│   ├─ debloat/     plano de limpeza + execução reversível               │
│   ├─ profile/     validação do perfil (JSON Schema)                    │
│   └─ deploy/      instala APK, envia perfil, verifica, rollback        │
│                                                                       │
│  %USERPROFILE%\TVSmartAdaptative\  backups, perfis (nunca no repo)     │
└───────────────────────────────────────────────────────────────────────┘
```

## Adaptatividade

### 1. Drivers e capacidades
Cada plataforma tem um driver que implementa a mesma interface e declara o que consegue fazer:

```ts
interface Capabilities {
  readInventory: boolean;     // listar apps, memória, info
  disableApps: boolean;       // desativar/reativar apps (reversível)
  installLauncher: boolean;   // instalar o Launcher TVSA
  takeOverHome: 'native' | 'disable-stock' | 'none'; // como assumir o botão Home
  pushProfile: boolean;
}
```
A UI é montada a partir das capacidades: o que a TV não suporta não aparece (ou aparece explicado).

### 2. Matriz de plataformas
| Plataforma | Conexão | Inventário | Limpeza | Launcher próprio | Assumir Home | Quando |
|---|---|---|---|---|---|---|
| Android TV / Google TV (qualquer marca) | ADB (rede) | ✅ | ✅ `disable-user` | ✅ APK | ✅ (nativo ou desativando o original, reversível) | Fases 1–6 |
| Fire TV (Fire OS) | ADB | ✅ | ✅ | ✅ | ⚠️ limitado pela Amazon | Futuro |
| LG webOS | Developer Mode (sessão expira) | parcial | ❌ | ✅ app | ❌ sem root | Futuro |
| Samsung Tizen | Developer Mode | parcial | ❌ | ✅ app (2024+ exige certificado Samsung) | ⚠️ exige mudar config de sistema — avaliar | Futuro |
| Roku | — | — | ❌ | ❌ | ❌ | Fora |

### 3. Catálogo por camadas (`shared/catalog/`)
```
android.json            pacotes AOSP/Google comuns a qualquer Android TV
brands/<marca>.json     ex.: tcl.json, philips.json (detectado por ro.product.brand/manufacturer)
models/<modelo>.json    exceções de um modelo específico (raro)
```
Ordem de resolução: modelo → marca → android → **padrão 🟡 desconhecido**. A camada 🔴 (intocáveis) é
somada de todas as camadas e nunca pode ser rebaixada por uma camada mais específica.

### 4. Launcher adaptativo
- Resolução (720p / 1080p / 4K) → escala da grade e dos ícones.
- Memória (`/proc/meminfo`) → **modo leve** abaixo de ~2 GB: sem animações, papel de parede sólido ou
  imagem reduzida, menos itens carregados.
- Versão do Android (API) → usa só recursos disponíveis.

## Componentes

### Studio — página local
- **Node.js 22 LTS + TypeScript**, monorepo com npm workspaces.
- `studio/server`: escuta **somente em `127.0.0.1`**; exige token aleatório gerado a cada execução
  (aberto automaticamente no navegador) e valida `Host`/`Origin` para impedir que outros sites chamem a API
  (proteção contra CSRF e DNS rebinding).
- `studio/web`: React + Vite.
- **ADB**: usa o `adb.exe` oficial do Android SDK Platform-Tools. O Studio procura no `PATH` ou num caminho
  configurado; se não encontrar, explica como baixar do site oficial do Google.
- Comandos executados com `execFile` + lista de argumentos (**nunca** via shell / string concatenada).
- Dados do usuário em `%USERPROFILE%\TVSmartAdaptative\` (backups, perfis). Nada vai para o repositório.

### Launcher (Android TV)
- Kotlin + Jetpack Compose for TV (`androidx.tv`), minSdk 28 (Android TV 9) — confirmar com dados reais.
- Instalado como app comum. Sem permissão de internet na v1.
- Perfil inválido → usa o último válido → senão layout padrão. **Nunca trava a tela inicial.**
- Nativo (e não web) porque o objetivo é consumir **menos memória** que o launcher original. O perfil é
  neutro de plataforma, para que um launcher web (webOS/Tizen) possa ler o mesmo arquivo no futuro.

### Assumir o botão Home (Android)
1. **Nativo:** se o sistema oferece a escolha de tela inicial padrão, usamos.
2. **Desativando o original (opção do usuário, aceita):** `pm disable-user` no launcher original e no seu
   "fallback" (ex.: `setupwraith` no Google TV), com snapshot antes. Reverter = `pm enable` dos dois.
   Avisar: busca por voz/Assistente pode parar; testar botões do controle; se algum botão parar, oferecer
   desfazer na hora.

## Testes
- **Core:** Vitest contra o `FakeTvDevice` (simula vários aparelhos/marcas, falhas e saídas estranhas).
- **Server:** testes de API (token, Host/Origin, erros).
- **Web:** Playwright simulando um usuário real, com o servidor ligado ao `FakeTvDevice`.
- **Launcher:** JUnit + Compose UI test com navegação por D-pad.
- **CI:** GitHub Actions em `windows-latest` (obrigatório) e `ubuntu-latest`.
- **Regressão:** cada bug vira um teste em `**/tests/regression/`.
