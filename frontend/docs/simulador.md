# Simulador

O simulador estima a economia com energia solar pelas regras da Lei 14.300 e leva o visitante ao pedido de proposta.

A precisão vem de quem mora na casa: a conta de luz, os horários de consumo e o sol no telhado são dados que nenhuma base pública traz e que custam poucos cliques para responder. Por isso as perguntas ficam no início, antes do primeiro resultado, e todas aceitam “não sei”.

## Fluxo

```
/simulador                    formulário único, em cinco partes
   │  Ver minha economia
   ▼
/simulador/resultado          economia, retorno, premissas e pedido de proposta
   │  Revisar minhas respostas
   └─► /simulador             mesmo formulário, com as respostas preenchidas
```

Arquivos principais:

| Arquivo | Responsabilidade |
| --- | --- |
| `src/pages/publico/Simulador.tsx` | Página: apresentação, formulário e explicação das fontes |
| `src/components/simulador/FormularioSimulacao.tsx` | Estado do formulário, consulta do CEP, envio e erros |
| `src/components/simulador/SecoesDoFormulario.tsx` | As cinco partes do formulário |
| `src/components/simulador/dadosDaSimulacao.ts` | Tipo dos dados digitados, conferência e montagem do pedido à API |
| `src/components/simulador/IlustracoesDoTelhado.tsx` | Desenhos das horas de sol e da direção do telhado |
| `src/dados/perguntasDoSimulador.ts` | Rótulos das opções, compartilhados com a área restrita |
| `src/pages/publico/ResultadoSimulacao.tsx` | Tela de resultado |
| `src/components/simulador/BlocosDoResultado.tsx` | Alertas e premissas, compartilhados com o orçamento |
| `src/components/simulador/PedidoDeProposta.tsx` | Formulário do pedido de proposta |

## Perguntas

Cada dado é pedido uma vez só.

| Parte | Pergunta | Campo na API | Sem resposta |
| --- | --- | --- | --- |
| 1. Onde fica o imóvel | CEP | `cep` | Obrigatório |
| | Distribuidora, quando o município tem mais de uma | `distribuidora` | Vem marcada a mais comum, quando a API indica uma |
| | Tipo de imóvel | `subgrupo` | Vem marcado Residencial |
| 2. Sua conta de luz | Tipo de ligação | `tipoLigacao` | Obrigatório |
| | Consumo da última conta | `consumoMedioKwh` e `conta.consumoKwh` | Obrigatório |
| | Valor total da conta | `conta.valorReais` | Usa a tarifa oficial com os impostos do estado |
| | Iluminação pública | `conta.iluminacaoPublicaReais` | Não desconta nada |
| | Consumo dos últimos 12 meses (recolhido) | `consumoMensalKwh` | Repete o consumo informado nos 12 meses |
| 3. Como você usa a energia | Quando a casa mais usa energia | `perfilDeConsumo` | “Não sei”: simultaneidade típica |
| | Aumento previsto de consumo | `aumentoPrevistoKwh` | Sem aumento |
| 4. Seu telhado | Horas de sol direto | `telhado.horasDeSol` | “Não sei”: sem desconto |
| | Direção do telhado | `telhado.orientacao` | “Não sei”: sem desconto |
| | Inclinação | `telhado.inclinacao` | “Não sei”: sem desconto |
| | Onde os módulos seriam instalados | `telhado.tipo` | “Não sei”. Dado informativo para a equipe |
| | Área livre | `telhado.areaM2` | Sem limite de módulos |
| 5. Para terminar | Já tem energia solar e data do pedido de ligação | `solarExistente.protocoloEm` | Regra GD II |
| | Como prefere pagar | `pagamentoPreferido` | “Não sei”: a parcela de referência usa o financiamento |

### Como “não sei” funciona

- Nas perguntas de múltipla escolha nada vem marcado, e o visitante precisa escolher uma opção, inclusive “Não sei”. A resposta é sempre uma decisão consciente de quem conhece a casa.
- Os campos numéricos opcionais em branco valem como “não sei”.
- “Não sei” não vai para a API. Campo ausente faz o backend usar o valor típico, e o pedido sem nenhuma resposta opcional continua válido.

