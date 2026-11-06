# Área restrita

Área usada pela equipe para atender os pedidos, montar orçamentos e administrar as regras comerciais. Fica em `/admin`.

## Papéis

| Papel | Quem é | O que acessa |
| --- | --- | --- |
| `admin` | A pessoa de TI, criada por script no backend (`npm run criar-admin`) | Tudo, inclusive importações e a criação de gestores |
| `gestor` | Responsável pela operação, criado pelo admin | Tudo, menos importações. Não vê nem altera a conta do admin |
| `operador` | Demais usuários, criados pela gestão | Painel, clientes, simulações e orçamentos |

| Tela | Operador | Gestor | Admin |
| --- | --- | --- | --- |
| Painel, Clientes, Simulações, Orçamentos | Sim | Sim | Sim |
| Equipamentos, Configurações, Usuários | Não | Sim | Sim |
| Importações | Não | Não | Sim |

As regras estão em `src/utils/papeis.ts` (`temAcesso` e os níveis `equipe`, `gestao` e `admin`). O menu em `LayoutAdmin.tsx` e a guarda `RotaDoNivel` usam essas regras. Elas só organizam a tela: **quem decide é a API**, lendo o papel no banco a cada requisição. Excluir ou rebaixar um usuário vale na hora, mesmo com a sessão aberta.

## Telas

### Painel

Mostra o caminho do atendimento: pedidos novos, orçamentos em rascunho, enviados (com os vencidos) e aceitos (com os recusados). Abaixo, o valor aceito no mês e as contagens de clientes e simulações. Cada número leva à lista filtrada. O admin também vê a situação da última importação de tarifas.

### Clientes

Lista com busca por nome ou e-mail. O detalhe traz:

- contato, CEP, endereço da instalação e preferências de contato;
- registro do aceite do uso dos dados e da autorização de calibração;
- cada simulação, com todas as respostas que o cliente deu sobre a casa (`RespostasDoCliente`);
- os orçamentos do cliente e o botão para criar um novo a partir de uma simulação.

### Simulações

Tudo o que passou pelo simulador, com filtros por período, cidade e existência de pedido de proposta. Simulação sem pedido não tem cliente e não pode virar orçamento.

### Orçamentos

Lista com filtros por status: rascunho, enviada, aceita, recusada e vencida. O detalhe é o editor, descrito abaixo.

### Equipamentos

Catálogo de módulos e inversores: cadastro, preço e ativação. Só equipamentos ativos aparecem para novos orçamentos. Mudar o preço afeta os próximos cálculos de rascunho, nunca um orçamento enviado.

### Configurações

**Configuração comercial:** margem, instalação por kWp, custo de referência por kWp (usado no investimento estimado do simulador público), validade do orçamento e limite de desconto sem justificativa.

**Formas de pagamento:** à vista, parcelado e financiado, com taxa ao mês, limites de parcelas, entrada mínima, carência e desconto à vista. Parcelado e financiado só podem ficar ativos com a taxa preenchida (zero significa sem juros). As formas ativas aparecem no simulador e nos orçamentos.

As alterações valem para os próximos cálculos: orçamento enviado guarda os valores que usou.

### Usuários

| Ação | Regra |
| --- | --- |
| Criar | Senha de 10 a 72 caracteres. O gestor cria operadores; só o admin cria gestores |
| Editar | Nome, e-mail e papel. A própria conta não muda de papel pela tela, para ninguém perder o acesso sem querer |
| Redefinir senha | Feita pela gestão |
| Excluir | Bloqueia o login na hora, mantém a conta ligada ao histórico dos orçamentos e não libera o e-mail para uso de novo. Ninguém exclui a própria conta |
| Conta do admin | Só muda por script. O gestor nem a vê na lista |

### Importações

Exclusiva do admin. Mostra cada importação de dados oficiais, a agenda em texto (“Todo dia às 06:00”), a última execução e um aviso quando os dados estão desatualizados. O botão “Atualizar agora” roda a importação e aguarda o fim.

## Ciclo do orçamento

