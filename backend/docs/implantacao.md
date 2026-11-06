# Implantação

Em produção, um único serviço entrega a API em `/api` e o build do site no resto, na mesma origem. Por isso, cookie e CORS funcionam sem configuração extra. Rotas da tela (`/simulador`, `/admin/...`) devolvem o `index.html`, e os arquivos de `/assets` ficam em cache por um ano.

## Requisitos da hospedagem

Serve qualquer lugar que ofereça:

- **um processo Node contínuo:** funções serverless não mantêm o agendador vivo;
- **PostgreSQL 16 ou mais novo;**
- **HTTPS com um proxy na frente:** o cookie é `Secure` em produção, e o `trust proxy` assume um proxy.

Variáveis: `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET` e `URL_FRONTEND` ([todas](instalacao.md#2-variáveis-de-ambiente)).

**Build e subida:**

```
cd frontend && npm ci --include=dev && npm run build
cd ../backend && npm ci --include=dev && npm run build
npm run db:migrate && npm start
```

`--include=dev` é necessário porque o build precisa do TypeScript e do Vite, que são dependências de desenvolvimento.

Depois da primeira subida, rode as [cargas de dados](instalacao.md#4-dados-de-referência) e o `npm run criar-admin` uma vez.

## Render

O `render.yaml` na raiz do repositório descreve o banco (PostgreSQL 18, `solar_gestao`) e o serviço web `solar-gestao`, ambos no plano gratuito.

1. Envie o repositório ao GitHub.
2. No Render, escolha **New → Blueprint** e o repositório. `DATABASE_URL` vem do banco, `JWT_SECRET` é gerado, e `URL_FRONTEND` vem de `RENDER_EXTERNAL_URL`.
3. A cada deploy, o Render faz o build, aplica as migrations e sobe a API. Confira `https://<serviço>.onrender.com/api/health`.
4. Rode as cargas e crie o admin **da sua máquina**, contra o banco da nuvem, porque o plano gratuito não tem shell. Copie a *External Database URL* no painel do banco:

   ```
   cd backend
   export DATABASE_URL='<External Database URL>?sslmode=require'
   npm run db:migrate
   npm run carregar-municipios
   npm run carregar-atlas -- <csv>
   npm run importar -- aneel-distribuidoras
   npm run importar -- aneel-tarifas
   npm run importar -- bcb-indicadores
   npm run criar-admin
   ```

   Se o certificado for recusado, troque `sslmode=require` por `sslmode=no-verify`. Para ter os dados fictícios na nuvem: `NODE_ENV=production npm run dados-demo -- --confirmar`.

5. Faça o roteiro manual na URL pública: simular, pedir proposta, entrar na área restrita, ver o cliente, gerar e enviar um orçamento, rodar uma importação.

**Limites do plano gratuito:**

- O serviço dorme depois de 15 minutos sem acesso, e a primeira requisição leva cerca de 1 minuto.
- Dormindo, o agendador não roda: use a rota de importação ou `npm run importar` antes de depender dos dados.
- O banco gratuito tem prazo de validade: confira a data no painel e faça o backup antes.

## Backup

Com o `pg_dump` da mesma versão principal do banco:

```
pg_dump --no-owner -Fc "$DATABASE_URL" > solar-gestao.dump
pg_restore --no-owner -d <banco> solar-gestao.dump
```

O arquivo contém dados pessoais de clientes: guarde-o fora do repositório, em lugar protegido.

## Limites

O backend foi feito para rodar em **uma instância**, e ainda não passou por teste de carga. Para crescer além disso:

| Ponto | Hoje | Se precisar de mais instâncias |
| --- | --- | --- |
| Limites de requisição | Em memória, por processo: zeram ao reiniciar e não são compartilhados | Guardar a contagem num armazenamento compartilhado |
| Agendador | Dentro do processo: cada instância agendaria os jobs | Rodar os jobs num serviço separado. A tabela `importacao` já barra execuções repetidas do mesmo tipo em andamento |
| Sessão | JWT em cookie, sem estado no servidor | Nada a mudar |
| Conexões | Pool padrão do Knex por processo | Dimensionar o pool e o limite de conexões do banco |
| Simulação | Cálculo síncrono de 300 meses em `Decimal`: o processo fica ocupado enquanto ele roda | Medir o tempo de resposta sob carga antes de decidir |

## Depois de publicar

- Confira `GET /api/health`, usado também como verificação de saúde pela hospedagem.
- Acompanhe `GET /api/admin/importacoes`: `desatualizada: true` indica que uma importação não teve sucesso há mais de 2 dias.
- Faça backups antes de migrations que transformam dados.
- Antes de uma operação comercial, resolva os itens de [limitações conhecidas](README.md#situação-atual), em especial a licença do Atlas, a calibração e os tributos.
