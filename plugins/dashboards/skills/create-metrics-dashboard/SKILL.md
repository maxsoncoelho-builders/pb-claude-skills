---
name: create-metrics-dashboard
description: >-
  Monta um dashboard interativo a partir de métricas que o usuário fornece —
  números de um fechamento, de um deck, de uma planilha ou de uma consulta já
  feita. Pede os dados num formulário, pergunta só o que ficou ambíguo e publica
  um artifact com filtro de período, KPIs com variação, gráficos animados e
  tabela. Use com o gatilho dash metricas (ou dashboard metricas, dash numeros).
disable-model-invocation: true
---

# Dashboard de métricas

> Gatilho: **`dash metricas`** (aliases: `dashboard metricas`, `dash numeros`, `painel de metricas`).

Para quando os números **já existem** — vieram de um fechamento, de um deck, de uma
planilha ou de uma consulta — e falta a página que os torna legíveis e navegáveis.

O resultado é sempre o mesmo formato: filtro de período no topo, KPIs com variação
contra o período anterior, painéis de gráfico com valor visível em cada ponto, e
tabela por painel. Quem já viu um reconhece o próximo.

## Quando usar / quando não usar

- **Usar:** você tem os números na mão (por período) e quer um painel navegável.
- **Não usar:**
  - os números estão num **CSV** e ainda precisam ser apurados → skill `create-csv-dashboard` (`dash csv`);
  - é texto explicativo, diagnóstico ou plano de ação → doc, não dashboard;
  - é um número só, sem série e sem corte → responda no chat.

## Contrato / âncoras

| Âncora | Caminho real | Invariante esperada |
|--------|--------------|---------------------|
| Template | `TEMPLATE.html` (nesta pasta) | motor pronto; só o bloco `DADOS` no topo do `<script>` muda |
| Publicação | tool `Artifact` | publica o `.html` e devolve a URL |
| Calibração de design | skill `artifact-design` | carregada antes de escrever o arquivo |

## Como o template funciona

**Edite apenas o bloco `DADOS`.** Tudo abaixo do comentário `MOTOR` é o renderizador
e não deve ser tocado — é o que garante que todo dashboard saia igual.

```js
const DADOS = {
  eyebrow, titulo, lede,
  periodos: ["Jul","Ago","Set"],   // rótulos do filtro
  agregado: "Q3",                   // rótulo do botão de total, ou null
  kpis:    [ ... ],                 // 4 funciona melhor na grade
  paineis: [ ... ],
  rodape:  [ ... ]                  // fontes e ressalvas
};
```

**KPI:** `serie` (um valor por período, `null` onde não há dado), `agregado`,
`casas`, `sufixo`, `unidadeDelta`, `notas[]` e `notaAgregado`. A variação contra o
período anterior é calculada sozinha; `null` vira "sem dado", nunca estimativa.

**Painel:** `titulo`, `total`, `aviso` opcional, e um ou mais `graficos`:

| `tipo` | Para que serve |
|--------|----------------|
| `linhas` | evolução de taxa ou índice ao longo dos períodos |
| `barras` | volume por período (contagem, valor absoluto) |
| `dumbbell` | duas leituras por categoria — use quando os valores se concentram perto do teto (ex.: 95–100%), onde barra mente e eixo recortado em barra é pior ainda |

Mais `ranking` (lista ordenada com barra proporcional) e `nota` (como ler o painel).

**Uma unidade por gráfico.** Volume e taxa não dividem eixo: são dois gráficos no
mesmo painel, cada um com sua escala. O template já aceita isso via `graficos: []`.

## Fluxo

### Fase 1 — Formulário e parada (turno do gatilho)

Não escreva arquivo nem publique nada neste turno. Só o formulário:

```text
Dashboard de métricas — me passe os números e eu monto.

1. Do que é o painel e qual o recorte? (ex.: "saúde do app no Q3, 03/07–30/09")
2. Períodos do filtro (ex.: Jul, Ago, Set) — e há um total/agregado? (ex.: Q3)
3. As métricas, uma por linha: nome, valores por período, total, unidade.
   Ex.: Sucesso no login | 82, 82, 86 | 83,2 | %
4. Alguma métrica sem dado em algum período? Qual e por quê?
5. Fontes e data de extração (vão no rodapé)
6. Ressalvas: definição que mudou, número não comparável, recorte parcial
```

**Pare aqui.** Sem os itens 1, 2 e 3 não avance. Se o gatilho já trouxer tudo, siga.

### Fase 2 — Devolver o entendimento

Antes de montar, **repita os dados como você os entendeu** — tabela curta de
métrica × período — e pergunte só o que ficou ambíguo. Típico:

| Situação | Pergunte |
|----------|----------|
| mais de 4 métricas | quais 4 abrem o painel como KPI |
| métrica perto do teto (>95%) com variação de décimos | confirma `dumbbell` em vez de barra |
| valor que pode ser soma ou média no agregado | qual dos dois |
| período sem dado | "sem dado" ou omitir a métrica |
| nenhuma ressalva informada | confirma que não há recorte parcial a declarar |

Sem ambiguidade, siga direto e **declare as decisões** que tomou.

### Fase 3 — Montar, conferir e publicar

1. Copie `TEMPLATE.html` para o scratchpad e **substitua só o bloco `DADOS`**.
2. Carregue a skill `artifact-design` antes de escrever o arquivo.
3. Ajuste `min`/`max`/`ticks` de cada gráfico aos valores reais — eixo que não
   alcança o dado, ou que sobra metade vazia, estraga a leitura.
4. **Mostre o plano** (título, KPIs, painéis, o que ficou de fora) e publique com a
   tool `Artifact` **só após o "sim"** — publicar é distribuir.
5. Entregue a URL e diga qual é a primeira leitura da página.

## Regras de conteúdo

- **Nenhum número inventado.** O que a fonte não responde é `null` → "sem dado".
  Sem período anterior, o chip é "sem base", não um percentual.
- **Eixo recortado se declara** na nota do painel, e só em gráfico de pontos.
- **O título é a leitura, não o assunto.** "A base cresceu 3,2%, mas a frequência
  caiu" vale mais que "Métricas do trimestre".
- **O rodapé sempre traz fonte, data de extração e o que ficou fora.**
- Sem PII: nome, documento, e-mail, telefone ou matrícula não entram no painel.
- Português, voz ativa, sem emoji como marcador de seção.

## Definição de pronto

- [ ] Turno do gatilho entregou só o formulário
- [ ] Dados devolvidos ao usuário antes de montar
- [ ] Só o bloco `DADOS` foi alterado no template
- [ ] Eixos ajustados aos valores reais
- [ ] Métrica sem dado aparece como "sem dado", não como zero
- [ ] Rodapé com fonte, data e escopo excluído
- [ ] Plano confirmado antes de publicar
- [ ] URL entregue + primeira leitura
