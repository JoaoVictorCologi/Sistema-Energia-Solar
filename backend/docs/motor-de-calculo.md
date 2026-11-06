# Motor de cálculo

O motor recebe dados já resolvidos (tarifa, irradiação, tributos, equipamentos e premissas) e devolve o dimensionamento, a simulação mês a mês e os indicadores financeiros. Fica em `src/motor/` e não acessa banco, rede nem relógio.

- **Puro e determinístico:** a mesma entrada gera sempre a mesma saída, o que permite testar tudo sem banco e reproduzir um cálculo antigo a partir do que foi gravado. O teste `tests/motor/regras.test.ts` barra importações de banco, rede e relógio nesta pasta.
- **Decimal em todo o cálculo:** tarifas têm 5 a 6 casas decimais, então nada passa por `number`, exceto contadores (ano, mês, dias). O motor não arredonda; quem arredonda é a saída da API.
- **Simulação mensal:** créditos de energia, consumo mínimo e Fio B dependem do mês, por isso o cálculo percorre 300 meses (25 anos × 12) em vez de usar médias anuais.
- **Cada número explicável:** a saída traz as parcelas intermediárias de cada mês (geração, autoconsumo, energia compensada, Fio B).

**Escopo:** consumidor do grupo B (B1, B2 e B3), modalidade convencional, microgeração com compensação no próprio local. Autoconsumo remoto, geração compartilhada, grupo A e tarifa branca ficam fora.

## Arquivos

| Arquivo | Conteúdo |
| --- | --- |
| `tipos.ts` | Grandezas marcadas (`Kwh`, `Kwp`, `Reais`, `ReaisPorKwh`, `Fracao`) e `Alerta` |
| `tarifa.ts` | Reajuste, tarifa com impostos e cobrança de Fio B |
| `dimensionamento.ts` | Potência, número de módulos e escolha do inversor |
| `geracao.ts` | Geração mensal com degradação e dias do mês |
| `faturamento.ts` | Autoconsumo, compensação GD I e GD II, créditos e faturas |
| `financeiro.ts` | VPL, TIR, payback e parcela pela tabela Price |
| `simular.ts` | Junta tudo no laço de 300 meses |

Como o TypeScript compara tipos pela forma, dois `Decimal` seriam intercambiáveis. As grandezas marcadas impedem, por exemplo, passar reais onde se espera kWh. Crie-as com `kwh(...)`, `reais(...)`, `fracao(...)` e as demais funções de `tipos.ts`.

## Como usar

Quem usa o motor chama só `simular(entrada)`:

```ts
import { simular } from '../motor/simular.ts';

const resultado = simular({
  consumoMensal, hspMensal,                       // 12 valores, de janeiro a dezembro: Kwh[] e Decimal[]
  tarifa: { te, tusd, fioB, adicionalBandeira },  // ReaisPorKwh, sem impostos
  tributos: { icms, pis, cofins, icmsSobreFioB }, // Fracao e boolean
  modulo: { potenciaW, degradacaoAnual }, inversoresKw,
  investimento: reais(15400), inicio: { ano: 2026, mes: 4 }, regime: 'GD_II',
  premissas: {
    performanceRatio, simultaneidade, coberturaAlvo, consumoMinimo, percentualFioBPorAno,
    validadeDosCreditosMeses, reajusteAnual, taxaDesconto, horizonteAnos, operacaoManutencaoAnual, trocaDoInversor,
    numeroMaximoDeModulos, numeroFixoDeModulos,   // opcionais
  },
});
```

Peças avulsas exportadas: `dimensionar`, `geracaoMensal`, `faturarMes` (a partir de consumo e geração), `compensarMes` (a partir de consumo da rede e injeção medidos, como numa conta de luz), `calcularIndicadores` e `parcelaPrice`.

## Saída

