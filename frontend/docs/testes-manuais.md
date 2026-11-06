# Testes manuais

O frontend não tem testes automatizados. O build confere os tipos, e este roteiro confere o comportamento no navegador. Os valores em reais dependem das tarifas importadas e das configurações do banco, então o roteiro compara resultados em vez de fixar números.

Os testes criam simulações, clientes e orçamentos. Rode-os em um banco de desenvolvimento, nunca em produção.

## Preparação

Na primeira vez, prepare o banco a partir da pasta `backend`:

```
npm run db:migrate
npm run carregar-municipios
npm run carregar-atlas -- <caminho do CSV do Atlas>
npm run importar -- aneel-distribuidoras
npm run importar -- aneel-tarifas
npm run importar -- bcb-indicadores
npm run criar-admin
npm run dados-demo
```

- O CSV de irradiação (`tilted_latitude_means_sedes-munic.csv`) vem do Atlas Brasileiro de Energia Solar e é baixado à mão, porque não fica no repositório.
- `npm run dados-demo` é opcional: cria catálogo, clientes, simulações e orçamentos fictícios.

Depois, suba os dois serviços, cada um no seu terminal:

```
cd backend
npm run dev

cd frontend
npm run dev
```

- Crie um gestor e um operador em Usuários para conferir os papéis.
- Deixe o console do navegador aberto: nenhuma tela pode gerar erro nele.

CEPs úteis: `13730-250` (Mococa, uma distribuidora), `01310-100` (São Paulo, duas distribuidoras) e `00000-000` (inexistente).

## Site público

| Ação | Resultado esperado |
| --- | --- |
| Navegar pelo menu | Início, Soluções, Projetos, Simulador e Contato abrem sem erro |
| Rolar a página inicial | O cabeçalho começa transparente e fica sólido após a rolagem |
| Abrir uma rota inexistente | Página “não encontrada” |
| Clicar em exibir o mapa, no Contato | O mapa só carrega depois do clique |
| Enviar o formulário de contato | Abre o WhatsApp com a mensagem montada |
| Abrir o menu no celular | Abre, navega e fecha pelo teclado e pelo toque |

## Simulador: formulário

| Ação | Resultado esperado |
| --- | --- |
| Abrir `/simulador` | Só “Residencial” vem marcado |
| Clicar em “Ver minha economia” sem responder | Leva ao primeiro campo pendente e marca os demais |
| Responder uma pergunta depois disso | O aviso daquela pergunta some na hora |
| CEP `00000-000` | Mensagem de CEP não encontrado, sem ir ao resultado |
| CEP `01310-100` | Mostra as duas distribuidoras, com a mais comum marcada |
| Preencher parte dos 12 meses | Aponta os meses que faltam e abre o bloco |
| Informar a iluminação pública sem o valor da conta | Pede o valor da conta |
| Escolher uma direção e as horas de sol | Os desenhos acompanham a escolha |

## Simulador: resultado

| Ação | Resultado esperado |
| --- | --- |
| Marcar “Não sei” em tudo | Mostra “Calculado com valores típicos” e a conta “Hoje” |
| Informar valor e consumo reais da conta | A conta “Hoje” coincide com o valor informado, menos a iluminação pública, e a tarifa fica marcada como informada |
| Informar uma conta absurda (R$ 50 para 400 kWh) | Valores ignorados, com o aviso de conta fora do esperado |
| Informar aumento de 150 kWh | Texto e gráfico mostram a soma, e “Hoje” vira “Sem solar, com o aumento previsto” |
| Comparar telhado ao sul com pouco sol e telhado ao norte | O primeiro indica mais módulos e retorno mais longo. Com menos de 4 horas de sol, recomenda visita técnica |
| Informar área de 5 m² | Avisa da área insuficiente e mostra a cobertura abaixo de 100% |
| Informar pedido de ligação até 07/01/2023 | As premissas indicam GD I, sem cobrança de Fio B |
| Preencher os 12 meses | O consumo aparece como informado, “Mês a mês” |
| Abrir “Ver mês a mês” e “Ver ano a ano” | Tabelas com os mesmos números dos gráficos |

## Simulador: navegação

| Ação | Resultado esperado |
| --- | --- |
| Voltar pelo navegador a partir do resultado | Formulário com as respostas |
| Recarregar o resultado | Continua igual |
| “Revisar minhas respostas” | Formulário preenchido, com o link para voltar sem mudar nada |
| “Simulador” no menu, com o formulário preenchido | Recomeça do zero |
| Abrir `/simulador/resultado` em outra aba | Vai para o formulário |

