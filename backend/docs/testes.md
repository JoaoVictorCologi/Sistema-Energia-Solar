# Testes e validação

```
cd backend
npm test          # todos os testes, em cerca de 4 s; não precisa de banco nem de internet
npm run build     # confere os tipos de tudo e compila
```

Em 04/11/2026: 462 testes passando e 3 pendentes, que esperam contas de luz reais.

Antes de cada commit, `npm test` e `npm run build` precisam passar. Nunca apague, pule ou enfraqueça um teste para fazer passar: se o comportamento mudou de propósito, mude o teste junto e explique o motivo.

## Organização

| Assunto | Arquivos em `src/tests/` |
| --- | --- |
| Motor | `motor/` (um arquivo por etapa), `motor/regras.test.ts` (barra banco, rede e relógio no motor), `contas-reais.test.ts` |
| Simulação | `simulacao`, `refinamento`, `clientes`, `parametros`, `tributos` |
| Orçamentos | `propostas`, `configuracoes` |
| Área restrita | `admin`, `usuarios`, `auth` |
| Dados externos | `integracoes`, `ckan`, `tarifasAneel`, `distribuidoras`, `indicadores`, `atlas`, `importacoes` |
| Infraestrutura | `seguranca`, `producao`, `env`, `saude`, `busca`, `demonstracao` |

Testes de módulos ficam em `src/modulos/<modulo>/tests/`.

**Apoio:**

- `apoio/usuariosDeTeste.ts`: usuários com ids fixos (1 admin, 2 operador, 3 gestor).
- `apoio/comercialDeTeste.ts`: `CONFIGURACAO_INICIAL`, `AVISTA`, `CARTAO`, `FINANCIAMENTO`.
- `fixtures/`: CSV de exemplo do Atlas e respostas reais, reduzidas, da ANEEL.

## O motor é testado em três camadas

