# Referência da API

Base: `/api`. Em desenvolvimento, `http://localhost:3333/api`.

## Convenções

- **Formato:** JSON nos dois sentidos, com corpo de até 100 kB. Campos das respostas em `camelCase`.
- **Datas:** instantes em ISO 8601 (UTC). Datas de calendário em `AAAA-MM-DD`.
- **Números arredondados na saída:** reais com 2 casas, kWh com 1, tarifas com 6, frações com 4. Frações valem 0.2 para 20%.
- **Campos desconhecidos são recusados:** qualquer campo não declarado em body ou query devolve `400 ENTRADA_INVALIDA`. Isso também impede o site de enviar preços ou premissas.
- **Paginação:** `pagina` (padrão 1) e `porPagina` (padrão 20). Acima de 100 vira 100, sem erro. A resposta traz `pagina`, `porPagina` e `total`.

### Sessão

`POST /auth/login` grava o cookie `sessao`: JWT de 8 horas, `HttpOnly`, `SameSite=Lax` e `Secure` em produção. O site nunca lê o token; o navegador envia o cookie sozinho. Se site e API estiverem em origens diferentes, use `credentials: 'include'` no `fetch`.

### Níveis de acesso

| Nível | Quem | O que faz |
| --- | --- | --- |
| **Público** | Qualquer visitante | Simular e pedir proposta |
| **Logado** | Qualquer usuário com sessão | Consultar o próprio usuário |
| **Equipe** | `admin`, `gestor`, `operador` | Painel, clientes, simulações e orçamentos; lê catálogo, configuração e formas de pagamento |
| **Gestão** | `admin`, `gestor` | Usuários, catálogo, configuração e formas de pagamento |
| **Admin** | `admin` | Importações de dados |

