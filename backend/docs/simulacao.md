# Simulação

Como um pedido do visitante vira um resultado. A simulação funciona em qualquer município do Brasil, lê tarifa, irradiação e indicadores só do banco e nunca chama a ANEEL. A única consulta externa é o ViaCEP, e só quando o CEP não está em cache.

O resultado é uma estimativa: o valor final sai do [orçamento](orcamentos.md), revisado pela equipe.

## Etapas

Em `services/simulacaoService.ts`:

1. **CEP → município → distribuidora.** O backend confere a distribuidora escolhida.
2. **Referências:** tarifa vigente, Fio B, irradiação, IPCA em 12 meses, Selic e configuração comercial. Faltando qualquer uma, responde `503 SIMULACAO_INDISPONIVEL`.
3. **Entrada do motor:** junta as referências, as respostas do cliente e os parâmetros.
4. **Cálculo:** `simular(entrada)` ([motor-de-calculo.md](motor-de-calculo.md)).
5. **Alertas e formatação:** soma os avisos sobre os dados usados e arredonda os números para a saída.
6. **Gravação:** guarda o pedido, a entrada do motor e o resultado em `simulacao`, e devolve o `codigo` público.

## Do CEP à distribuidora

1. O CEP é procurado em `cep_cache`. Se não estiver lá, o ViaCEP informa cidade, UF e código IBGE, e o par CEP e município vai para o cache. O endereço nunca é guardado no cache.
2. Só entram distribuidoras com tarifa vigente ou vencida há até 13 meses (390 dias). Isso tira do caminho as incorporadas, que não têm tarifa nova.
3. As opções do município dependem do vínculo importado da ANEEL:

| Situação | Opções | Comportamento |
| --- | --- | --- |
| Uma distribuidora ligada | Uma | Escolha automática, `escolhaNecessaria: false` |
| Várias ligadas (cooperativas, por exemplo) | Todas | O cliente escolhe; a de mais conjuntos no município vem com `sugerida: true` |
| Município sem vínculo na ANEEL | As da UF | O cliente escolhe; nenhuma sugerida |
| Nenhuma com tarifa, ou município fora do banco | Nenhuma | `atendido: false` e `422 REGIAO_NAO_ATENDIDA` ao simular |

Com mais de uma opção, `POST /simulacoes` exige `distribuidora` (`DISTRIBUIDORA_OBRIGATORIA`) e recusa um CNPJ fora da lista (`DISTRIBUIDORA_INVALIDA`). A tarifa segue a distribuidora escolhida e o ICMS segue a UF do município.

## Premissas de partida

| Item | De onde vem |
| --- | --- |
| Tarifa | A vigente hoje da distribuidora, por subgrupo e classe: B1 residencial, B2 rural, B3 demais |
| Fio B | O da vigência. Sem publicação, o último publicado, corrigido pela variação da TUSD, com o alerta `FIO_B_DA_VIGENCIA_ANTERIOR` |
| Irradiação | Atlas 2017, sede do município, plano inclinado igual à latitude |
| Reajuste anual | IPCA em 12 meses (série 13522) |
| Taxa de desconto | Selic meta (série 432) |
| Tributos | `tributos-por-uf.json`, pela faixa do consumo médio |
| Módulo e inversor | De referência, em `parametros.json` |
| Investimento | kWp × `custoReferenciaPorKwp` da configuração comercial, marcado como estimado |
| Conexão prevista | O mês seguinte ao da simulação, no fuso de São Paulo |
| Bandeira | Verde (adicional zero) |

## Respostas do cliente

Todas são opcionais: sem resposta, vale o valor típico e o resultado é o mesmo da simulação rápida. Cada resposta é tratada como não confiável: fora do esperado, é ignorada e o resultado avisa. As regras ficam em `services/refinamento.ts`.

| Campo | Valores | Efeito |
| --- | --- | --- |
| `conta` | `{ valorReais, consumoKwh, iluminacaoPublicaReais? }` | Substitui o ICMS do estado pela alíquota implícita na conta |
| `consumoMensalKwh` | 12 números, de janeiro a dezembro | Consumo mês a mês; a média vira o consumo médio |
| `perfilDeConsumo` | `noite`, `equilibrado`, `dia` | Define a simultaneidade |
| `telhado.horasDeSol` | `diaTodo`, `de6a8`, `de4a6`, `menosDe4` | Fator sobre a irradiação; `menosDe4` avisa `VISITA_TECNICA_RECOMENDADA` |
| `telhado.orientacao` | `norte`, `nordeste`, `noroeste`, `leste`, `oeste`, `sudeste`, `sudoeste`, `sul`, `plano` | Fator sobre a irradiação |
| `telhado.inclinacao` | `plano`, `pouca`, `media`, `muita` | Fator sobre a irradiação |
| `telhado.tipo` | `ceramica`, `metalico`, `fibrocimento`, `laje`, `solo` | Só informativo, para quem orça |
| `telhado.areaM2` | 1 a 10.000 | Limita os módulos a área ÷ 2,8 m², com pelo menos 1 |
| `solarExistente` | `{ protocoloEm }` | Até 07/01/2023: GD I, sem Fio B. Depois disso: GD II |
| `aumentoPrevistoKwh` | 0 a 5.000 | Soma a cada mês do consumo, com o limite de cobertura abaixo |
| `pagamentoPreferido` | `avista`, `parcelado`, `financiado` | Escolhe a forma de `parcelaEstimada` |

