# Solar Gestão

Sistema web de energia solar: simulador de economia pela Lei 14.300, pedido de proposta e área do administrador.
Backend em Node 22 + Express + TypeScript + Knex + PostgreSQL; frontend em React + Vite + TypeScript.

O site institucional anterior (Next.js) está na branch `legado/site-don-energy`.

## Como rodar

Pré-requisitos: Node 22.18 ou mais novo e PostgreSQL 16 ou mais novo.

```
cd backend
cp .env.example .env      # preencher DATABASE_URL
npm install
npm run db:migrate
npm run dev               # API em http://localhost:3333 (teste: /api/health)

cd frontend
npm install
npm run dev               # site em http://localhost:5173
```

Testes e build: `npm test` e `npm run build` no backend; `npm run build` no frontend.