| Bloco | Conteúdo |
| --- | --- |
| `dimensionamento` | `kwpAlvo`, `numeroModulos`, `kwpInstalado`, `inversorKw`, `razaoCcCa`, `alertas` |
| `serieMensal` (300 linhas) | `ano`, `anoCivil`, `mes`, `consumo`, `geracao`, `autoconsumo`, `injecao`, `consumoDaRede`, `energiaCompensada`, `creditosNoFimDoMes`, `creditosVencidos`, `faturaSemSolar`, `faturaComSolar`, `parcelaFioB`, `economia` |
| `resumoAnual` (25 linhas) | `ano`, `geracao`, `economia`, `operacaoManutencao`, `trocaDoInversor`, `fluxoDeCaixa`, `fluxoAcumulado` |
| `indicadores` | `vpl`, `tir`, `paybackSimplesAnos`, `paybackDescontadoAnos` (`null` quando não calculáveis), `economiaPrimeiroAno`, `economiaTotal` |
| `alertas` | Lista de `{ codigo, mensagem }` |

## Fluxo

1. **Dimensionamento**, uma vez: kWp alvo, módulos, kWp instalado e inversor.
2. Para cada um dos 300 meses, em ordem:
   1. tarifa e cobrança de Fio B do ano;
   2. geração do mês, com a degradação pela idade do sistema;
   3. autoconsumo, injeção e consumo da rede;
   4. compensação, faturas, economia e créditos que passam ao mês seguinte.
3. **Resumo anual:** os 12 meses somados, com operação e manutenção, troca do inversor e fluxo de caixa.
4. **Indicadores:** VPL, TIR e payback.

O primeiro mês é o da conexão prevista. Os anos da simulação (1 a 25) contam a partir dele e os anos civis definem o percentual de Fio B.

## Fórmulas

Índices: *a* é o ano da simulação (1 a 25). Valores em reais são nominais, com reajuste e taxa de desconto também nominais.

### 1. Tarifa com impostos

Os tributos incidem "por dentro": divide-se pela soma das alíquotas, em vez de multiplicar.

```
tarifa cheia(a) = (TE + TUSD + B) × (1 + r)^(a−1) ÷ (1 − (ICMS + PIS + COFINS))

cobrança de Fio B(a) = p(ano civil) × Fio B × (1 + r)^(a−1) ÷ (1 − (ICMS* + PIS + COFINS))
```

- *B*: adicional da bandeira (a simulação usa zero, bandeira verde).
- *r*: reajuste tarifário anual.
- *p*: percentual do Fio B do ano civil. Depois do último ano da tabela vale o último; antes do primeiro, zero.
- *ICMS\**: o ICMS, ou zero quando `icmsSobreFioB` é falso.

### 2. Dimensionamento

Potência que gera, em um ano, a fração alvo do consumo anual. Usa um ano de 365 dias:

```
kWp alvo = cobertura × Σ consumo do mês ÷ (PR × Σ (HSP do mês × dias do mês))
módulos  = arredonda para cima (1000 × kWp alvo ÷ potência do módulo em W)
kWp      = módulos × potência do módulo em W ÷ 1000
```

**Inversor:** o de menor potência CA cuja razão kWp ÷ potência CA fique entre 1,15 e 1,35. Sem opção na faixa, escolhe-se a mais próxima, com o alerta `RAZAO_CC_CA_FORA_DA_FAIXA`; acima de 1,40, soma-se o alerta `CEIFAMENTO`. Sem nenhum inversor na lista, o alerta é `SEM_INVERSOR_COMPATIVEL`.

**Limites de módulos:**

- `numeroMaximoDeModulos` (área do telhado): o número de módulos para no máximo e o motor avisa `AREA_INSUFICIENTE`; o sistema cobre só parte do consumo.
- `numeroFixoDeModulos` (revisão do orçamento): vale a quantidade informada, sem o cálculo e sem o limite de área.

Fatores do telhado, conta de luz e perfil de consumo são aplicados antes do motor, em `services/refinamento.ts`. O motor recebe só a irradiação e a simultaneidade já ajustadas ([simulacao.md](simulacao.md)).

### 3. Geração mensal

```
E = kWp × HSP do mês × dias do mês × PR × (1 − δ)^(a−1)
```

Os dias seguem o calendário real (fevereiro com 28 ou 29). *δ* é a degradação anual do módulo.

### 4. Autoconsumo, injeção e consumo da rede

```
A = mín(s × E, C)      autoconsumo: consumido na hora em que é gerado, nem passa pelo medidor
I = E − A              injeção na rede
R = C − A              consumo medido da rede
```