1. **Valores conhecidos:** cada fórmula, com números calculados à mão ([exemplo resolvido](motor-de-calculo.md#exemplo-resolvido)).
2. **Propriedades:** o que vale para qualquer entrada. Com geração zero, a fatura com solar é igual à sem solar; a economia nunca passa da fatura; a mesma entrada dá sempre a mesma saída.
3. **Contas de luz:** a [reprodução de contas](#validação-com-contas-reais), com meta de erro abaixo de 5%.

## Como escrever um teste

O `vitest.config.ts` define um ambiente de teste (`NODE_ENV=test`, `DATABASE_URL` e `JWT_SECRET` fictícios). Nenhum teste abre conexão: os repositories são simulados, e o teste confere a rota e as regras.

**Rota com repository simulado:**

```ts
vi.mock('../repositories/usuariosRepository.ts', () => ({ buscarUsuarioParaLogin: vi.fn() }));
```

**Rota que exige login:** o `autenticar` consulta o banco, então simule o repository e gere o cookie:

```ts
vi.mock('../repositories/usuariosRepository.ts', () => import('./apoio/usuariosDeTeste.ts'));
const OPERADOR = `sessao=${gerarToken({ id: 2, papel: 'operador' })}`;
```

**Outras situações:**

| Situação | Como fazer |
| --- | --- |
| Outro valor no ambiente | `vi.stubEnv('NODE_ENV', 'production')` e `vi.unstubAllEnvs()` no `afterEach` |
| Senha | `bcrypt.hash(senha, 4)`: custo baixo, só para o teste ser rápido |
| Rota com limite próprio | `criarApp()` no `beforeEach`, porque a contagem vive no router |
| Middleware isolado | App mínimo com `express.json()`, a rota de teste e `tratarErros` (`seguranca.test.ts`) |
| Erro 500 | Silencie com `vi.spyOn(console, 'error').mockImplementation(() => {})` |
| Integração externa | `vi.stubGlobal('fetch', …)` e `vi.unstubAllGlobals()`; passe `esperaEntreTentativasMs: 0` (`integracoes.test.ts`) |
| Arquivos de exemplo | Em `tests/fixtures/`, lidos com `path.join(import.meta.dirname, 'fixtures', …)` |
| Job de módulo | Troque `modulos/index.ts` por um mock com `jobsDosModulos` (`importacoes.test.ts`) |
| Regras de orçamento | `propostas.test.ts` tem um banco em memória com as mesmas regras do repository |

## O que precisa de banco real

Como os testes simulam os repositories, `npm test` não exercita SQL nem migrations. Ao mudar repositories ou migrations, confira num banco descartável, nunca no banco de dados reais:

```
createdb solar_gestao_teste
DATABASE_URL=postgres://usuario:senha@localhost:5432/solar_gestao_teste npm run db:migrate
DATABASE_URL=postgres://usuario:senha@localhost:5432/solar_gestao_teste npm run db:rollback
DATABASE_URL=postgres://usuario:senha@localhost:5432/solar_gestao_teste npm run db:migrate
```

Variáveis definidas no comando têm prioridade sobre o `.env`.

Para uma migration que transforma dados, restaure uma cópia (`pg_dump` e `pg_restore`) e confira os dados depois do `up` e do `down`.

## Testes da API com o Insomnia

A coleção [`insomnia/solar-gestao.json`](insomnia/solar-gestao.json) percorre os fluxos completos do sistema com banco e servidor reais. Não testa cada erro de cada rota, que é o papel do `npm test`: são 33 requisições em 7 fluxos, em que cada passo usa o resultado do anterior.

| Fluxo | O que acontece |
| --- | --- |
| 1. Cliente pede uma proposta | Consulta o CEP, simula e faz o pedido |
| 2. Equipe entra no sistema | Admin cria o gestor, gestor cria o operador, e o operador não administra usuários |
| 3. Gestão prepara a venda | Cadastra módulo e inversor e confere a forma de pagamento |
| 4. Orçamento do pedido ao aceite | Painel, cliente, rascunho, desconto, pagamento, envio, bloqueio de edição e aceite |
| 5. Nova versão do orçamento | Cria a versão 2, confere que o original não mudou e descarta o rascunho |
| 6. Atualização dos dados | Admin lista as importações e atualiza os indicadores do Banco Central |
| 7. Limpeza | Desativa os equipamentos, exclui os usuários e confere que a sessão cai na hora |

### Como rodar

1. Suba a API com `npm run dev`.
2. No Insomnia 9 ou mais novo, importe o arquivo pelo menu **Import**. Se já houver uma importação anterior da coleção, apague-a antes, para não duplicar as requisições.
3. Abra o ambiente da coleção (**Base Environment**) e preencha `email_admin` e `senha_admin`. O arquivo não traz nenhuma senha. `base_url` já vem com `http://localhost:3333`; não é preciso selecionar outro ambiente.
4. Rode os fluxos em ordem, pelo **Collection Runner** ou uma requisição por vez.

**Para repetir em menos de 15 minutos, reinicie o servidor antes.** Cada execução faz 3 logins, e o limite é de 5 tentativas a cada 15 minutos por IP. Ele fica em memória, então reiniciar zera a contagem.

### O que fica no banco depois

Cada execução deixa 1 cliente, 1 simulação, 1 orçamento aceito, 2 usuários desativados, 2 equipamentos inativos e o registro da importação, porque não há rota para apagar esses dados. Para manter um banco limpo, rode numa cópia:

```
cd backend
sudo -u postgres createdb --owner=solar_app solar_gestao_testes
set -a; . ./.env; set +a
pg_dump --no-owner -Fc "$DATABASE_URL" | pg_restore --no-owner -d postgres://usuario:senha@localhost:5432/solar_gestao_testes
DATABASE_URL=postgres://usuario:senha@localhost:5432/solar_gestao_testes PORT=3399 npm run dev
```

Nesse caso, troque `base_url` para `http://localhost:3399`. Não rode a coleção em produção: ela cria usuários com senha conhecida até a limpeza terminar.

### Ao editar a coleção à mão

O importador do Insomnia só reconhece o ambiente base quando o `parentId` dele começa com `__WORKSPACE_ID__`. Com outro valor, ele descarta o ambiente sem avisar, e as requisições falham por falta de `base_url`. Toda variável usada precisa estar declarada no ambiente base, mesmo vazia.

## Validação com contas reais

Compara o valor calculado pelo motor com o valor cobrado na conta de luz. Meta: **erro abaixo de 5%** no total de cada conta. Cada conta é um JSON em `src/tests/contas-reais/`, e `contas-reais.test.ts` roda todas.

**Situação em 04/11/2026: nenhuma conta real ainda.** O motor está validado só pelos três exemplos resolvidos, com tarifas ilustrativas. As três contas reais aparecem como testes pendentes (`todo`). Performance ratio e simultaneidade seguem com os valores padrão, e toda simulação traz o alerta `PREMISSAS_NAO_CALIBRADAS`.

| Caso | Regime | Cobrado | Calculado | Erro |
| --- | --- | --- | --- | --- |
| Exemplo GD II (não é real) | GD II | R$ 41,55 | R$ 41,55 | 0,006% |
| Exemplo GD I (não é real) | GD I | R$ 29,41 | R$ 29,41 | 0,006% |
| Exemplo sem solar (não é real) | — | R$ 392,16 | R$ 392,16 | 0,001% |

### Como transformar uma conta em caso de teste

Copie **só os números**, nunca o que identifica o cliente: nome, CPF, endereço ou número da instalação. De preferência, use uma conta de quem já tem solar e uma de quem não tem.

Crie `src/tests/contas-reais/conta-N.json` copiando um dos exemplos:

| Campo | Onde está na conta | Exemplo |
| --- | --- | --- |
| `descricao` | Texto livre, sem dados pessoais | `"Residencial monofásica com solar, 08/2026"` |
| `real` | `true` para conta real | `true` |
| `mesReferencia` | Mês de referência | `"2026-08"` |
| `consumoMinimoKwh` | Pelo tipo de ligação: 30, 50 ou 100 | `"30"` |
| `regime` | `GD_II` se o sistema foi pedido depois de 07/01/2023; senão, `GD_I` | `"GD_II"` |
| `consumoDaRedeKwh` | Consumo ou energia ativa fornecida | `"312"` |
| `injecaoKwh` | Energia injetada no mês (0 sem solar) | `"280"` |
| `creditosAnterioresKwh` | Saldo de créditos do mês anterior | `"45"` |
| `tarifaSemImpostos` | TE e TUSD sem tributos (na conta ou na resolução da ANEEL); Fio B da importação | `{ "te": "0.25219", "tusd": "0.56039", "fioB": "0.272853" }` |
| `percentualFioB` | Do ano da conta (2026: 0,60) | `"0.60"` |
| `tributos` | Alíquotas impressas na conta; `icmsSobreFioB` conforme a linha de ICMS | `{ "icms": "0.18", "pis": "0.0098", "cofins": "0.0452", "icmsSobreFioB": true }` |
| `cobradoSemIluminacaoPublica` | Total a pagar menos a iluminação pública | `"98.40"` |

Rode `npm test`: a conta entra no teste e uma das pendências some.

### Como calibrar

1. Se o erro passar de 5%, ajuste PR e simultaneidade em `parametros.json`, ou `icmsSobreFioB` em `tributos-por-uf.json`, e atualize a `versao`.
2. Registre a mudança na tabela abaixo.
3. Com as contas conferidas e o erro abaixo de 5%, mude `calibracao.calibrada` para `true`. O aviso `PREMISSAS_NAO_CALIBRADAS` deixa de aparecer, e fora da distribuidora das contas passa a aparecer `ESTIMATIVA_FORA_DA_REGIAO_CALIBRADA`.

| Data | Parâmetro | Antes | Depois | Motivo |
| --- | --- | --- | --- | --- |
| — | — | — | — | Nada calibrado até 04/11/2026 |
