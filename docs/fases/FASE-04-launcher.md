# Fase 4 — Launcher (nova tela inicial) 🟨

**Objetivo:** um app de tela inicial leve, instalado como app comum, que lê o **perfil** montado no Studio
e se adapta a cada TV (resolução, memória, versão do Android) — e o caminho seguro para instalá-lo e
assumir o botão Home, com volta em 1 clique.

Dividida em duas partes para manter cada entrega pequena e testável:

## 4a — Perfil + app do Launcher (esta entrega)
**Fora de escopo:** instalar na TV pelo Studio (4b), editor visual (Fase 5).

### Entregáveis
- [ ] `shared/profile/profile.schema.json` (v1) + exemplos válidos/inválidos usados **pelos dois lados**
      (Studio em TypeScript e Launcher em Kotlin) — assim as regras nunca divergem
- [ ] Studio: validação do perfil e **perfil padrão gerado a partir do inventário** da TV
- [ ] `launcher/core` (Kotlin puro, testado aqui): leitura/validação do perfil, cadeia de segurança
      (perfil novo válido → último válido → padrão), layout adaptativo, montagem das fileiras
- [ ] `launcher/app` (Android, Compose for TV): fileiras de apps com banner/ícone, atalhos de entradas
      HDMI/antena, relógio, modo leve, receptor de perfil protegido, sem permissão de internet
- [ ] CI: testes do core + build do APK (debug) publicado como artefato

### Regras de segurança do Launcher
- Instalado como app comum; **não** pede internet, não lê dados pessoais.
- Sempre mostra **Configurações** e **Todos os apps**, mesmo que o perfil esqueça (ninguém fica preso).
- Perfil inválido nunca quebra a tela: usa o último válido ou o padrão.
- Só o próprio sistema/adb (permissão `DUMP`, que apps comuns não têm) pode enviar perfil novo.

## 4b — Instalar e assumir o Home pelo Studio (próxima entrega)
- Novas ações de plano: instalar/atualizar o Launcher (só o nosso pacote), enviar perfil, definir Home,
  desativar o launcher original **e** o "fallback" do Google TV (aprovado pelo usuário, reversível).
- Checagem de saúde específica: Home abre o nosso launcher; botão Configurações acessível.
- "Voltar à tela original" em 1 clique. Tudo sob a mesma trava da TV real.

## Testes
- Exemplos de perfil compartilhados validados pelo TypeScript **e** pelo Kotlin (mesmo resultado).
- Layout adaptativo para 720p/1080p/4K × pouca/média/muita memória.
- Fileiras: apps ausentes somem, Configurações/Todos os apps sempre presentes, entradas detectadas.

## Riscos
| Risco | Mitigação |
|---|---|
| Android SDK indisponível no ambiente de desenvolvimento | Lógica em Kotlin puro testada aqui; APK compilado na CI |
| Launcher com bug deixar a TV sem tela inicial | Launcher original só é desativado na 4b, com checagem de saúde e volta automática |