Os valores dos fatores estão em [parametros.md](parametros.md#parametrosjson).

### Telhado

Os fatores de orientação, inclinação e horas de sol são multiplicados e aplicados à irradiação. O Atlas vale para um telhado voltado ao norte, inclinado na latitude e sem sombra, e os fatores corrigem esse caso ideal.

**Com um telhado pior, a geração se mantém e o sistema cresce:** o dimensionamento pede mais módulos para gerar o mesmo, o investimento sobe e o payback piora. A geração só cai quando a área limita os módulos. Nesse caso, `coberturaAlcancada` fica abaixo de 1 e o motor avisa `AREA_INSUFICIENTE`.

### Conta de luz

```
tarifa efetiva   = (valor − iluminação pública) ÷ kWh
alíquota implícita = 1 − (TE + TUSD) ÷ tarifa efetiva
```

A alíquota implícita substitui o ICMS, e PIS e COFINS seguem na média. A conta é ignorada, com o alerta `CONTA_FORA_DO_ESPERADO`, quando:

- a alíquota implícita fica fora de 10% a 45%;
- a tarifa efetiva fica mais de 30% longe da tarifa calculada;
- a tarifa efetiva não é positiva.

Isso pega digitação errada e contas com compensação de quem já tem solar.

### Aumento de consumo previsto

O aumento é somado a cada mês, mas o sistema cobre esse consumo futuro só até 120% do consumo atual, porque a distribuidora costuma pedir comprovação de carga acima disso:

```
cobertura = mín(cobertura padrão, consumo médio × 1,20 ÷ (consumo médio + aumento))
```

Quando o limite atua, o resultado avisa `AMPLIACAO_LIMITADA`.

### Parcela estimada

Referência para o cliente, nunca um valor final. Usa a forma preferida ou, sem resposta, o financiamento. Entre as formas ativas do tipo, fica a de menor taxa; sem nenhuma, `parcelaEstimada` é `null`.

- **À vista:** investimento × (1 − desconto).
- **Demais:** entrada mínima da forma e tabela Price no máximo de parcelas.

Com os valores iniciais, só "À vista" está ativa: sem preferência informada, `parcelaEstimada` é `null` até a gestão ativar o financiamento.

## Origem das premissas

`premissas.origem` diz de onde veio cada premissa, para a tela mostrar o que é medido e o que é estimado:

| Valor | Significado |
| --- | --- |
| `informado` | Veio do cliente |
| `estimado` | Valor típico ou oficial, sem resposta do cliente |
| `revisado` | Alterado pela equipe na revisão de um orçamento |

Campos: `performanceRatio`, `simultaneidade`, `tributos`, `telhado` e `consumoMensal`. `premissas.telhado.fator` é o produto dos fatores aplicados.

## Alertas

Além dos [alertas do motor](motor-de-calculo.md#alertas-do-motor), a simulação pode devolver:

| Código | Quando |
| --- | --- |
| `TARIFA_DESATUALIZADA` | A vigência da tarifa usada já venceu |
| `FIO_B_DA_VIGENCIA_ANTERIOR` | A ANEEL não publicou o Fio B da tarifa atual |
| `PREMISSAS_NAO_CALIBRADAS` | `calibracao.calibrada` é `false`: vale em todas as distribuidoras |
| `ESTIMATIVA_FORA_DA_REGIAO_CALIBRADA` | Depois da calibração, em outra distribuidora que não a das contas |
| `CONTA_FORA_DO_ESPERADO` | A conta informada foi ignorada |
| `VISITA_TECNICA_RECOMENDADA` | Menos de 4 horas de sol direto |
| `AMPLIACAO_LIMITADA` | O aumento previsto passa do limite de cobertura |

Com o perfil de consumo informado, o aviso de calibração fala só do aproveitamento do sistema, porque a simultaneidade já veio do cliente.

Os alertas de inversor (`RAZAO_CC_CA_FORA_DA_FAIXA`, `CEIFAMENTO`, `SEM_INVERSOR_COMPATIVEL`) são técnicos: na simulação pública, o inversor é só uma referência.

## O que fica gravado

Em `simulacao`:

- `codigo`: UUID público. O id sequencial nunca sai do backend.
- `cep`, `codigo_ibge`, `tarifa_id`, `irradiacao_id` e `versao_parametros`: o que foi usado.
- `entrada`: `{ pedido, motor }`, com o pedido do cliente e a entrada completa do motor, com os decimais em texto.
- `resultado`: a mesma resposta da API, sem o código.
- `cliente_id`: preenchido só pelo pedido de proposta.

O endereço do cliente nunca entra aqui: fica só no cadastro, em `cliente`.

## Pedido de proposta

`POST /clientes` trava a linha da simulação numa transação, cria o cliente com o CEP da simulação e liga os dois. Por isso, dois pedidos para a mesma simulação não criam dois clientes: o segundo recebe `409 PEDIDO_JA_ENVIADO`.

Cada pedido cria um cliente, e um pedido público nunca altera um cliente existente. O aceite do uso dos dados é obrigatório, e a autorização para calibração é um consentimento separado.
