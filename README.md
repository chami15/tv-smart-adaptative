# TV Smart Adaptative

Monte a sua TV no computador e envie para ela. Layout da tela inicial, apps favoritos e limpeza de
memória — **sem root e sempre reversível**.

> Status: **Fase 1 — Descoberta** pronta para teste na TV real. O Studio conecta e **só lê** (nada é alterado na TV).

**Como usar no Windows:** veja o [Guia de uso](docs/GUIA-USO.md) — resumo: instale Node.js 22 e o adb, e dê dois cliques em `Iniciar-Studio.cmd`.

- Alvo: **qualquer TV** — começa por Android TV / Google TV de qualquer marca; webOS/Tizen depois (Roku não permite).
- Como funciona: um **Studio** no PC conversa com a TV pela rede local via ADB e instala um **Launcher**
  leve, configurado por um perfil JSON.

Documentação: [Visão](docs/VISAO.md) · [Arquitetura](docs/ARQUITETURA.md) ·
[Segurança](docs/SEGURANCA.md) · [Roadmap](docs/ROADMAP.md) · [Pesquisa](docs/PESQUISA.md)

Guia para contribuir (e para o Claude): [CLAUDE.md](CLAUDE.md)