```
              enviar                 marcar
 rascunho ─────────────► enviada ─────────────► aceita ou recusada
    ▲                       │
    │     nova versão       │  validade passou
    └───────────────────────┤  (vencida: não pode ser aceita)
```

| Estado | O que pode acontecer |
| --- | --- |
| `rascunho` | Editar tudo. Cada alteração recalcula com a tarifa, os preços e a configuração do dia. Pode ser excluído |
| `enviada` | Congelada: reabrir só lê a cópia gravada, e a edição fica indisponível. Pode mudar de status, gerar nova versão ou ser duplicada |
| `aceita` e `recusada` | Mesmas ações do enviado, sem edição |
| Vencida | Não é um status gravado: é `enviada` com a validade passada (`vencida: true`). Pode ser recusada ou refeita em nova versão |

**Nova versão** cria um rascunho ligado ao mesmo orçamento, com ajustes, condições e revisão copiados e valores do dia. A versão anterior não muda, e só pode haver um rascunho aberto por orçamento.

**Duplicar** cria outro orçamento, na versão 1, para comparar opções.

## Editor do rascunho

Fica em `src/pages/admin/DetalheDaProposta.tsx` e `src/components/admin/orcamento/`. Toda alteração é enviada à API, que devolve o orçamento recalculado, e a tela substitui o que mostra. Nenhum preço é calculado no navegador.

| Bloco | Componente | O que faz |
| --- | --- | --- |
| Resumo | `DetalheDaProposta.tsx` | Preço calculado, ajustes, valor final, validade e composição interna do preço. Botões de imprimir, excluir e enviar |
| Equipamentos e revisão | `EquipamentosERevisao.tsx` | Troca módulo e inversor. Revisa quantidade de módulos, aproveitamento (70% a 85%), consumo na hora da geração (10% a 70%) e dados do telhado. Exige motivo, que fica no histórico. Campo vazio mantém o valor atual |
| Descontos e acréscimos | `Ajustes.tsx` | Valor em reais ou percentual sobre o preço calculado. Descontos acima do limite da configuração exigem justificativa |
| Condições de pagamento | `Condicoes.tsx` | Escolhe uma forma ativa, com entrada, parcelas e carência dentro dos limites. A parcela vem da API (tabela Price), com a economia mensal menos a parcela. Um novo ajuste refaz as condições |
| Observações internas | `DetalheDaProposta.tsx` | Só a equipe vê |
| Histórico e versões | `HistoricoEVersoes.tsx` | Quem fez o quê, quando e por quê. Links para as outras versões |

O envio exige ao menos uma condição de pagamento e pede confirmação, porque depois dele o orçamento não muda. A exclusão do rascunho também pede confirmação (`BotaoComConfirmacao`).

## Documento impresso

`DocumentoDoOrcamento.tsx` é o que o cliente recebe, impresso ou em PDF pelo botão de imprimir do navegador. As classes `print:hidden` escondem menu, editor, histórico e botões. No rascunho, um aviso identifica a prévia.

| Entra | Não entra |
| --- | --- |
| Dados do cliente, local e distribuidora | Margem e composição interna do preço |
| Sistema, valor final, economia e retorno | Justificativas de ajustes e de revisões |
| Equipamentos e quantidades | Observações internas |
| Ajustes, do preço calculado ao valor final | Histórico |
| Condições de pagamento | Alertas técnicos |
| “Estimado pelo simulador × este orçamento” | |
| Gráfico de consumo × geração e premissas | |

Antes de imprimir um documento novo, confira as quebras de página no PDF.

## Padrões de tela

- **Lista:** título com `Titulo`, filtros na URL, `EstadoDaCarga` para carregando e erro, `Tabela` e `Paginacao`.
- **Status:** `SeloDeStatus` usa ícone e texto, nunca só cor.
- **Ação perigosa:** `BotaoComConfirmacao` pede confirmação ao lado do botão, sem janela modal.
- **Erro:** no campo, quando a API indica qual, ou em `Aviso`, quando é geral (`mensagemGeral`).
- **Título da aba:** `useTituloDaPagina('Nome — Solar Gestão')`.

As peças ficam em `src/components/admin/Pecas.tsx`.