### Um consumo só

O “Consumo da última conta” serve a dois usos: é o consumo do cálculo e é o kWh usado com o valor da conta para chegar à tarifa que o cliente paga. Quem preenche os 12 meses tem o cálculo feito pela média deles, e o campo continua servindo à tarifa da conta.

Sem o histórico, o consumo de um mês é tratado como média do ano. Se esse mês fugir do normal, a estimativa fica deslocada, e o histórico corrige isso.

## Conferência dos campos

`conferirDados`, em `dadosDaSimulacao.ts`, aplica as mesmas regras do backend, que valida de novo:

| Campo | Regra |
| --- | --- |
| CEP | 8 números, com cidade encontrada e distribuidora com tarifa |
| Distribuidora | Obrigatória quando há mais de uma opção |
| Consumo | De 1 a 20.000 kWh |
| Valor da conta | De R$ 1 a R$ 1.000.000. Obrigatório se a iluminação pública for informada |
| Iluminação pública | De R$ 0 até menos que o valor da conta |
| 12 meses | Todos preenchidos ou todos em branco; cada um de 0 a 20.000 kWh; média de pelo menos 1 kWh |
| Aumento previsto | De 0 a 5.000 kWh por mês |
| Área | De 1 a 10.000 m² |
| Data do pedido de ligação | Não pode estar no futuro |

O CEP é consultado assim que tem 8 números e o resultado aparece logo abaixo do campo. Assim o visitante não preenche tudo para só no fim descobrir um CEP inválido ou uma região sem tarifa.

Ao clicar em “Ver minha economia” com pendências, a tela leva ao primeiro campo com problema. A partir daí a conferência acompanha a digitação, e cada aviso some assim que a resposta chega.

## Estado entre as telas

O resultado e as respostas viajam no estado do histórico do navegador (`EstadoDoResultado`), sem banco e sem armazenamento local:

```ts
interface EstadoDoResultado {
  simulacao?: Simulacao;      // a resposta da API
  dados?: DadosDaSimulacao;   // o que foi digitado
}
```

Ao calcular, a tela faz duas navegações: grava o estado na entrada atual de `/simulador` e abre `/simulador/resultado` com o mesmo estado. Com isso:

| Ação | Comportamento |
| --- | --- |
| Botão voltar do navegador | Formulário com as respostas |
| Recarregar o resultado | Mantém o resultado |
| “Revisar minhas respostas” | Formulário preenchido, com o link “Voltar ao resultado sem mudar nada” |
| “Simulador” no menu | Recomeça do zero |
| Abrir `/simulador/resultado` por link direto | Sem estado, redireciona para `/simulador` |

## Tela de resultado

De cima para baixo:

1. **Destaque:** a economia por mês em número grande, a economia no primeiro ano e em 25 anos, o botão para pedir a proposta e a comparação da conta com e sem solar.
2. **Números principais:** alertas, sistema indicado, investimento estimado, retorno e economia em 25 anos. Quando se aplica, a cobertura do consumo e a parcela de referência.
3. **Revisar respostas:** o que foi informado pelo visitante e o que foi estimado.
4. **Retorno em 25 anos:** gráfico do saldo acumulado, com tabela ano a ano.
5. **Consumo × geração:** gráfico do primeiro ano, com tabela mês a mês.
6. **Premissas e pedido de proposta:** cada premissa indica se foi “informado”, “estimado” ou, no orçamento, “revisado”.

### Aumento previsto

O aumento é somado ao consumo em todos os meses do cálculo. A economia e as contas passam a considerar o consumo futuro, e a economia pode até ficar maior que a conta atual do cliente. A tela deixa isso claro:

- a comparação troca “Hoje” por “Sem solar, com o aumento previsto”, e uma nota avisa que a conta de hoje é menor;
- o gráfico mostra a soma por extenso (por exemplo, “251 kWh de hoje + 150 kWh = 401 kWh por mês”) e renomeia a série.

### Telhado e cobertura

Um telhado menos favorável não reduz a geração: o backend aumenta o número de módulos para manter a geração, e o investimento e o retorno pioram. A geração só cai quando a área informada limita os módulos.

