# Pesquisa (nov/2026)

## Projetos e relatos parecidos
- Um desenvolvedor usou o Claude Code + ADB para desativar 25 apps de uma TCL Google TV de 2 GB e a
  tela inicial passou de ~192 MB para ~83 MB de memória.
  [TweakTown](https://www.tweaktown.com/news/114177/tcl-google-tv-owner-hands-the-remote-to-claude-code-and-the-ads-dont-survive/index.html),
  [SSD Nodes](https://www.ssdnodes.com/learn/debloat-android-tv-with-claude-code),
  [prompt/guia público](https://tv.cobanov.dev/en/)
- Benchmarks de limpeza em TCL: [HWBusters](https://hwbusters.com/software/ai-tv-debloating-tcl-98c7k-benchmarks/6/)
- Banco de pacotes de sistema TCL (sem classificação de segurança — verificar no aparelho):
  [sysapps.bayton.org](https://sysapps.bayton.org/packages/com.tcl)

**Lição:** o consenso é usar `pm disable-user --user 0` (reversível com `pm enable`), salvar a lista de
pacotes antes, e **validar cada pacote no próprio aparelho**. Listas da internet divergem — algumas
desabilitam pacotes que outras mandam preservar (ex.: `com.tcl.tv`, entradas HDMI).

## Launchers alternativos (referência de UX e técnica)
- [FLauncher](https://github.com/svrooij/flauncher) (Flutter, GPL-3.0) e forks LTvLauncher/FLauncherL —
  categorias em linha ou grade, papel de parede, relógio. Ver também [lista de launchers](https://gist.github.com/denilsonsa/80cbb3a14b3bf63de75e6bf81c89ee05)
  e o leve [TV Launcher (F-Droid)](https://f-droid.org/packages/com.tvlauncher).
- [Projectivy Launcher](https://www.androidauthority.com/google-tv-ads-projectivy-launcher-3573626) —
  o mais popular; usa sobreposição por acessibilidade para assumir o Home. Licença incerta (não copiar código).

**Decisão:** escrever nosso próprio launcher (Kotlin/Compose for TV) cujo diferencial é ser
**configurado pelo Studio** via perfil. Código GPL não será copiado para não amarrar a licença do projeto.

## Trocar o launcher sem root — riscos conhecidos
- Desabilitar `com.google.android.apps.tv.launcherx` exige também lidar com
  `com.google.android.tungsten.setupwraith`, que reativa o launcher padrão.
  [Gadget Hacks](https://android.gadgethacks.com/how-to/best-google-tv-launcher-replacement-projectivy-setup-guide/)
- Efeitos colaterais relatados: Assistente/busca por voz param; em TCL, **botões do controle** podem
  parar de funcionar; em alguns builds a tecla Home é "engolida".
  [Android Authority](https://androidauthority.com/android-tv-sideload-launcher-3716555),
  [mustafa.net](https://mustafa.net/2026/11/01/replace-google-tv-launcher-without-root/)
- Atualizações do Google TV já bloquearam truques de override de terceiros; o comportamento muda por versão.
  [Android Authority](https://www.androidauthority.com/google-tv-update-blocks-projectivy-override-3649445),
  [Gadget Hacks](https://android.gadgethacks.com/news/google-tv-update-blocks-third-party-launcher-workaround/)

**Decisão:** por padrão **não desabilitar** o launcher original; preferir mecanismo que o mantenha
intacto. Será investigado no aparelho real na Fase 4.

## ADB pela rede
- Android TV: Configurações → Sobre → clicar várias vezes em "Build" para virar desenvolvedor; ativar
  depuração (USB/rede) nas Opções do desenvolvedor; PC e TV na mesma rede; aceitar o pedido na tela.
  [Google Cast docs](https://developers.google.com/cast/docs/android_tv_receiver/debugging)
- Algumas TVs de varejo não escutam ADB pela rede sem antes uma conexão USB; versões novas usam
  pareamento por código ("Depuração sem fio").
  [ADB Wi-Fi 2.0](https://developer.android.com/blog/posts/introducing-fast-and-reliable-wireless-debugging-with-android-debug-bridge-adb-wi-fi-2-0)

## Questão em aberto: qual TCL?
TCL vende no Brasil modelos com **Google TV/Android TV** e também com **Roku TV**. Roku não tem ADB nem
permite trocar a tela inicial — o projeto, como desenhado, só funciona em Android/Google TV.
