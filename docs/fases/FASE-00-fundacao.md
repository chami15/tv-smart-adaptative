# Fase 0 — Fundação ✅

**Objetivo:** deixar o projeto pronto para começar com segurança: visão, arquitetura, regras, forma de
trabalho e proteção do Claude contra comandos perigosos.

**Fora de escopo:** qualquer código que fale com a TV.

## Entregáveis
- [x] `CLAUDE.md` com regras de segurança, trabalho em fases e fluxo de bugs
- [x] `docs/` — VISAO, ARQUITETURA, SEGURANCA, ROADMAP, PESQUISA
- [x] `.claude/settings.json` com regras `deny`/`ask` e hook de segurança
- [x] `.claude/hooks/adb-guard.mjs` + testes automatizados (inclui caminhos do Windows)
- [x] `.claude/commands/nova-fase.md` e `reportar-bug.md`
- [x] Respostas do usuário às perguntas
- [x] Stack do Studio registrada em `ARQUITETURA.md`

## Decisões do usuário
1. **Adaptativa a qualquer TV** — não focar no modelo do usuário (que é Android/Google TV).
2. PC com **Windows**.
3. Studio como **página local no navegador**.
4. Pode **desativar o launcher original** (não usa busca por voz), sempre de forma reversível.

## Consequências registradas
- Arquitetura de **drivers + capacidades** e **catálogo por camadas** (android → marca → modelo).
- Matriz de plataformas: Android TV/Google TV primeiro; webOS/Tizen/Fire TV depois; Roku fora.
- Servidor local só em `127.0.0.1` com token e checagem de Host/Origin.
- CI obrigatória em Windows.

## Critérios de aceite
- [x] `node --test .claude/hooks/adb-guard.test.mjs` passando.
- [x] Usuário revisou e respondeu às decisões.
