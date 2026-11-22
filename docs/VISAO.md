# Visão do produto

## O problema

TVs smart (de qualquer marca), principalmente as de entrada com 1,5–2 GB de RAM, ficam lentas:
a tela inicial padrão é pesada, cheia de anúncios e recomendações, e vem com dezenas de apps
pré-instalados rodando em segundo plano. Personalizar isso hoje exige linha de comando, listas de pacotes
copiadas da internet e coragem — e um erro pode deixar a TV sem entrada HDMI ou sem controle remoto.

## A ideia

**Montar a TV no computador, com calma, e só depois enviar para ela.** Como um editor de site:
você vê a prévia, ajusta, e publica.

**Adaptativa:** funciona com a TV que você tiver. O Studio descobre marca, modelo, sistema, memória e
resolução e mostra só o que aquela TV consegue fazer. O mesmo perfil pode ser levado para outra TV — o
Studio adapta o que for possível e avisa o que não for.

## Experiência do usuário (fluxo ideal)

1. **Conectar** — abro o Studio, ele encontra a TV na rede. Um assistente me ensina a ligar o
   "modo desenvolvedor" e a depuração na TV (com imagens). A TV pede permissão; eu aceito.
2. **Conhecer a TV** — o Studio mostra modelo, versão do Android, memória livre/usada e todos os apps,
   classificados em: 🟢 seguro remover da memória, 🟡 cuidado, 🔴 intocável.
   Um **backup completo** do estado atual é salvo automaticamente.
3. **Limpar** — marco o que quero desativar. O Studio mostra o ganho estimado de memória e o que vou
   perder (ex.: "a busca por voz pode deixar de funcionar"). Confirmo. Depois ele mede de novo e mostra o
   antes/depois.
4. **Montar o layout** — em uma tela que imita a TV (16:9), arrasto fileiras e apps, escolho papel de
   parede, relógio, cores, tamanho dos ícones, apps favoritos e atalhos para entradas (HDMI 1, HDMI 2…).
   A navegação por controle remoto é simulada na prévia (setas + OK).
5. **Enviar para a TV** — um clique: o Studio instala/atualiza o Launcher, envia o perfil e ativa.
   Se algo der errado, volta sozinho ao estado anterior.
6. **Voltar atrás quando quiser** — "Restaurar TV original" desfaz tudo (reativa apps, volta o launcher
   padrão) a partir do backup.

## Princípios

- **Seguro antes de bonito.** Nenhuma funcionalidade justifica risco à TV, à conexão ou ao hardware.
- **Tudo reversível.** Se não dá para desfazer, não fazemos.
- **Transparente.** O usuário sempre vê o que vai acontecer antes de acontecer.
- **Leve.** O Launcher precisa consumir menos memória que o padrão — essa é a razão de existir.
- **Local e privado.** Sem conta, sem nuvem, sem telemetria.

## Fora do escopo (por enquanto)

- Nas primeiras versões: webOS, Tizen e Fire TV (planejados para depois). Roku: não permite.
- Root, ROMs customizadas, overclock, alterações de firmware.
- Bloquear anúncios dentro de apps de streaming.
- Controle remoto pelo celular (pode virar fase futura).
