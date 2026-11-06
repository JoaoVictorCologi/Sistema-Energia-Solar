# Documentação do backend

API do **Solar Gestão**, sistema web de energia solar. O backend atende duas áreas:

- **Pública:** simulador de economia pela Lei 14.300, em qualquer município do Brasil, e pedido de proposta.
- **Restrita:** clientes, simulações, orçamentos, catálogo de equipamentos, configuração comercial, usuários e importações de dados.

Todo preço e todo cálculo acontecem no backend; o site só exibe. Em produção, o mesmo processo entrega a API em `/api` e o site no resto.

Atualizado em 04/11/2026.

## Mapa da documentação

| Documento | O que explica |
| --- | --- |
| [instalacao.md](instalacao.md) | Preparar o ambiente, carregar os dados e rodar |
| [arquitetura.md](arquitetura.md) | Camadas, pastas, decisões de projeto e convenções de código |
| [api.md](api.md) | Todas as rotas, formatos de resposta e códigos de erro |
| [banco-de-dados.md](banco-de-dados.md) | Tabelas, relações e migrations |
| [motor-de-calculo.md](motor-de-calculo.md) | Fórmulas do cálculo solar e tarifário, com exemplo resolvido |
| [simulacao.md](simulacao.md) | Do CEP ao resultado: distribuidora, respostas do cliente e alertas |
| [orcamentos.md](orcamentos.md) | Ciclo do orçamento: preço, ajustes, condições, envio e versões |
| [parametros.md](parametros.md) | Premissas, tributos, configuração comercial e formas de pagamento |
| [integracoes-e-importacoes.md](integracoes-e-importacoes.md) | Fontes externas, cargas e importações agendadas |
| [seguranca.md](seguranca.md) | Autenticação, papéis, proteção das rotas e LGPD |
| [testes.md](testes.md) | Como testar, fluxos completos no Insomnia e validação com contas de luz reais |
| [implantacao.md](implantacao.md) | Publicação, backup e limites de escala |

## Tecnologia

| Item | Escolha |
| --- | --- |
| Execução | Node 22.18 ou mais novo, rodando TypeScript direto |
| API | Express 5, helmet, cors, cookie-parser, express-rate-limit |
| Banco | PostgreSQL 16 ou mais novo, Knex e pg |
| Validação | zod |
| Cálculo | decimal.js |
| Autenticação | jsonwebtoken e bcrypt |
| Agendamento | node-cron |
| Cargas de dados | csv-parse, só nos scripts |
| Testes | Vitest e Supertest |

## Início rápido

```
cd backend
cp .env.example .env    # preencha DATABASE_URL e JWT_SECRET
npm install
npm run db:migrate
npm run dev             # http://localhost:3333/api/health
npm test
```

Para simular de verdade, ainda faltam as cargas de dados: veja [instalacao.md](instalacao.md).

## Situação atual

**Pronto:**

- simulação em qualquer município, com escolha da distribuidora e respostas opcionais do cliente;
- pedido de proposta com aceite da LGPD;
- orçamentos com rascunho, revisão, ajustes, condições de pagamento, envio congelado e versões;
- papéis `admin`, `gestor` e `operador`, com gestão de usuários;
- configuração comercial e formas de pagamento editáveis;
- importações automáticas da ANEEL e do Banco Central;
- ponto de extensão para novos módulos.

**Limitações conhecidas:**

- **Calibração:** performance ratio e simultaneidade são valores típicos, ainda sem conferência com contas reais. Três testes ficam pendentes até as contas chegarem ([testes.md](testes.md#validação-com-contas-reais)).
- **Tributos:** só o ICMS de SP tem fonte legal confirmada. As outras 26 UFs estão marcadas "a conferir" ([parametros.md](parametros.md#tributos-por-ufjson)).
- **Preços e taxas:** cartão de crédito e financiamento ficam inativos até a gestão preencher a taxa. Os valores comerciais iniciais são um ponto de partida a ajustar.
- **Bandeira tarifária:** o motor aceita o adicional, mas a simulação usa bandeira verde.
- **Escopo tarifário:** só grupo B, modalidade convencional, compensação no próprio local.
- **Atlas de irradiação:** a licença CC BY-NC-ND exige autorização do INPE para uso comercial ([detalhes](integracoes-e-importacoes.md#atlas-brasileiro-de-energia-solar)).
- **Orçamento:** o [envio](orcamentos.md#envio) registra e congela o orçamento, mas não dispara e-mail.
- **Usuários:** não há rota para cada usuário trocar a própria senha; os demais pontos de conta estão em [segurança](seguranca.md#limites-conhecidos).
- **LGPD:** não há rota para excluir ou exportar os dados de um cliente.

## Como manter esta documentação

Atualize no mesmo commit da mudança:

| Mudou… | Atualize |
| --- | --- |
| Rota, corpo, resposta ou código de erro | [api.md](api.md) |
| Tabela, coluna ou migration | [banco-de-dados.md](banco-de-dados.md) |
| Fórmula do motor | [motor-de-calculo.md](motor-de-calculo.md) e os testes em `src/tests/motor/` |
| Valor ou campo dos parâmetros | [parametros.md](parametros.md) e a `versao` do arquivo |
| Regra de simulação ou alerta | [simulacao.md](simulacao.md) |
| Regra de orçamento | [orcamentos.md](orcamentos.md) |
| Fonte externa ou importação | [integracoes-e-importacoes.md](integracoes-e-importacoes.md) |
| Variável de ambiente ou comando | [instalacao.md](instalacao.md) |
| Limitação resolvida ou nova | A lista acima e a data no início desta página |