## Pedido de proposta

| Ação | Resultado esperado |
| --- | --- |
| Enviar vazio | Marca nome, e-mail, telefone e aceite |
| Informar o número sem a rua | Pede a rua |
| Enviar sem a autorização de calibração | O pedido segue normalmente |
| Enviar completo | Mostra a confirmação, e o cliente aparece na área restrita com endereço, preferências e respostas |
| Enviar de novo a mesma simulação | Informa que o pedido já foi feito |

## Login e papéis

| Ação | Resultado esperado |
| --- | --- |
| Abrir `/admin` sem sessão | Vai ao login e, depois de entrar, volta à página pedida |
| Entrar com senha errada | Mensagem genérica, sem indicar qual dado errou |
| Entrar como operador | Menu sem Equipamentos, Configurações, Usuários e Importações |
| Operador abrir `/admin/usuarios` pela URL | “Sem permissão” |
| Entrar como gestor | Menu sem Importações. Não vê a conta do admin e só cria operadores |
| Entrar como admin | Menu completo. Pode criar gestor |
| Excluir um usuário com a sessão dele aberta | A próxima ação dele falha, e ele não consegue mais entrar |

## Atendimento

| Ação | Resultado esperado |
| --- | --- |
| Clicar nos números do painel | Abrem as listas já filtradas |
| Filtrar simulações por cidade, período e pedido | A URL guarda os filtros, e a lista respeita todos |
| Abrir um cliente | Mostra endereço, preferências, respostas de cada simulação e orçamentos |

## Orçamento

Comece em um cliente: “Criar orçamento”.

| Ação | Resultado esperado |
| --- | --- |
| Criar o orçamento | Abre em rascunho, com “Enviar” desligado até haver uma condição |
| Revisar uma premissa sem motivo | Pede o motivo |
| Informar aproveitamento de 95% | Mostra a faixa permitida |
| Revisar com motivo | Recalcula, marca a premissa como revisada e registra o motivo no histórico |
| Incluir desconto dentro do limite | O valor final cai, sem pedir justificativa |
| Somar descontos acima do limite | Pede justificativa |
| Incluir acréscimo em reais | O valor final sobe |
| Incluir condição com parcelas fora do limite | Aponta o limite da forma |
| Incluir condição válida | Mostra entrada, parcela, total e economia menos a parcela |
| Enviar | Pede confirmação; depois, o editor some e o orçamento abre só para leitura |
| Criar nova versão | Rascunho na versão seguinte, com ajustes e condições copiados. A anterior não muda |
| Criar outra versão com um rascunho aberto | Informa que já existe rascunho |
| Marcar como aceita | O status muda e o painel soma o valor |
| Abrir um orçamento vencido | Não oferece “aceita” e sugere nova versão |
| Excluir um rascunho | Pede confirmação e volta à lista |

## Impressão

Imprima um orçamento enviado com desconto e financiamento, ou salve em PDF.

- Saem menu, botões, editor, histórico e alertas.
- Entram valor final, ajustes, condições e “Estimado pelo simulador × este orçamento”.
- Não aparecem margem, justificativas nem observações internas.
- A logo sai sobre a faixa azul.
- As quebras de página não cortam tabelas nem gráficos.

## Configurações e cadastros

| Ação | Resultado esperado |
| --- | --- |
| Mudar a margem | O próximo cálculo de rascunho usa o valor novo; um orçamento enviado não muda |
| Ativar financiamento sem taxa | Pede a taxa |
| Ativar financiamento com taxa | Aparece nos orçamentos, e a parcela de referência aparece no simulador |
| Cadastrar equipamento | Aparece na lista e fica disponível para orçamentos |
| Desativar equipamento | Deixa de aparecer para novos orçamentos |
| Criar usuário com senha curta | Mostra o erro no campo |
| Criar usuário com e-mail de um usuário excluído | Informa que o e-mail já foi usado |
| Rodar “Atualizar agora” em Importações (admin) | Mostra o andamento e, ao final, o resultado |

## Em todas as telas

- Sem rolagem lateral em 360 px, 390 px e 1280 px.
- Dá para usar só com o teclado, com o foco sempre visível.
- Sem erros no console.
- Título da aba correto.
