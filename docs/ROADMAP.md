# Roadmap — fases

Status: ⬜ não iniciada · 📝 planejada (aguardando aprovação) · 🟨 em andamento · ✅ concluída

| Fase | Nome | Objetivo | Toca na TV? | Status |
|---|---|---|---|---|
| 0 | Fundação | Visão, arquitetura, regras de segurança, guia de trabalho, decisões | Não | ✅ |
| 1 | Descoberta adaptativa | Base do Studio (página local) + driver Android com ADB **somente leitura**: detectar qualquer TV, capacidades, inventário e snapshot | Só leitura | ✅ |
| 1.1 | Encontrar TVs na rede + refinamentos | Listar TVs da rede sem precisar olhar o IP na TV; tela usando a largura toda | Só leitura | ✅ |
| 2 | Núcleo de segurança p/ escrita | Dry-run, plano de mudanças, execução passo a passo, verificação e rollback | Não (simulado) | 🟨 |
| 3 | Limpeza de memória | Catálogo por camadas 🟢🟡🔴, aplicar/desfazer, medir antes/depois | Sim (reversível; TV real só após aprovação) | 🟨 |
| 4 | Launcher MVP | App de TV leve e adaptativo (resolução/RAM/API) que lê o perfil; assumir o Home | Sim (app comum) | ⬜ |
| 5 | Studio — editor visual | Prévia com arrastar-e-soltar e navegação simulada por controle | Não | ⬜ |
| 6 | Deploy | Publicar perfil + Launcher em 1 clique, verificação e rollback automático | Sim | ⬜ |
| 7 | Polimento | Temas, widgets, múltiplos perfis, levar perfil para outra TV | Sim | ⬜ |
| 8+ | Outras plataformas | Drivers webOS / Tizen / Fire TV com as capacidades possíveis | Sim | ⬜ |

## Por que essa ordem
- **Leitura antes de escrita**: a Fase 1 só observa — o Studio aprende a reconhecer qualquer TV antes de
  mudar qualquer coisa.
- **Segurança antes de funcionalidade**: a allowlist nasce na Fase 1 (só leitura) e a Fase 2 constrói as
  travas de escrita que todas as outras usam.
- **Ganho rápido**: a Fase 3 (limpeza) já deixa a TV mais leve mesmo antes do launcher existir.
- **Editor depois do launcher**: o editor só faz sentido quando sabemos o que o launcher consegue desenhar.

Cada fase terá seu plano detalhado em `docs/fases/` antes de começar.
