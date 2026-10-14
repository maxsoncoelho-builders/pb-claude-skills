# Skills da Platform Builders para Claude Code

Marketplace interno de skills. Hoje traz o plugin **`dashboards`**: duas formas de
transformar número em painel navegável, sempre no mesmo formato visual.

---

## Instalar (uma vez, ~30 segundos)

No Claude Code, digite:

```
/plugin marketplace add maxsoncoelho-builders/pb-claude-skills
```

```
/plugin install dashboards@platform-builders
```

Pronto. As skills ficam disponíveis em **todos** os seus projetos, não só no que
estiver aberto.

Para atualizar depois que alguém publicar uma versão nova:

```
/plugin marketplace update platform-builders
```

---

## Usar

Mande o gatilho no chat. A skill pede o que falta e para — ela nunca sai publicando.

### `dash metricas` — você já tem os números

Para fechamento de trimestre, acompanhamento mensal, números que vieram de um deck
ou de uma consulta já feita.

```
dash metricas
```

Ela pergunta: do que é o painel, quais os períodos, e as métricas (nome, valores por
período, total, unidade). Depois devolve o que entendeu, confirma, e publica.

### `dash csv` — os números estão num arquivo

Para export do Firebase, do Sentry, de BI ou planilha salva em CSV.

```
dash csv
```

Ela perfila o arquivo sozinha (colunas, tipos, janela de datas, sinais de dado
pessoal), pergunta **só** o que o dado não responde — e, quando o CSV é inequívoco,
gera direto. Arquivo grande não é problema: só o perfil agregado é lido.

---

## O que sai

Um artifact com:

- filtro de período no topo, com indicador que desliza entre as opções;
- KPIs com variação contra o período anterior, calculada automaticamente;
- gráficos animados na entrada, com **valor visível em cada ponto** (sem depender de
  passar o mouse) e tooltip com todas as séries do período;
- clique em qualquer ponto para filtrar a página inteira naquele período;
- legenda que liga e desliga série sem mexer na escala;
- tabela por painel, tema claro e escuro, teclado e `prefers-reduced-motion`.

## O que ele garante

| | |
|---|---|
| **Nenhum número estimado** | o que a fonte não responde aparece como "sem dado", nunca como zero ou chute |
| **Sem comparação falsa** | sem período anterior, o indicador diz "sem base" em vez de inventar um percentual |
| **Uma unidade por eixo** | volume e taxa viram dois gráficos, nunca dois eixos no mesmo desenho |
| **Eixo recortado se declara** | e só em gráfico de pontos, nunca em barra |
| **PII não é publicada** | documento, e-mail, telefone, nome e matrícula entram só agregados |
| **Confirmação antes de publicar** | o plano aparece no chat; o artifact só sai depois do seu "sim" |

## Atenção ao compartilhar

Artifact nasce **privado**. Para alguém abrir, use o menu **Share** da página —
por e-mail, para a organização, ou link público. Dashboard com métrica interna
normalmente não deve virar link público.

"Compartilhado com a organização" vale para a organização **no Claude**, que não é a
mesma coisa que a empresa: quem estiver noutro workspace precisa de convite por e-mail.

---

## Requisitos

- Claude Code
- Node.js — só para o perfilador do `dash csv` (`profile-csv.mjs`, sem dependências)

## Estrutura

```
.claude-plugin/marketplace.json     ← catálogo
plugins/dashboards/
  .claude-plugin/plugin.json
  skills/
    create-metrics-dashboard/       ← dash metricas (+ TEMPLATE.html)
    create-csv-dashboard/           ← dash csv (+ TEMPLATE.html, scripts/)
```

Para adicionar uma skill: crie `plugins/<plugin>/skills/<nome>/SKILL.md` com
frontmatter `name` + `description`, registre o plugin no `marketplace.json` se for
novo, e suba a versão em `plugin.json`.
