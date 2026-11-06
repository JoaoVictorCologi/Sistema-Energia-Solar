# Parâmetros e configuração

Os valores que o cálculo usa ficam em três lugares, conforme quem os altera:

| Onde | O que guarda | Quem altera | Como muda |
| --- | --- | --- | --- |
| `src/parametros/parametros.json` | Premissas técnicas e legais: Lei 14.300, PR, simultaneidade, fatores do telhado | Quem desenvolve | Revisão no Git e novo deploy |
| `src/parametros/tributos-por-uf.json` | ICMS por UF, PIS e COFINS | Quem desenvolve | Revisão no Git e novo deploy |
| Tabelas `configuracao_comercial` e `forma_pagamento` | Margem, instalação, custo de referência, validade, limite de desconto e formas de pagamento | Gestão, pelo painel | [API](api.md#configuração-comercial-e-formas-de-pagamento) |

Tarifa, irradiação e indicadores econômicos não são parâmetros: vêm de fontes oficiais e ficam no banco ([integracoes-e-importacoes.md](integracoes-e-importacoes.md)).

Os dois JSON são validados com zod ao carregar. Um valor fora da faixa impede o backend de subir e a mensagem diz qual é o campo.

## `parametros.json`

Todos os números ficam entre aspas (`"0.78"`), para não passar por `number`, e o código os recebe como `Decimal`, exceto os inteiros (`horizonteAnos`, `validadeDosCreditosMeses`, `trocaDoInversor.ano`). O campo `fontes` explica a origem de cada valor.

```ts
import { parametros } from '../parametros/parametros.ts';
parametros.performanceRatio;   // Decimal 0.78
```

| Campo | Valor atual | Faixa aceita | Origem |
| --- | --- | --- | --- |
| `versao` | `2026-11-04` | Texto | Gravada em cada simulação |
| `calibracao` | `calibrada: false`, CPFL Santa Cruz | — | Define o aviso de estimativa ([testes.md](testes.md#validação-com-contas-reais)) |
| `fioBPercentualPorAno` | 2023: 15%, 2024: 30%, 2025: 45%, 2026: 60%, 2027: 75%, 2028: 90%, 2029: 100% | 0 a 1 | Lei 14.300, art. 27. De 2029 em diante é um cenário conservador |
| `consumoMinimoKwh` | Mono 30, bi 50, tri 100 | 0 a 1000 | REN ANEEL 1.000/2021 |
| `performanceRatio` | 0,78 | 0,70 a 0,85 | Perdas típicas. A calibrar |
| `degradacaoAnualPadrao` | 0,5% | 0,2% a 1% | Usada quando o módulo não informa |
| `simultaneidade` | Abaixo | 0,10 a 0,70 | Valores iniciais. A calibrar |
| `coberturaAlvo` | 100% | 50% a 120% | Fração do consumo anual que o sistema gera |
| `coberturaMaximaSobreConsumoAtual` | 120% | 100% a 200% | A distribuidora costuma pedir comprovação de carga acima disso |
| `horizonteAnos` | 25 | 1 a 40 | Garantia típica de desempenho dos módulos |
| `validadeDosCreditosMeses` | 60 | 1 a 120 | REN ANEEL 1.000/2021 |
| `moduloReferencia.potenciaW` | 550 | 100 a 800 | Módulo da simulação pública |
| `inversoresReferenciaKw` | 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 50 e 75 | 0,5 a 1000 | Inversor da simulação pública |
| `operacaoManutencaoAnual` | 0,5% do investimento | 0 a 3% | Sugestão inicial. A ajustar |
| `trocaDoInversor` | Ano 12; 15% do investimento | Ano 10 a 15; 0 a 50% | Na simulação pública. No orçamento, o custo é o preço do inversor |
| `telhado` | Abaixo | Fatores de 0,3 a 1; área de 1 a 10 m² | Valores iniciais. A calibrar |
| `contaDeLuz` | Alíquota de 10% a 45%; tolerância de 30% | 0 a 1 | Pegam digitação errada sem recusar contas reais |

**Simultaneidade**, por subgrupo e perfil de consumo informado:

| Subgrupo | Sem resposta | `noite` | `equilibrado` | `dia` |
| --- | --- | --- | --- | --- |
| B1 | 0,30 | 0,20 | 0,30 | 0,45 |
| B2 | 0,40 | 0,25 | 0,40 | 0,50 |
| B3 | 0,40 | 0,25 | 0,40 | 0,55 |

**Telhado:** os fatores multiplicam a irradiação. `areaPorModuloM2` é 2,8 m².

| Resposta | Opções e fatores |
| --- | --- |
| `horasDeSol` | `diaTodo` 1,00; `de6a8` 0,92; `de4a6` 0,80; `menosDe4` 0,65 |
| `orientacao` | `norte` 1,00; `nordeste` e `noroeste` 0,96; `leste` e `oeste` 0,88; `sudeste` e `sudoeste` 0,80; `sul` 0,72; `plano` 0,90 |
| `inclinacao` | `plano` 0,90; `pouca` 0,94; `media` 1,00; `muita` 0,95 |

**Ao mudar um valor:** atualize `versao` e explique a mudança em `fontes`. Simulações e orçamentos antigos guardam o que usaram, então não mudam.

## `tributos-por-uf.json`

Tem as 27 UFs. O ICMS segue a UF do município do cliente, não a distribuidora.

```ts
import { tributosDaUf } from '../parametros/tributos.ts';
tributosDaUf('SP', new Decimal(150));   // { icms: 0.12, pis: 0.01, cofins: 0.045, icmsSobreFioB: true }
```

- **Faixas de ICMS:** ficam em ordem crescente e vale a primeira que comporta o consumo médio. Hoje, SP tem 12% até 200 kWh e 18% acima; RJ, 18% até 300 kWh e 22% acima; MT e SC, 12% até 150 kWh e 17% acima. As demais têm uma alíquota só: a geral do estado, porque a LC 194/2022 limita o ICMS da energia a ela.
- **PIS e COFINS:** média nacional estimada, de 1% e 4,5%. Variam por mês e por distribuidora.
- **`icmsSobreFioB`:** `true` em todas as UFs, por ser o cenário conservador, até a conferência numa conta real de cliente GD II de cada UF.
- **Conferência:** só SP tem fonte legal confirmada. Todas as outras estão marcadas "a conferir" no campo `fonte`.
- **Validação:** falta de UF, alíquota fora de 0 a 1 ou ICMS + PIS + COFINS a partir de 50% impedem a subida.

## `correcoes-atlas.json`

Resolve o que não casa sozinho na carga do Atlas ([detalhes](integracoes-e-importacoes.md#carregar-atlas)):

- `nomes`: `{ "UF do Atlas": { "nome no Atlas": códigoIbge } }`. O código pode ser de outra UF: o Atlas traz Porto Alegre, do RS, com a UF do RN.
- `semSedeNoAtlas`: `{ "códigoIbge": { "usarSedeDe": códigoIbge, "motivo": "…" } }`, para município que não está no Atlas. Fernando de Noronha usa Recife; Boa Esperança do Norte, criado depois de 2017, usa Sorriso.

## Configuração comercial

Só insere: cada alteração é uma linha nova em `configuracao_comercial`. A mais recente vale, e as anteriores são o histórico de quem mudou o quê e quando. Lida no código por `obterConfiguracaoVigente()`, de `services/configuracoesService.ts`.

| Campo | Valor inicial | Faixa | Uso |
| --- | --- | --- | --- |
| `margem` | 20% | 0 a 100% | Sobre equipamentos e instalação |
| `instalacaoPorKwp` | R$ 700 | 0 a 100.000 | Custo de instalação no orçamento |
| `custoReferenciaPorKwp` | R$ 4.000 | 1 a 100.000 | Investimento estimado na simulação pública |
| `validadeDias` | 10 | 1 a 90 | Validade do orçamento |
| `limiteDesconto` | 10% | 0 a 100% | Acima disso, o desconto exige justificativa |

## Formas de pagamento

| Forma | Tipo | Parcelas | Carência | Outros | Situação inicial |
| --- | --- | --- | --- | --- | --- |
| À vista | `avista` | 1 | — | Desconto de 5% | Ativa |
| Cartão de crédito | `parcelado` | 1 a 12 | — | — | Inativa até definir a taxa |
| Financiamento solar | `financiado` | 1 a 120 | Até 120 dias | — | Inativa até definir a taxa |

Regras: uma forma parcelada ou financiada só fica ativa com a taxa preenchida (zero vale, para sem juros); à vista tem uma parcela só; o mínimo de parcelas não passa do máximo.

**Faixas:** taxa de 0 a 20% ao mês, parcelas de 1 a 600, entrada mínima de 0 a 90%, carência de 0 a 365 dias, desconto à vista de 0 a 50%.

Mudar uma configuração ou forma só vale para os próximos cálculos. Um orçamento em rascunho é recalculado com a configuração do dia, mas a condição já incluída guarda a própria cópia da forma ([orcamentos.md](orcamentos.md#condições-de-pagamento)).