*s* é a simultaneidade e *C* o consumo do mês.

### 5. Compensação e fatura com solar

Energia disponível para compensar: *D* = *I* + créditos anteriores ainda válidos. A injeção do próprio mês compensa primeiro; a sobra vira um lote novo de crédito. Depois os lotes são usados do mais antigo para o mais novo e vencem após 60 meses.

**GD II** (Lei 14.300, arts. 16 e 27), com consumo mínimo *Cmín* da ligação:

```
se R ≥ Cmín:  K = mín(D, R)    fatura = (R − K) × tarifa cheia + K × cobrança de Fio B
se R < Cmín:  K = 0            fatura = Cmín × tarifa cheia        (toda a injeção vira crédito)
```

**GD I** (regra anterior, sem Fio B até 2045). A compensação para no consumo mínimo:

```
K = mín(D, máx(0, R − Cmín))   fatura = máx(R − K, Cmín) × tarifa cheia
```

Nos dois casos, os créditos no fim do mês são *D* − *K*.

### 6. Fatura sem solar e economia

```
fatura sem solar = máx(C, Cmín) × tarifa cheia
economia         = fatura sem solar − fatura com solar
```

A contribuição de iluminação pública fica fora das duas faturas, porque é igual com e sem solar.

### 7. Fluxo de caixa e indicadores

```
FC(0) = −investimento
FC(a) = economia do ano − om × investimento × (1 + r)^(a−1) − troca do inversor × (1 + r)^(a−1)
VPL   = Σ FC(a) ÷ (1 + i)^a
```

*om* é a fração anual de operação e manutenção, *i* a taxa de desconto. A troca do inversor só entra no ano definido em `trocaDoInversor.ano`.

- **TIR:** a taxa que zera o VPL, por bisseção entre −99% e 100% ao ano, com precisão de 1e-10. Sem troca de sinal nesse intervalo, é `null`.
- **Payback simples:** primeiro ano em que o acumulado deixa de ser negativo, com interpolação linear: (*a* − 1) + (−acumulado até *a* − 1) ÷ *FC(a)*.
- **Payback descontado:** a mesma conta com os fluxos divididos por (1 + *i*)^*a*.

### 8. Parcela pela tabela Price

Usada no orçamento e na parcela estimada, fora de `simular`:

```
parcela = P × i ÷ (1 − (1 + i)^−n)        com taxa zero: P ÷ n
P com carência = P × (1 + i)^(meses de carência)
```

Na carência não se paga nada e os juros se acumulam. Exemplo: R$ 10.000 a 1,5% ao mês em 60 meses dá R$ 253,93.

## Alertas do motor

| Código | Quando |
| --- | --- |
| `RAZAO_CC_CA_FORA_DA_FAIXA` | Nenhum inversor da lista deixa a razão entre 1,15 e 1,35 |
| `CEIFAMENTO` | Razão acima de 1,40: parte da geração nos horários de pico se perde no inversor |
| `SEM_INVERSOR_COMPATIVEL` | Lista de inversores vazia |
| `AREA_INSUFICIENTE` | A área comporta menos módulos que o necessário |
| `CONSUMO_ABAIXO_DO_MINIMO` | Consumo médio abaixo do mínimo da ligação: a conta já é a mínima |
| `CREDITOS_VENCIDOS` | Créditos vencidos somam mais de 1% da geração total: sistema superdimensionado |
| `TIR_NAO_CALCULAVEL` | O investimento não se paga no horizonte simulado |

