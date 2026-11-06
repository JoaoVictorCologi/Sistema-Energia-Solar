# Instalação e execução

## Pré-requisitos

- Node 22.18 ou mais novo (`.nvmrc` na raiz do repositório);
- PostgreSQL 16 ou mais novo;
- npm.

## 1. Banco de dados

Crie um usuário sem superusuário e um banco:

```
sudo -u postgres createuser --pwprompt solar_app
sudo -u postgres createdb --owner=solar_app solar_gestao
```

## 2. Variáveis de ambiente

```
cd backend
cp .env.example .env
```

| Variável | Obrigatória | Padrão | Uso |
| --- | --- | --- | --- |
| `DATABASE_URL` | Sim | — | `postgres://usuario:senha@host:5432/banco` |
| `JWT_SECRET` | Sim | — | Assina o token de login. Pelo menos 32 caracteres: use `openssl rand -hex 32` |
| `PORT` | Não | `3333` | Porta da API |
| `NODE_ENV` | Não | `development` | `development`, `test` ou `production` |
| `URL_FRONTEND` | Não | `RENDER_EXTERNAL_URL` ou `http://localhost:5173` | Única origem aceita pelo CORS |
| `PASTA_DO_FRONTEND` | Não | `../frontend/dist` | Build do site, entregue pelo Express só em produção |

Sem uma variável obrigatória, ou com um valor inválido, o servidor não sobe e mostra qual corrigir. Em produção, `NODE_ENV=production` liga o cookie `Secure`, o `trust proxy` e a entrega do site.

O `.env` nunca vai para o Git. O código lê as variáveis sempre por `obterEnv()` (`config/env.ts`), nunca direto de `process.env`.

## 3. Dependências e tabelas

```
npm install
npm run db:migrate
```

## 4. Dados de referência

Sem estes dados a API sobe, mas o simulador responde `503 SIMULACAO_INDISPONIVEL` ou `422 REGIAO_NAO_ATENDIDA`. Rode **nesta ordem**, porque cada passo depende do anterior:

| Passo | Comando | O que faz |
| --- | --- | --- |
| 1 | `npm run carregar-municipios` | Os 5.571 municípios do Brasil, pela API do IBGE |
| 2 | `npm run carregar-atlas -- <csv>` | Irradiação de cada município. O CSV é baixado à mão ([como obter](integracoes-e-importacoes.md#atlas-brasileiro-de-energia-solar)) |
| 3 | `npm run importar -- aneel-distribuidoras` | Liga cada município às suas distribuidoras |
| 4 | `npm run importar -- aneel-tarifas` | Tarifas e Fio B das distribuidoras ligadas |
| 5 | `npm run importar -- bcb-indicadores` | IPCA e Selic |

Todos podem rodar de novo: só atualizam. Depois da primeira carga, os passos 3 a 5 rodam sozinhos pelo [agendador](integracoes-e-importacoes.md#importações-agendadas), enquanto o servidor estiver no ar.

## 5. Primeiro acesso

```
npm run criar-admin    # pede nome, e-mail e senha; a senha não aparece na tela
```

O `admin` é a conta da TI e só nasce por esse script. Pela API, ele cria o primeiro `gestor`, que depois cria os `operador` ([papéis](seguranca.md#papéis)).

## 6. Rodar

```
npm run dev            # API em http://localhost:3333, recarrega ao salvar
```

Para conferir:

```
curl http://localhost:3333/api/health
curl http://localhost:3333/api/cep/13730250
curl -X POST http://localhost:3333/api/simulacoes \
  -H 'Content-Type: application/json' \
  -d '{"cep":"13730250","tipoLigacao":"monofasico","consumoMedioKwh":400}'
```

O primeiro deve responder `{"status":"ok","banco":"ok"}`, e o último, `201` com a simulação.

O site roda em `http://localhost:5173`, a partir da pasta `frontend/`, que tem o próprio `npm install`.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor em desenvolvimento |
| `npm test` | Todos os testes, sem banco |
| `npm run build` | Confere os tipos e compila para `dist/` |
| `npm start` | Roda o que foi compilado |
| `npm run db:migrate` | Aplica as migrations pendentes |
| `npm run db:rollback` | Desfaz o último lote |
| `npm run db:nova-migration -- <nome>` | Cria uma migration |
| `npm run criar-admin` | Cria um administrador |
| `npm run carregar-municipios` | Carrega os municípios do IBGE |
| `npm run carregar-atlas -- <csv>` | Carrega a irradiação do Atlas |
| `npm run importar -- <tipo>` | Roda uma importação na hora; sem tipo, lista os disponíveis |
| `npm run dados-demo` | Cria dados fictícios de demonstração |

## Dados de demonstração

`npm run dados-demo` cria 5 equipamentos, 8 clientes fictícios, simulações e orçamentos em vários status. Rode depois das cargas, porque ele simula de verdade, e com a forma "À vista" ativa.

Pode rodar de novo: apaga só o que ele mesmo criou, identificado pelo domínio de e-mail `demo.exemplo.com` e pelo fabricante `Demonstração`. Em produção, recusa-se a rodar sem `--confirmar`.

## Problemas comuns

| Sintoma | Causa provável | Solução |
| --- | --- | --- |
| `Configuração inválida no backend/.env` | Variável ausente ou inválida | A mensagem diz qual corrigir |
| `503 SIMULACAO_INDISPONIVEL` | Falta tarifa, Fio B, irradiação ou indicador | Rode os passos da seção 4 |
| `422 REGIAO_NAO_ATENDIDA` em todo CEP | Sem vínculo ou tarifa no banco | Rode `aneel-distribuidoras` e depois `aneel-tarifas` |
| `Nenhuma distribuidora ligada a municípios` | `aneel-tarifas` rodou antes de `aneel-distribuidoras` | Siga a ordem da seção 4 |
| `503 CEP_INDISPONIVEL` | ViaCEP fora do ar ou lento | Tente de novo em instantes |
| `Sem configuração comercial` | Migrations pendentes | `npm run db:migrate` |
| `401` em toda rota restrita | Cookie ausente ou expirado | Faça login de novo; a sessão dura 8 horas |
| `parametros.json inválido` | Valor fora da faixa | A mensagem diz o campo ([faixas](parametros.md#parametrosjson)) |
