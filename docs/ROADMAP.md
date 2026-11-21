# Roadmap — fases

Status: ⬜ não iniciada · 🟨 em andamento · ✅ concluída

| Fase | Nome | Objetivo | Toca na TV? | Status |
|---|---|---|---|---|
| 0 | Fundação | Visão, arquitetura, regras de segurança, guia de trabalho, decisões de stack | Não | 🟨 |
| 1 | Descoberta (somente leitura) | Conectar via ADB e gerar inventário + snapshot da TV real | Só leitura | ⬜ |
| 2 | Núcleo de segurança | Camada ADB com allowlist, intocáveis, dry-run, snapshot/rollback, `FakeTvDevice` | Não (simulado) | ⬜ |
| 3 | Limpeza de memória | Catálogo 🟢🟡🔴, plano de limpeza, aplicar/desfazer, medir antes/depois | Sim (reversível) | ⬜ |
| 4 | Launcher MVP | App de TV leve que lê um perfil JSON; estratégia para assumir o Home | Sim (app comum) | ⬜ |
| 5 | Studio — editor visual | Prévia 16:9 com arrastar-e-soltar e navegação simulada por controle | Não | ⬜ |
| 6 | Deploy | Publicar perfil + Launcher em 1 clique, verificação e rollback automático | Sim | ⬜ |
| 7 | Polimento | Temas, widgets (relógio, clima offline?), múltiplos perfis, desempenho | Sim | ⬜ |

## Por que essa ordem
- **Leitura antes de escrita**: a Fase 1 só observa — conhecemos a TV real antes de mudar qualquer coisa.
- **Segurança antes de funcionalidade**: a Fase 2 constrói as travas que todas as outras usam.
- **Ganho rápido**: a Fase 3 (limpeza) já deixa a TV mais leve mesmo antes do launcher existir.
- **Editor depois do launcher**: o editor só faz sentido quando sabemos o que o launcher consegue desenhar.

Cada fase terá seu plano detalhado em `docs/fases/` antes de começar.
