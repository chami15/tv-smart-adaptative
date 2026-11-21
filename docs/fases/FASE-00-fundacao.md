# Fase 0 — Fundação

**Objetivo:** deixar o projeto pronto para começar com segurança: visão, arquitetura, regras, forma de
trabalho e proteção do Claude contra comandos perigosos.

**Fora de escopo:** qualquer código que fale com a TV.

## Entregáveis
- [x] `CLAUDE.md` com regras de segurança, trabalho em fases e fluxo de bugs
- [x] `docs/` — VISAO, ARQUITETURA, SEGURANCA, ROADMAP, PESQUISA
- [x] `.claude/settings.json` com regras `deny` e hook de segurança
- [x] `.claude/hooks/adb-guard.mjs` + testes automatizados
- [x] `.claude/commands/nova-fase.md` e `reportar-bug.md`
- [ ] Respostas do usuário às perguntas abaixo
- [ ] Stack do Studio confirmada e registrada em `ARQUITETURA.md`

## Etapas
1. Pesquisa e documentação inicial ✅
2. Configuração `.claude/` + hook + testes ✅
3. Validar decisões com o usuário ⬜
4. Planejar a Fase 1 (`docs/fases/FASE-01-descoberta.md`) ⬜

## Perguntas para o usuário
1. Modelo exato da TV (etiqueta atrás ou Configurações → Sobre) e se é Google TV, Android TV ou Roku.
2. Sistema do computador (Windows / macOS / Linux).
3. Preferência de app: desktop instalável (Electron/Tauri) ou começar como página local no navegador?
4. Topa desativar o launcher original se for a única forma, sabendo que a busca por voz pode parar?

## Critérios de aceite
- `node --test .claude/hooks/adb-guard.test.mjs` passando.
- Usuário revisou e aprovou visão, regras de segurança e roadmap.

## Riscos
- Nenhum para a TV (fase só de documentação).