Quando a área ou o limite de ampliação seguram o sistema, `coberturaAlcancada` fica abaixo de 1. A tela mostra o percentual coberto, e o alerta correspondente explica o motivo.

### Alertas

O backend devolve alertas com código e mensagem. Para o visitante aparecem só os que afetam a sua decisão (`ALERTAS_DO_VISITANTE`, em `BlocosDoResultado.tsx`):

| Código | Situação |
| --- | --- |
| `CONSUMO_ABAIXO_DO_MINIMO` | Consumo abaixo do mínimo cobrado na ligação |
| `CREDITOS_VENCIDOS` | Parte dos créditos de energia vence sem uso |
| `TIR_NAO_CALCULAVEL` | Taxa interna de retorno não pôde ser calculada |
| `TARIFA_DESATUALIZADA` | A tarifa disponível já venceu |
| `FIO_B_DA_VIGENCIA_ANTERIOR` | O Fio B veio da vigência anterior da tarifa |
| `PREMISSAS_NAO_CALIBRADAS` | Premissas típicas, ainda sem calibração com contas reais |
| `ESTIMATIVA_FORA_DA_REGIAO_CALIBRADA` | Distribuidora fora da região usada na calibração |
| `CONTA_FORA_DO_ESPERADO` | Os valores da conta foram ignorados por parecerem errados |
| `AREA_INSUFICIENTE` | A área não comporta os módulos necessários |
| `VISITA_TECNICA_RECOMENDADA` | Menos de 4 horas de sol direto |
| `AMPLIACAO_LIMITADA` | Sistema limitado a 120% do consumo atual |

Os alertas técnicos de inversor (`RAZAO_CC_CA_FORA_DA_FAIXA`, `CEIFAMENTO`, `SEM_INVERSOR_COMPATIVEL`) aparecem só no orçamento, para a equipe.

### Contas feitas na tela

O cálculo é do backend. Na tela há apenas contas de exibição, feitas sobre valores já calculados, que não são gravadas nem enviadas de volta:

| Função | O que faz |
| --- | --- |
| `compararContas` (`ResultadoSimulacao.tsx`) | Média das 12 contas com e sem solar e o percentual de redução |
| `aumentoPrevistoKwh` (`BlocosDoResultado.tsx`) | Diferença entre o consumo médio dos meses e o consumo informado. A resposta da API não repete o aumento |

## Pedido de proposta

O formulário fica no fim do resultado e cria o cliente ligado àquela simulação. Cada simulação aceita um pedido.

| Campo | Obrigatório |
| --- | --- |
| Nome, e-mail e telefone com DDD | Sim |
| Aceite do uso dos dados | Sim |
| Endereço da instalação (rua, número, complemento, bairro) | Não. Se houver qualquer parte, a rua é exigida |
| Meio e melhor horário de contato | Não |
| Autorização para uso sem identificação na melhoria do simulador | Não |

Cidade e UF vêm do CEP e não são perguntadas de novo.

## Privacidade

- A simulação é gravada sem nome nem contato. O vínculo com uma pessoa só existe depois do pedido de proposta.
- O endereço fica só no cadastro do cliente, nunca na simulação.
- A autorização para melhorar o simulador é separada do aceite do pedido e não impede o pedido.
- O formulário de contato do site não grava dados: monta a mensagem e abre o WhatsApp.

Se um dado novo for coletado, atualize o texto e a data em `src/pages/publico/Privacidade.tsx`.

## Como acrescentar uma pergunta

1. Confirme que a API aceita o campo e inclua-o em `PedidoDeSimulacao` (`services/api.ts`).
2. Em `dadosDaSimulacao.ts`, acrescente o campo a `DadosDaSimulacao` e a `DADOS_VAZIOS`, a conferência e a montagem em `montarPedido`.
3. Coloque a pergunta na parte que faz sentido em `SecoesDoFormulario.tsx`, sem repetir dados já pedidos. Se for múltipla escolha, use `comNaoSei` e guarde os rótulos em `dados/perguntasDoSimulador.ts`.
4. Mostre a resposta à equipe em `src/components/admin/RespostasDoCliente.tsx`.
5. Atualize a Privacidade, a tabela de perguntas e o [roteiro de testes](testes-manuais.md).
