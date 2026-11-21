---
description: Registra um bug, cria o teste de regressão que falha e então corrige
argument-hint: <descrição curta do bug>
---

Bug: $ARGUMENTS

Siga exatamente esta ordem:

1. **Reproduzir como usuário padrão.** Descreva: passos, resultado esperado, resultado obtido, ambiente
   (componente, versão, simulado ou TV real).
2. **Teste primeiro.** Crie um teste automatizado em `<componente>/tests/regression/` com nome
   `bug-<AAAAMMDD>-<slug>` e um comentário no topo com a descrição do bug. Rode e confirme que **falha**
   pelo motivo certo. Se envolver a TV, use o `FakeTvDevice` — nunca uma TV real.
3. **Corrigir** a causa (não o sintoma) até o teste passar.
4. Rodar a suíte inteira; nada pode quebrar. Nunca pular/desativar testes.
5. Se o bug tinha relação com segurança da TV, revisar `docs/SEGURANCA.md` e o `adb-guard`.
6. Commit: `fix(<componente>): <resumo> + teste de regressão`.
7. Resumir ao usuário: causa, correção e o teste que agora protege contra a volta do bug.
