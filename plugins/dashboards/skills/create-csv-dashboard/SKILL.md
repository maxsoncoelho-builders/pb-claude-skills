---
name: create-csv-dashboard
description: >-
  Gera um dashboard a partir de um CSV fornecido pelo usuário — perfila o
  arquivo, pergunta apenas o que o dado não responde sozinho e publica um
  artifact HTML num padrão visual fixo. Serve para qualquer CSV (export de BI,
  analytics, planilha, banco). Use com o gatilho dash csv (ou csv dash,
  dashboard csv, cria dash).
disable-model-invocation: true
---

# Dashboard a partir de CSV

> Gatilho: **`dash csv`** (aliases: `csv dash`, `dashboard csv`, `cria dash`).

Dashboard construído **do dado para cima**: lê o CSV entregue pelo usuário, descobre o
que ele tem, pergunta só o que não dá para inferir e publica um artifact HTML.
**Nenhum número sai de estimativa** — todo valor exibido vem de agregação do arquivo.

## Quando usar / quando não usar

- **Usar:** o usuário tem um CSV e quer visão visual dele — KPIs, cortes por dimensão,
  série temporal, funil, tabela de detalhe.
- **Não usar:** relatório recorrente que já tem formato próprio definido; dado que não
  está em CSV (só API); documento de texto em vez de painel.

## Contrato / âncoras

| Âncora | Caminho real | Invariante esperada |
|--------|--------------|---------------------|
| Perfilador | `scripts/profile-csv.mjs` (nesta pasta) | recebe `--input`, devolve JSON com colunas, tipos, papéis, janela e PII |
| Template visual | `TEMPLATE.html` (nesta pasta) | `.wrap`, `.kpis/.kpi`, `.grid/.panel`, `.chart`, `.steps/.step`, `.chip`, `.flag`, `footer` |
| Calibração de design | skill `artifact-design` | carregada antes de escrever o `.html` |
| Publicação | tool `Artifact` | publica o arquivo e devolve a URL |
| Saídas intermediárias | scratchpad da sessão | perfil JSON e agregações ficam fora do repositório |

## O padrão visual (obrigatório)

Todo dashboard desta skill sai **no mesmo padrão** — o leitor reconhece o formato antes
de ler o conteúdo. O `TEMPLATE.html` já traz tudo; não invente outro sistema.

| Elemento | Regra |
|----------|-------|
| Tipografia | Instrument Sans (texto) · JetBrains Mono (todo número, rótulo de eixo e chip) |
| Cor | tokens `--bg`, `--surface`, `--fg`, `--muted`, `--line`, `--grid`, `--accent`, `--good`, `--warn`, `--bad`. Nunca cor literal no corpo |
| Tema | claro e escuro por token, via `prefers-color-scheme` **e** `[data-theme]` |
| Topo | `.eyebrow` (fonte · recorte) → `h1` (a leitura em uma frase) → `.sub` |
| Ressalva | `.flag` logo abaixo do topo quando o recorte tem limite |
| KPIs | `.kpis` com 4 colunas; cada `.kpi` tem `.lbl`, `.val` e `.meta` com `.chip` |
| Chip | `up` / `down` / `flat` / `na` — `na` quando não há base de comparação |
| Painéis | `.grid` de 2 colunas; `.panel.full` para o que precisa de largura |
| Cabeçalho do painel | `.ph` com `h2` à esquerda e `.tot` (base/total) à direita |
| Gráfico | SVG inline com `viewBox` e `role="img"` + `aria-label`. Sem lib externa, sem canvas |
| Ranking/funil | `.steps` → `.step` (rótulo · barra · `.n`) |
| Leitura | `.note` ao pé do painel dizendo como ler e o que ficou de fora |
| Rodapé | `footer` com fontes e escopo excluído |
| Responsivo | 2 colunas de KPI e 1 de painel abaixo de 880px; gutter 16px abaixo de 420px |

## Fluxo

### Fase 1 — Formulário e parada (turno do gatilho)

Neste turno **não leia o CSV, não rode o perfilador, não publique nada.** Só o formulário:

```text
Dashboard a partir de CSV — me passe isto e eu começo.

1. Caminho do CSV (obrigatório)
2. O que esse dashboard precisa responder, em uma frase? (obrigatório)
3. Quem vai ler? (você / time / liderança / cliente)
4. Tem um segundo CSV do período anterior para comparar? (caminho ou "não")
5. Observação (opcional) — filtro já aplicado no export, coluna que não interessa, etc.
```

**Pare aqui.** Sem os itens 1 e 2, não avance. Se o gatilho já vier com os dois na mesma
mensagem, siga direto para a Fase 2.

### Fase 2 — Perfilar e perguntar só o necessário

```bash
node <caminho-desta-skill>/scripts/profile-csv.mjs \
  --input "<caminho do csv>" --json "<scratchpad>/perfil.json"
```

Leia o perfil — **não o CSV inteiro**. Arquivo grande fica fora do contexto; o que entra
é o perfil e, depois, as agregações.