Detalhes em [seguranca.md](seguranca.md#papéis).

### Formato de erro

Toda resposta de erro tem o mesmo formato. `fields` só aparece em erro de validação e diz o campo e o motivo:

```json
{ "error": { "code": "ENTRADA_INVALIDA", "message": "Dados inválidos. Confira os campos.", "fields": { "email": "E-mail inválido." } } }
```

A [tabela completa de códigos](#códigos-de-erro) está no fim desta página.

## Saúde

| Método e rota | Acesso | Resposta |
| --- | --- | --- |
| `GET /health` | Público, sem limite | `200 { status: "ok", banco: "ok" }` ou `503 { status: "erro", banco: "erro" }` |

## Autenticação

| Método e rota | Acesso | Body | Resposta |
| --- | --- | --- | --- |
| `POST /auth/login` | Público, 5 tentativas a cada 15 min por IP | `{ email, senha }` | `200 { usuario: { id, nome, email, papel } }` e o cookie; `401 CREDENCIAIS_INVALIDAS` |
| `POST /auth/logout` | Público | — | `204` e apaga o cookie |
| `GET /auth/me` | Logado | — | `200 { usuario: { id, nome, email, papel } }`; `401` sem sessão válida |

E-mail errado e senha errada recebem a mesma resposta, de propósito.

## Simulador (público)

| Método e rota | Limite por IP | Body | Resposta |
| --- | --- | --- | --- |
| `GET /cep/:cep` | 30/min | — | `200` (abaixo); `400`; `404 CEP_NAO_ENCONTRADO`; `503 CEP_INDISPONIVEL` |
| `GET /formas-pagamento` | 30/min | — | `200 { formas: [{ nome, tipo }] }`: só as ativas e sem taxas |
| `POST /simulacoes` | 30/min | Abaixo | `201 { simulacao }`; `400` (inclui `DISTRIBUIDORA_OBRIGATORIA` e `DISTRIBUIDORA_INVALIDA`); `404 CEP_NAO_ENCONTRADO`; `422 REGIAO_NAO_ATENDIDA`; `503 CEP_INDISPONIVEL` ou `SIMULACAO_INDISPONIVEL` |
| `POST /clientes` | 5/min | Abaixo | `201 { mensagem }`, sem dados do cliente; `400`; `404 SIMULACAO_NAO_ENCONTRADA`; `409 PEDIDO_JA_ENVIADO` |

### `GET /cep/:cep`

```json
{
  "cep": "13730250", "cidade": "Mococa", "uf": "SP", "atendido": true,
  "distribuidoras": [{ "cnpj": "53859112000169", "sigla": "CPFL Santa Cruz", "sugerida": false }],
  "escolhaNecessaria": false
}
```

Como as opções são definidas está em [simulacao.md](simulacao.md#do-cep-à-distribuidora).

### `POST /simulacoes`

| Campo | Obrigatório | Formato |
| --- | --- | --- |
| `cep` | Sim | 8 números, com ou sem hífen |
| `tipoLigacao` | Sim | `monofasico`, `bifasico`, `trifasico` |
| `subgrupo` | Não, padrão `B1` | `B1` residencial, `B2` rural, `B3` demais |
| `consumoMedioKwh` | Sem `consumoMensalKwh`, sim | 1 a 20.000 |
| `distribuidora` | Com mais de uma opção no CEP, sim | CNPJ, 14 números |
| `conta` | Não | `{ valorReais (1 a 1.000.000), consumoKwh (1 a 100.000), iluminacaoPublicaReais? (0 a 10.000, menor que o valor) }` |
| `consumoMensalKwh` | Não | 12 números de 0 a 20.000, de janeiro a dezembro, com média de pelo menos 1. Se vier, a média deles substitui `consumoMedioKwh` |
| `perfilDeConsumo` | Não | `noite`, `equilibrado`, `dia` |
| `telhado` | Não | `{ horasDeSol?, orientacao?, inclinacao?, tipo?, areaM2? (1 a 10.000) }` |
| `solarExistente` | Não | `{ protocoloEm: "AAAA-MM-DD" }`, sem data futura |
| `aumentoPrevistoKwh` | Não | 0 a 5.000 |
| `pagamentoPreferido` | Não | `avista`, `parcelado`, `financiado` |

O efeito de cada resposta e os valores possíveis estão em [simulacao.md](simulacao.md#respostas-do-cliente). Resposta:

```json
{ "simulacao": {
  "codigo": "a1f811c5-…", "local": { "cidade": "Mococa", "uf": "SP" },
  "pedido": { "tipoLigacao": "monofasico", "subgrupo": "B1", "consumoMedioKwh": 400 },
  "dimensionamento": { "numeroModulos": 6, "potenciaModuloW": 550, "kwpInstalado": 3.3, "inversorKw": 3 },
  "investimentoEstimado": { "valor": 13200, "aviso": "Valor estimado; o valor final vem na proposta." },
  "coberturaAlcancada": 1.0337,
  "parcelaEstimada": null,
  "indicadores": { "economiaPrimeiroAno": 4227.39, "economiaMensalMedia": 352.28, "economiaTotal": 169836.47,
                   "vpl": 22776.17, "tir": 0.3408, "paybackSimplesAnos": 3.1, "paybackDescontadoAnos": 4.3 },
  "primeiroAno": [{ "anoCivil": 2026, "mes": 12, "consumoKwh": 400, "geracaoKwh": 419, "faturaSemSolar": 424.88,
                    "faturaComSolar": 58.7, "economia": 366.18 }, "… 12 meses"],
  "resumoAnual": [{ "ano": 1, "geracaoKwh": 4961.8, "economia": 4227.39, "fluxoDeCaixa": 4161.39, "fluxoAcumulado": -9038.61 }, "… 25 anos"],
  "premissas": { "distribuidora": "CPFL Santa Cruz", "vigenciaDaTarifa": { "inicio": "2026-04-22", "fim": "2027-04-21" },
                 "tarifaSemImpostos": { "te": 0.25219, "tusd": 0.56039, "fioB": 0.272853 }, "tarifaComImpostos": 1.062196,
                 "tributos": { "icms": 0.18, "pis": 0.01, "cofins": 0.045 }, "hspMedio": 5.28, "performanceRatio": 0.78,
                 "simultaneidade": 0.3, "consumoMinimoKwh": 30, "reajusteAnual": 0.0458, "taxaDesconto": 0.1375,
                 "inicio": { "ano": 2026, "mes": 12 }, "regime": "GD_II", "versaoParametros": "2026-11-04",
                 "origem": { "performanceRatio": "estimado", "simultaneidade": "estimado", "tributos": "estimado",
                             "telhado": "estimado", "consumoMensal": "estimado" },
                 "telhado": { "fator": 1 } },
  "alertas": [{ "codigo": "RAZAO_CC_CA_FORA_DA_FAIXA", "mensagem": "Razão CC/CA de 1,10, fora da faixa de 1,15 a 1,35." }]
} }
```

- `primeiroAno` serve ao gráfico de consumo × geração e `resumoAnual` ao gráfico de retorno.
- `tir` é fração: 0.3408 = 34,08% ao ano. `tir` e os paybacks podem ser `null`.
- `coberturaAlcancada`: geração do 1º ano ÷ consumo do ano.
- `parcelaEstimada`: `{ forma, tipo, parcelas, entrada, taxaMensal, valorParcela }` ou `null`.

### `POST /clientes`

Pedido de proposta: cria o cliente e o liga à simulação. Cada simulação aceita um pedido só.

| Campo | Obrigatório | Formato |
| --- | --- | --- |
| `simulacao` | Sim | `codigo` devolvido por `POST /simulacoes` |
| `nome` | Sim | 2 a 120 caracteres |
| `email` | Sim | Guardado em minúsculas |
| `telefone` | Sim | Aceita máscara, precisa ter DDD (10 ou 11 números) |
| `aceite` | Sim | Precisa ser `true` (LGPD) |
| `endereco` | Não | `{ logradouro, numero?, complemento?, bairro? }` |
| `contatoPreferido` | Não | `whatsapp`, `telefone`, `email` |
| `melhorHorario` | Não | `manha`, `tarde`, `noite` |
| `autorizaUsoParaCalibracao` | Não | Booleano, separado do aceite: sem ele, o pedido segue normal |

## Painel, clientes e simulações

| Método e rota | Acesso | Entrada | Resposta |
| --- | --- | --- | --- |
| `GET /admin/painel` | Equipe | — | `200 { painel }` (abaixo) |
| `GET /admin/clientes` | Equipe | Query: `busca?` (nome ou e-mail), `pagina?`, `porPagina?` | `200 { clientes: [{ id, nome, email, telefone, criadoEm }], pagina, porPagina, total }`; `400` |
| `GET /admin/clientes/:id` | Equipe | — | `200 { cliente, simulacoes, propostas }` (abaixo); `400`; `404 CLIENTE_NAO_ENCONTRADO` |
| `GET /admin/simulacoes` | Equipe | Query: `de?`, `ate?` (`AAAA-MM-DD`, dias de São Paulo), `cidade?` (trecho do nome), `comPedido?` (`true`, `false`), `pagina?`, `porPagina?` | `200 { simulacoes: [{ codigo, criadaEm, cidade, uf, distribuidora, tipoLigacao, consumoMedioKwh, kwpInstalado, investimentoEstimado, economiaMensalMedia, cliente: { id, nome } \| null }], pagina, porPagina, total }`; `400` |

**Painel:**

```json
{ "painel": {
  "clientes": 8, "simulacoes": 12, "simulacoesComPedido": 8, "pedidosNovos": 2,
  "propostasPorStatus": { "rascunho": 1, "enviada": 4, "aceita": 2, "recusada": 1 },
  "propostasVencidas": 1, "valorAceitoNoMes": 25000,
  "ultimaImportacaoDeTarifas": { "status": "sucesso", "finalizadaEm": "2026-11-04T09:00:12.000Z" }
} }
```

`pedidosNovos` são os pedidos que ainda não viraram orçamento. `propostasPorStatus.enviada` inclui as vencidas. `ultimaImportacaoDeTarifas` pode ser `null`.

**Detalhe do cliente:**

- `cliente`: `{ id, nome, email, telefone, criadoEm, cep, aceiteEm, contatoPreferido, melhorHorario, autorizaUsoParaCalibracao, endereco: { logradouro, numero, complemento, bairro } | null }`
- `simulacoes`: `[{ codigo, criadaEm, cidade, distribuidora, tipoLigacao, consumoMedioKwh, kwpInstalado, investimentoEstimado, economiaMensalMedia, respostas }]`. `respostas` é o pedido como o cliente enviou.
- `propostas`: `[{ id, status, investimento, validaAte, vencida, criadoEm }]`

## Catálogo de equipamentos

| Método e rota | Acesso | Entrada | Resposta |
| --- | --- | --- | --- |
| `GET /admin/equipamentos` | Equipe | Query: `tipo?` (`modulo`, `inversor`) | `200 { equipamentos: [{ id, tipo, fabricante, modelo, potenciaW, degradacaoAnual, preco, ativo }] }` |
| `POST /admin/equipamentos` | Gestão | `{ tipo, fabricante, modelo, potenciaW, degradacaoAnual?, preco }` | `201 { equipamento }`; `400`; `409 EQUIPAMENTO_DUPLICADO` |
| `PATCH /admin/equipamentos/:id` | Gestão | `{ preco?, ativo? }`, ao menos um | `200 { equipamento }`; `400`; `404 EQUIPAMENTO_NAO_ENCONTRADO` |

Módulo tem de 100 a 800 W. Só módulo tem degradação (0,002 a 0,01). Preço com até 2 casas. Preço novo vale só para os próximos cálculos de rascunho.

## Configuração comercial e formas de pagamento

| Método e rota | Acesso | Body | Resposta |
| --- | --- | --- | --- |
| `GET /admin/configuracoes-comerciais` | Equipe | — | `200 { configuracao: { margem, instalacaoPorKwp, custoReferenciaPorKwp, validadeDias, limiteDesconto, alteradoEm } }` |
| `PATCH /admin/configuracoes-comerciais` | Gestão | Os mesmos campos, menos `alteradoEm`, ao menos um | `200 { configuracao }`; `400` |
| `GET /admin/formas-pagamento` | Equipe | — | `200 { formas: [{ id, tipo, nome, taxaMensal, parcelasMinimas, parcelasMaximas, entradaMinima, carenciaMaximaDias, descontoAvista, ativa }] }` |
| `POST /admin/formas-pagamento` | Gestão | `{ tipo, nome, taxaMensal?, parcelasMinimas?, parcelasMaximas?, entradaMinima?, carenciaMaximaDias?, descontoAvista?, ativa? }` | `201 { forma }`; `400`; `409 FORMA_DUPLICADA` |
| `PATCH /admin/formas-pagamento/:id` | Gestão | Os mesmos campos, menos `tipo`, ao menos um | `200 { forma }`; `400`; `404 FORMA_NAO_ENCONTRADA`; `409 FORMA_DUPLICADA` |

`taxaMensal` é fração ao mês (0.015 = 1,5%); `null` significa não definida. Faixas e regras em [parametros.md](parametros.md#configuração-comercial).

## Usuários

| Método e rota | Acesso | Body | Resposta |
| --- | --- | --- | --- |
| `GET /admin/usuarios` | Gestão | — | `200 { usuarios: [{ id, nome, email, papel, criadoEm }] }`. O gestor não vê a conta do admin |
| `POST /admin/usuarios` | Gestão | `{ nome, email, senha, papel }` | `201 { usuario: { id, nome, email, papel } }`; `400`; `403`; `409 EMAIL_EM_USO` |
| `PATCH /admin/usuarios/:id` | Gestão | `{ nome?, email?, papel? }`, ao menos um | `200 { usuario }`; `400`; `403`; `404 USUARIO_NAO_ENCONTRADO`; `409 EMAIL_EM_USO` |
| `POST /admin/usuarios/:id/senha` | Gestão | `{ senha }` | `204`; `400`; `403`; `404 USUARIO_NAO_ENCONTRADO` |
| `DELETE /admin/usuarios/:id` | Gestão | — | `204` (desativa); `403`; `404 USUARIO_NAO_ENCONTRADO`; `409 EXCLUSAO_DA_PROPRIA_CONTA` |

Senha de 10 a 72 caracteres. `papel`: `gestor` ou `operador`. As regras de quem pode o quê estão em [seguranca.md](seguranca.md#papéis).

## Orçamentos

As regras de negócio estão em [orcamentos.md](orcamentos.md). Toda rota é de nível **Equipe** e devolve o orçamento completo, exceto a lista e o `DELETE` do próprio orçamento.

Em todas as rotas com `:id`, um id inválido responde `400` e um orçamento inexistente responde `404 PROPOSTA_NAO_ENCONTRADA`. As que recalculam podem responder `503 SIMULACAO_INDISPONIVEL`, quando faltam dados de referência.

| Método e rota | Body | Resposta |
| --- | --- | --- |
| `GET /admin/propostas` | Query: `status?` (`rascunho`, `enviada`, `aceita`, `recusada`, `vencida`), `pagina?`, `porPagina?` | `200 { propostas: [{ id, clienteId, clienteNome, status, investimento, validaAte, versao, vencida, criadoEm }], pagina, porPagina, total }`. `enviada` inclui as vencidas; `vencida` traz só elas |
| `POST /admin/propostas` | `{ simulacao, moduloId, inversorId }` | `201 { proposta }` em rascunho; `400 EQUIPAMENTO_INVALIDO`; `404 SIMULACAO_NAO_ENCONTRADA`; `422 SIMULACAO_SEM_CLIENTE` |
| `GET /admin/propostas/:id` | — | `200 { proposta }`: lê o que foi gravado, sem recalcular; `404 PROPOSTA_NAO_ENCONTRADA` |
| `PATCH /admin/propostas/:id` | `{ moduloId?, inversorId?, revisao?, justificativa?, observacoes? }`, ao menos um além da justificativa | `200 { proposta }`; `400 JUSTIFICATIVA_OBRIGATORIA` ou `EQUIPAMENTO_INVALIDO`; `409 PROPOSTA_CONGELADA` |
| `DELETE /admin/propostas/:id` | — | `204`; `404`; `409 PROPOSTA_CONGELADA` (só rascunho é excluído) |
| `POST /admin/propostas/:id/ajustes` | `{ tipo, descricao, modo, valor, justificativa? }` | `201 { proposta }`; `400 JUSTIFICATIVA_OBRIGATORIA` ou `VALOR_FINAL_INVALIDO`; `409 PROPOSTA_CONGELADA` |
| `DELETE /admin/propostas/:id/ajustes/:itemId` | — | `200 { proposta }`; `404 ITEM_NAO_ENCONTRADO`; `409 PROPOSTA_CONGELADA` |
| `POST /admin/propostas/:id/condicoes` | `{ formaPagamentoId, entrada?, parcelas?, carenciaDias? }` | `201 { proposta }`; `400 FORMA_INVALIDA` ou `ENTRADA_INVALIDA` (com `fields.parcelas`, `fields.carenciaDias` ou `fields.entrada`); `409 PROPOSTA_CONGELADA` |
| `DELETE /admin/propostas/:id/condicoes/:itemId` | — | `200 { proposta }`; `404 ITEM_NAO_ENCONTRADO`; `409 PROPOSTA_CONGELADA` |
| `POST /admin/propostas/:id/enviar` | — | `200 { proposta }` em `enviada`; `409 PROPOSTA_CONGELADA`; `422 PROPOSTA_SEM_CONDICAO` |
| `POST /admin/propostas/:id/nova-versao` | `{ moduloId?, inversorId? }` | `201 { proposta }`; `409 PROPOSTA_EM_RASCUNHO` ou `RASCUNHO_JA_EXISTE` |
| `POST /admin/propostas/:id/duplicar` | `{ moduloId?, inversorId? }` | `201 { proposta }` |
| `PATCH /admin/propostas/:id/status` | `{ status }`: `enviada`, `aceita`, `recusada` | `200 { proposta }`; `400`; `404`; `409 PROPOSTA_EM_RASCUNHO` ou `PROPOSTA_VENCIDA` |

**Campos:**

- `revisao`: `{ performanceRatio? (0,70 a 0,85), simultaneidade? (0,10 a 0,70), telhado?: { horasDeSol?, orientacao?, inclinacao? }, quantidadeDeModulos? (1 a 5.000) }`. Substitui a anterior inteira.
- `justificativa`: 3 a 500 caracteres. `observacoes`: até 2.000 caracteres ou `null`.
- Ajuste: `tipo` é `desconto` ou `acrescimo`; `modo` é `valor` (em reais) ou `percentual` (fração, até 1: 0.05 = 5%).
- Condição: sem `entrada`, vale a mínima da forma; sem `parcelas`, o máximo da forma; sem `carenciaDias`, zero.

**Objeto `proposta`:**

```
{
  id, clienteId, status, vencida, versao, propostaRaizId, observacoes, investimento, validaAte, criadaEm, emitidaEm,
  escolhas: { moduloId, inversorId, revisao? },
  cliente: { nome, email, telefone, cep },
  equipamentos: { modulo: { id, tipo, fabricante, modelo, potenciaW, degradacaoAnual, preco, ativo, quantidade }, inversor: { …, quantidade } },
  precos: { modulos, inversor, instalacao, margem, calculado, ajustes, investimento },
  ajustes: [{ id, tipo, descricao, modo, valor, justificativa, valorEmReais }],
  condicoes: [{ id, formaPagamentoId, nome, tipo, taxaMensal, parcelas, carenciaDias, entrada, valorParcela, valorTotal, economiaMensalMenosParcela }],
  revisao,
  estimadoPeloSimulador: { investimento, economiaMensalMedia, paybackSimplesAnos, kwpInstalado },
  configuracaoUsada: { margem, instalacaoPorKwp, validadeDias, limiteDesconto },
  historico: [{ tipo, descricao, justificativa, usuario, criadoEm }],
  versoes: [{ id, versao, status, investimento, validaAte, criadoEm }],
  local, pedido, dimensionamento, coberturaAlcancada, indicadores, primeiroAno, resumoAnual, premissas, alertas
}
```

- Os blocos da última linha são os mesmos da simulação pública. `investimentoEstimado` e `parcelaEstimada` não aparecem, porque aqui valem o valor final e as condições.
- `valorEmReais` é negativo no desconto. `economiaMensalMenosParcela` é `null` à vista.
- `investimento` é o valor final do orçamento.
- Orçamentos antigos reabrem como foram gravados: campos acrescentados depois podem faltar.

## Importações

| Método e rota | Acesso | Resposta |
| --- | --- | --- |
| `GET /admin/importacoes` | Admin | `200 { importacoes: [{ tipo, descricao, agenda, ultimaExecucao, ultimoSucessoEm, desatualizada }] }` |
| `POST /admin/importacoes/:tipo` | Admin | Roda na hora e responde ao terminar: `200 { importacao: { tipo, id, status, iniciadaEm, finalizadaEm, linhasGravadas, mensagem } }`; `404 IMPORTACAO_DESCONHECIDA`; `409 IMPORTACAO_EM_ANDAMENTO` |

- `ultimaExecucao` tem o formato de `importacao`, sem `tipo`, ou é `null`.
- `desatualizada`: sem sucesso há mais de 2 dias, ou nunca.
- `status`: `executando`, `sucesso`, `sem_alteracao` ou `erro`.
- Falha da fonte não é erro HTTP: volta `200` com `status: "erro"` e o motivo em `mensagem`.

## Códigos de erro

| Status | `code` | Quando |
| --- | --- | --- |
| 400 | `JSON_INVALIDO` | O corpo não é um JSON válido |
| 400 | `ENTRADA_INVALIDA` | Falhou na validação; `fields` diz o campo e o motivo |
| 400 | `DISTRIBUIDORA_OBRIGATORIA` | Município com mais de uma distribuidora e `distribuidora` não enviada |
| 400 | `DISTRIBUIDORA_INVALIDA` | `distribuidora` fora das opções do CEP |
| 400 | `EQUIPAMENTO_INVALIDO` | `moduloId` ou `inversorId` que não é um equipamento ativo daquele tipo |
| 400 | `FORMA_INVALIDA` | Forma de pagamento inativa ou inexistente |
| 400 | `JUSTIFICATIVA_OBRIGATORIA` | Revisão sem motivo, ou descontos acima do limite sem motivo. Traz `fields.justificativa` |
| 400 | `VALOR_FINAL_INVALIDO` | Os ajustes deixariam o orçamento sem valor a pagar |
| 401 | `CREDENCIAIS_INVALIDAS` | Login com e-mail ou senha errados |
| 401 | `NAO_AUTENTICADO` | Rota protegida sem o cookie `sessao` |
| 401 | `SESSAO_INVALIDA` | Token expirado, adulterado ou de usuário excluído |
| 403 | `SEM_PERMISSAO` | O papel não dá acesso à rota, ou a ação é reservada ao admin |
| 404 | `NAO_ENCONTRADO` | Rota inexistente em `/api` |
| 404 | `CEP_NAO_ENCONTRADO` | O CEP não existe |
| 404 | `CLIENTE_NAO_ENCONTRADO` | Cliente que não existe |
| 404 | `SIMULACAO_NAO_ENCONTRADA` | Código de simulação que não existe |
| 404 | `PROPOSTA_NAO_ENCONTRADA` | Orçamento que não existe |
| 404 | `ITEM_NAO_ENCONTRADO` | Ajuste ou condição que não é deste orçamento |
| 404 | `EQUIPAMENTO_NAO_ENCONTRADO` | Equipamento que não existe |
| 404 | `FORMA_NAO_ENCONTRADA` | Forma de pagamento que não existe |
| 404 | `USUARIO_NAO_ENCONTRADO` | Usuário que não existe ou foi excluído |
| 404 | `IMPORTACAO_DESCONHECIDA` | Tipo de importação que não existe |
| 409 | `PEDIDO_JA_ENVIADO` | A simulação já tem um pedido de proposta |
| 409 | `EQUIPAMENTO_DUPLICADO` | Mesmo tipo, fabricante e modelo |
| 409 | `FORMA_DUPLICADA` | Mesmo nome de forma de pagamento |
| 409 | `EMAIL_EM_USO` | E-mail de outro usuário, mesmo excluído |
| 409 | `EXCLUSAO_DA_PROPRIA_CONTA` | Ninguém exclui a própria conta |
| 409 | `PROPOSTA_CONGELADA` | Tentativa de alterar um orçamento já enviado |
| 409 | `PROPOSTA_EM_RASCUNHO` | Mudar o status ou criar versão de um rascunho |
| 409 | `RASCUNHO_JA_EXISTE` | A família de versões já tem um rascunho |
| 409 | `PROPOSTA_VENCIDA` | Passar a `aceita` um orçamento com a validade passada |
| 409 | `IMPORTACAO_EM_ANDAMENTO` | A mesma importação começou há menos de 30 min e não terminou |
| 413 | `CORPO_GRANDE_DEMAIS` | Corpo acima de 100 kB |
| 422 | `REGIAO_NAO_ATENDIDA` | Nenhuma distribuidora com tarifa para o município |
| 422 | `SIMULACAO_SEM_CLIENTE` | Orçamento para simulação sem pedido de proposta |
| 422 | `PROPOSTA_SEM_CONDICAO` | Enviar sem nenhuma condição de pagamento |
| 429 | `MUITAS_REQUISICOES` | Passou do limite de requisições |
| 500 | `ERRO_INTERNO` | Erro não previsto; mensagem genérica, sem detalhes |
| 503 | `CEP_INDISPONIVEL` | ViaCEP fora do ar ou lento |
| 503 | `SIMULACAO_INDISPONIVEL` | Falta tarifa, Fio B, irradiação do município ou IPCA/Selic no banco |
