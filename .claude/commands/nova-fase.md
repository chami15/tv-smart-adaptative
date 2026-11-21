---
description: Planeja uma nova fase (ou mudança grande) antes de implementar
argument-hint: <número e nome da fase ou descrição da mudança>
---

Planeje a fase: $ARGUMENTS

1. Leia `CLAUDE.md`, `docs/SEGURANCA.md`, `docs/ROADMAP.md` e o plano da fase anterior em `docs/fases/`.
2. Se faltar informação para decidir algo de produto ou que afete a TV, **pergunte ao usuário** antes.
3. Crie `docs/fases/FASE-XX-nome.md` com:
   - **Objetivo** (1–2 frases) e **Fora de escopo**
   - **Entregáveis** (checklist verificável)
   - **Etapas** numeradas, cada uma pequena o bastante para um commit, com os arquivos que serão tocados
   - **Impacto na segurança da TV**: quais comandos novos entram na allowlist (se algum) e por quê
   - **Testes**: unitários, ponta a ponta (como usuário) e cenários de falha (TV desligada, rede caiu,
     usuário cancelou no meio)
   - **Critérios de aceite**
   - **Riscos e plano de rollback**
4. Atualize `docs/ROADMAP.md` (status 🟨 quando aprovado).
5. Apresente o plano resumido ao usuário e **aguarde aprovação** antes de implementar.
