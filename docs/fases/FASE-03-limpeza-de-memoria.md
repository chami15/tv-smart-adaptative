# Fase 3 — Limpeza de memória 🟨

**Objetivo:** tela simples para escolher apps pré-instalados para desativar (reversível), ver o plano em
português, aplicar com o motor da Fase 2 e comparar a memória antes/depois. Inclui "Restaurar TV" a partir
de qualquer backup.

**Decisão do usuário (opção B):** Fase 2 e Fase 3 feitas em sequência. **Na TV real, o botão "Aplicar"
fica bloqueado** até o usuário aprovar; até lá a limpeza funciona de verdade só nas TVs simuladas e, na TV
real, mostra a prévia do plano.

**Fora de escopo:** launcher novo (Fase 4); desinstalar qualquer coisa (proibido).

## Entregáveis
- [ ] Catálogo com rótulos em português e efeitos ("a busca por voz para de funcionar") para Android/Google
      e para as marcas já simuladas (TCL, Philips, Sony, Xiaomi, boxes genéricas)
- [ ] Tela "Limpar memória": 🟢 recomendados, 🟡 com cuidado, 🔴 intocáveis (bloqueados e explicados),
      já desativados (reativar), memória estimada a liberar
- [ ] Revisão do plano → aplicar → resultado (antes/depois) → "Desfazer tudo"
- [ ] Tela "Backups": lista os backups da TV e restaura (com plano revisável)
- [ ] Aviso de "mudança incompleta" com botão de desfazer
- [ ] Trava da TV real (`allowRealWrites`), liberada só com aprovação do usuário

## Etapas
1. Tela de limpeza (seleção + estimativa) consumindo `/api/cleanup`.
2. Revisão do plano + aplicação + resultado.
3. Backups e restauração.
4. Aviso de mudança incompleta.
5. Testes como usuário (Playwright) + teste exploratório + correções com regressão.

## Critérios de aceite
- Nas TVs simuladas: limpar, ver a memória subir, desfazer e voltar exatamente ao estado anterior.
- Falhas simuladas no meio terminam desfeitas automaticamente, com mensagem clara.
- Na TV real: prévia funciona; "Aplicar" bloqueado com explicação.
