# Guia de uso — Windows

## 1. Instalar (uma vez só)
1. **Node.js 22 LTS ou mais novo** — baixe em <https://nodejs.org> e instale com as opções padrão.
2. **Android Platform-Tools (adb)** — baixe o "SDK Platform-Tools para Windows" em
   <https://developer.android.com/tools/releases/platform-tools>, extraia o .zip e deixe a pasta
   `platform-tools` em `C:\platform-tools` ou dentro de `Downloads`.
3. **Este projeto** — baixe o repositório (botão "Code → Download ZIP" no GitHub, ou `git clone`).

## 2. Abrir o Studio
Dê dois cliques em **`Iniciar-Studio.cmd`** na pasta do projeto.
- Na primeira vez ele instala as dependências (alguns minutos).
- Abre uma janela preta (deixe aberta) e o navegador com o Studio.
- Para fechar: feche a janela preta.

> Quer só conhecer sem TV? No terminal, na pasta do projeto: `npm run dev:fake` (TVs simuladas).

## 3. Preparar a TV (uma vez só)
O próprio Studio mostra o passo a passo. Resumo:
1. Configurações → Sistema → Sobre → clique 7 vezes em **Build** ("Você agora é um desenvolvedor").
2. Opções do desenvolvedor → ative **Depuração USB** (às vezes "Depuração de rede").
3. Abra o Studio: a TV deve aparecer sozinha em **"TVs encontradas na sua rede"** → **Conectar**.
   (Se não aparecer, anote o IP em Configurações → Rede e digite no campo de IP.)
4. Na TV, marque "Sempre permitir deste computador" e escolha **Permitir** (só na primeira vez).

## 4. Checklist do teste na sua TV real (Fase 1)
- [ ] O Studio abriu pelo `Iniciar-Studio.cmd`.
- [ ] Conectou pelo IP e a TV pediu autorização.
- [ ] Marca, modelo, Android, memória e resolução batem com a TV.
- [ ] A lista de apps aparece e a busca funciona.
- [ ] "Salvar backup agora" mostrou a pasta e os arquivos existem no Explorer
      (`%USERPROFILE%\TVSmartAdaptative\backups\...`).
- [ ] **Nada mudou na TV** (tela inicial e apps iguais).
- [ ] (Opcional, se quiser ajudar) exportar o inventário anônimo:
      `npm run export:fixture -- "<pasta do backup>"` e me enviar o arquivo gerado.

## 5. Desfazer / segurança
Nesta fase o Studio **só lê**. Para encerrar o acesso: desligue a "Depuração USB" na TV.
Os backups ficam só no seu computador.

## Problemas comuns
| Mensagem | O que fazer |
|---|---|
| adb não encontrado | Confira a pasta `C:\platform-tools\adb.exe` e clique "Verificar de novo" |
| A TV não foi encontrada nesse endereço | IP errado ou TV em outra rede (ex.: Wi-Fi de convidados) |
| A TV recusou a conexão | Depuração desligada; algumas TVs exigem a "Depuração por Wi-Fi" com pareamento por código |
| Aceite o aviso na TV | Use o controle remoto para tocar em **Permitir** |
| Firewall do Windows perguntou algo | Pode permitir: o adb só conversa com a TV na sua rede |