A simulação acrescenta outros alertas sobre os dados usados ([simulacao.md](simulacao.md#alertas)).

## Exemplo resolvido

Cliente residencial monofásico com 400 kWh por mês. **Tarifas e impostos são ilustrativos**, não de uma distribuidora real. Estes números são os casos de teste do motor em `src/tests/motor/`.

| Item | Valor |
| --- | --- |
| Consumo | 400 kWh em todos os meses |
| Ligação | Monofásica (consumo mínimo 30 kWh) |
| HSP | 5,0 h/dia em todos os meses |
| PR | 0,78 |
| Módulo e inversor | 550 W e 3 kW |
| Simultaneidade | 30% |
| Tarifa sem impostos | TE 0,30; TUSD 0,45; Fio B 0,20 (R$/kWh) |
| Impostos | ICMS 18%, PIS 1%, COFINS 4,5%; ICMS também sobre o Fio B |
| Mês simulado | 30 dias em 2026 (Fio B a 60%), sem créditos anteriores, bandeira verde |

1. **Potência alvo:** 4.800 kWh ÷ (0,78 × 5,0 × 365) = 3,372 kWp.
2. **Módulos:** 3.372 W ÷ 550 W = 6,13 → 7 módulos → **3,85 kWp**.
3. **Inversor:** 3,85 ÷ 3,0 = razão de 1,283, dentro da faixa.
4. **Geração do mês:** 3,85 × 5,0 × 30 × 0,78 = **450,45 kWh**.
5. **Autoconsumo:** 30% × 450,45 = 135,14 kWh. **Injeção:** 315,32 kWh. **Consumo da rede:** 264,87 kWh.
6. **Compensação (GD II):** a rede (264,87) passa do mínimo (30), então compensa-se mín(315,32; 264,87) = **264,87 kWh**. Sobram **50,45 kWh** de crédito.
7. **Tarifa cheia:** 0,75 ÷ (1 − 0,235) = 0,980392 R$/kWh.
8. **Cobrança de Fio B:** 0,60 × 0,20 ÷ 0,765 = 0,156863 R$/kWh.
9. **Fatura sem solar:** 400 × 0,980392 = **R$ 392,16**.
10. **Fatura com solar:** 264,87 × 0,156863 = **R$ 41,55**.
11. **Economia do mês:** **R$ 350,61** (89% da fatura).

No mesmo cenário em GD I, a compensação pararia em 264,87 − 30 = 234,87 kWh, sem Fio B: a fatura seria 30 × 0,980392 = R$ 29,41. A diferença entre os dois regimes é o efeito da Lei 14.300.

**Indicadores:** o fluxo [−1000, 500, 500, 500] com taxa de 10% dá VPL de 243,43, TIR de 23,38% e payback simples de 2,0 anos.

## Limitações do modelo

O modelo é mensal e usa médias históricas: acerta bem o ano e a economia acumulada, mas não o mês a mês de um ano específico. Cada ponto abaixo é um parâmetro isolado, e ajustá-lo não muda a estrutura do motor.

| Ponto | Por que é incerto | Como tratar |
| --- | --- | --- |
| Performance ratio | Depende de temperatura, sombra, sujeira e instalação | Calibrar com geração e contas reais |
| Simultaneidade | Depende do hábito de consumo | Perguntar ao cliente e calibrar com contas de quem já tem solar, que mostram a injeção |
| ICMS sobre o Fio B e a TUSD | Varia por UF e por interpretação da distribuidora | Comparar a linha de ICMS de uma conta real de cliente GD II |
| Bandeira sobre a energia compensada | O adicional pode incidir só sobre a energia faturada líquida | Conferir numa conta de mês com bandeira amarela ou vermelha |
| PIS e COFINS | A alíquota efetiva muda todo mês | Usar a média e conferir na conta |
| Regras depois de 2029 | A valoração da ANEEL ainda não foi publicada | Cenário conservador de 100%, atualizar o parâmetro quando sair |
| Irradiação de um ano específico | O Atlas é média de longo prazo | Tratar o resultado como estimativa |
| Dimensionamento de strings | Exige temperatura mínima local e dados elétricos do inversor | Fora do escopo: é avaliado pelo projetista |

## Referências

- [Lei 14.300/2022, texto atualizado](https://www2.camara.leg.br/legin/fed/lei/2022/lei-14300-6-janeiro-2022-792217-normaatualizada-pl.pdf)
- [ANEEL, Componentes Tarifárias (TUSD Fio B)](https://dadosabertos.aneel.gov.br/dataset/componentes-tarifarias)
- [LABREN/INPE, Atlas Brasileiro de Energia Solar, 2ª edição](https://labren.ccst.inpe.br/atlas_2017-en.html)
- [Canal Solar, valoração de custos e benefícios da GD](https://canalsolar.com.br/calculo-custos-beneficios-gd/)