**Perguntar é exceção, não etapa.** Se o perfil e a frase do item 2 já determinam o
dashboard, **gere direto** — não invente pergunta para parecer caprichoso.

**Gere sem perguntar** quando *todas* valerem:

- uma única coluna de métrica, ou uma métrica claramente apontada pelo item 2;
- no máximo uma coluna de tempo, e a granularidade cai do próprio dado
  (≤ 31 dias → dia; ≤ 26 semanas → semana; acima → mês);
- nenhuma dimensão com cardinalidade acima de 12 (dá para mostrar tudo, sem top N);
- nenhuma métrica ambígua entre soma e média (percentual, taxa, duração, média já calculada);
- `nullRate` abaixo de 0,05 nas colunas que você vai usar;
- nenhuma coluna de PII que você precisaria usar como corte.

Nesse caso vá direto para a Fase 3 — e declare no chat as decisões que tomou sozinho
(métrica de capa, granularidade, cortes), para o usuário contestar antes de publicar.

**Quando alguma condição falhar**, pergunte — só sobre o que falhou:

- **Máximo 6 perguntas**, cada uma com a opção que você recomenda marcada.
- **Só pergunte o que o perfil não responde.** Uma única coluna numérica? Ela é a métrica
  principal — não pergunte. Uma única coluna de data? É o eixo — não pergunte.

| O perfil mostra | Pergunte |
|-----------------|----------|
| 2+ colunas `metrica` | qual é o número de capa (o KPI que abre o dashboard) |
| coluna `tempo` com muitos dias | granularidade: dia, semana ou mês |
| `dimensao` com cardinalidade alta | top N + como tratar a cauda (agrupar em "outros" ou cortar) |
| métrica que pode ser soma **ou** média (taxa, percentual, duração) | qual agregação faz sentido |
| `nullRate` alto numa coluna que você vai usar | ignorar as linhas vazias ou mostrá-las como "sem dado" |
| nenhuma coluna `tempo` | confirmar que o dashboard é um retrato, sem tendência |
| coluna com `pii` que seria uma dimensão natural | confirmar o corte agregado (o valor individual nunca aparece) |

Mostre também, antes das perguntas, o que o perfil já decidiu — para o usuário corrigir
se você leu errado: período detectado, nº de linhas, colunas classificadas como métrica,
dimensão e tempo, e os avisos.

**Pare para as respostas** — só quando houve pergunta. Sem pergunta, siga.

### Fase 3 — Agregar, montar, confirmar e publicar

1. **Agregar por comando**, nunca de cabeça. Cada painel sai de um `awk`/`python3` sobre o
   CSV, e o número publicado é o que o comando imprimiu. Grave as agregações no scratchpad.
2. **Carregar a skill `artifact-design`** (obrigatório antes de escrever o `.html`).
3. **Copiar `TEMPLATE.html` para o scratchpad e preencher.** Estrutura segue o conteúdo:
   painel que o dado não sustenta **não entra** — não existe painel decorativo.
4. **Mostrar o plano ao usuário antes de publicar**: título, KPIs escolhidos, painéis, e o
   que ficou de fora. **Publicar é distribuir** — só chame a tool `Artifact` depois do "sim".
5. **Publicar** com título curto, `icon` e `description` de uma frase. Entregar a URL.

## Regras de conteúdo

- **Todo número é rastreável ao CSV.** Não existe valor estimado, arredondado "para ficar
  redondo" ou herdado de outro relatório. Se o arquivo não responde, o painel diz
  **"sem dado"** — e o `.flag` do topo explica o limite do recorte.
- **PII nunca é publicada.** Coluna marcada com `pii` no perfil entra **só agregada**
  (contagem, soma, distribuição). Documento, e-mail, telefone, nome, matrícula e token não
  aparecem no artifact, nem em tooltip, nem em comentário no HTML. Na dúvida, fora.
- **Dia parcial e linha malformada ficam de fora das médias** — e isso é dito no rodapé.
- **Comparação só com base real.** Sem o CSV do período anterior, o chip é `na`, não um
  percentual inventado.
- **O rodapé declara as fontes** (arquivo, data de exportação, filtros) e **o que ficou
  fora do escopo**.
- Voz ativa, sem emoji como marcador de seção.

## Definição de pronto

- [ ] Turno do gatilho entregou só o formulário
- [ ] Perfil gerado pelo script; CSV não foi despejado no contexto
- [ ] Perguntou só o que o perfil não respondia — ou gerou direto e declarou as decisões
- [ ] Dashboard no padrão visual obrigatório (tipografia, tokens, KPIs, painéis, chips)
- [ ] Toda agregação saiu de comando, com a saída guardada no scratchpad
- [ ] Nenhuma coluna de PII publicada em nível de linha
- [ ] Painel sem dado suficiente foi omitido, não preenchido com estimativa
- [ ] `artifact-design` carregada antes de escrever o HTML
- [ ] Tema claro e escuro por token; tabela larga em `.scroll`; legível em 375px
- [ ] Plano mostrado e **confirmado** antes de publicar
- [ ] URL entregue + a primeira leitura que o usuário deve fazer
