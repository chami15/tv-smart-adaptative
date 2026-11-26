# Fase 2 — Núcleo de segurança para escrita 🟨

> Aprovada em 26/11/2026 com a opção B: emendar direto na Fase 3 (TV real só após aprovação).

**Objetivo:** construir o "motor de mudanças" que todas as próximas fases vão usar: toda alteração na TV vira
um **plano** revisável, com backup antes, execução passo a passo, conferência depois de cada passo e
**desfazer automático** se algo der errado — inclusive se a energia ou a rede cair no meio.

**Fora de escopo:** a tela de limpeza (Fase 3), instalar launcher (Fase 4). Nesta fase o motor é testado
**somente na TV simulada**; nenhuma mudança é feita na TV real.

## Como vai funcionar (visão do usuário, a partir da Fase 3)
1. Você escolhe o que mudar → o Studio mostra o **plano** em português ("Desativar *TCL Guard* — libera ~30 MB.
   Para desfazer: reativar.").
2. Você confirma → o Studio salva um **backup** e executa um passo por vez, conferindo cada um.
3. Falhou algo? Ele **desfaz sozinho** o que já tinha feito e explica o motivo.
4. A qualquer momento: **"Restaurar TV"** a partir de qualquer backup.

## Entregáveis
- [ ] Catálogo de segurança por camadas: `shared/catalog/android.json` + `brands/*.json` com 🔴 intocáveis
      (entradas HDMI/antena, controle, rede, Play Services, SystemUI, Configurações, instalador…)
- [ ] `core/changes`: modelo de **plano** (ações, descrição, como desfazer) e **validador** que recusa 🔴
- [ ] Allowlist de **escrita** separada da de leitura: `pm disable-user --user 0 <pkg>` e `pm enable <pkg>`,
      utilizável **só** pelo executor de planos aprovados (a camada de leitura continua recusando)
- [ ] **Diário de execução** gravado no PC a cada passo: se o Studio/PC/TV cair no meio, ao abrir de novo
      aparece "Há uma mudança incompleta — desfazer?"
- [ ] Executor: backup obrigatório → passo → conferência → próximo; erro → desfaz em ordem inversa
- [ ] **Checagem de saúde** depois do plano: TV responde, tela inicial resolve, intocáveis seguem ativos
- [ ] **Restaurar a partir de backup**: calcula a diferença backup × agora e gera um plano (também revisável)
- [ ] API: `POST /api/plan` (só calcula), `POST /api/plan/execute`, `GET /api/journal`, `POST /api/restore/plan`
- [ ] `FakeTvWorld` com escrita simulada e falhas injetáveis

## Etapas (1 commit cada)
1. Catálogo de intocáveis por camadas + resolvedor (android → marca → modelo) + testes.
2. Modelo de plano + validador (recusa intocáveis, pacote inexistente, ação repetida, plano vazio).
3. Allowlist de escrita separada + `WriteGate` que só aceita ações de um plano validado; adb-guard revisado.
4. Escrita simulada no `FakeTvWorld` (estado muda de verdade) + falhas injetáveis (falha no passo N,
   rede cai no meio, TV reinicia, resposta estranha).
5. Diário de execução (gravação atômica no Windows) + retomada/desfazer de mudança incompleta.
6. Executor com conferência por passo e desfazer automático + checagem de saúde.
7. Restaurar a partir de backup (diferença → plano).
8. Rotas da API + testes de segurança (token, plano adulterado entre "calcular" e "executar" é recusado).
9. Teste de "caos": centenas de planos aleatórios com falhas aleatórias → a TV simulada sempre termina
   **igual ao começo** ou **igual ao planejado**, nunca no meio.

## Impacto na segurança da TV
- Primeira vez que comandos de escrita entram na allowlist — **só** `disable-user`/`enable`, que são
  reversíveis e não apagam dados.
- Intocáveis aplicados no core: nem a interface nem a API conseguem pedir para desativá-los.
- Plano assinado (hash) entre "calcular" e "executar": o que você viu é exatamente o que é executado.

## Testes
- Unitários de catálogo, validador, diário, executor e restauração.
- Injeção de falhas em cada passo, queda de rede, Studio fechado no meio (diário retomado).
- Teste de caos (propriedade: nunca termina em estado intermediário).
- API: sem token, plano alterado, plano com intocável, execução duplicada (duplo clique).

## Critérios de aceite
- Todos os testes verdes no Windows e no Linux.
- Nenhum caminho do código consegue enviar `disable-user` sem plano validado + backup salvo.

## Riscos
| Risco | Mitigação |
|---|---|
| Pacote essencial de uma marca não estar no catálogo | Desconhecido = 🟡 (nunca 🟢); checagem de saúde depois; desfazer automático |
| Queda de energia no meio | Diário no PC + desfazer ao reabrir; ações são reversíveis por natureza |
| TV reiniciar e "esquecer" algo | `disable-user` persiste após reiniciar; conferência pós-plano |
