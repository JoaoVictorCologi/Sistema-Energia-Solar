import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Router, type Express } from 'express';
import helmet from 'helmet';
import { obterEnv } from './config/env.ts';
import { rotaNaoEncontrada, tratarErros } from './middlewares/erros.ts';
import { routersDosModulos } from './modulos/index.ts';
import { rotasAdmin } from './routes/admin.ts';
import { criarRotasAuth } from './routes/auth.ts';
import { criarRotasClientes } from './routes/clientes.ts';
import { rotasImportacoes } from './routes/importacoes.ts';
import { rotasSaude } from './routes/saude.ts';
import { criarRotasSimulacao } from './routes/simulacao.ts';

function criarRotasDaApi(): Router {
  const api = Router();

  api.use(rotasSaude);
  api.use(criarRotasAuth());
  api.use(rotasImportacoes);
  api.use(rotasAdmin);
  api.use(criarRotasSimulacao());
  api.use(criarRotasClientes());
  for (const routerDoModulo of routersDosModulos) {
    api.use(routerDoModulo);
  }

  api.use(rotaNaoEncontrada);
  return api;
}

export function criarApp(): Express {
  const { NODE_ENV, URL_FRONTEND } = obterEnv();
  const app = express();

  // Em produção o proxy do Render fica na frente: o IP real do visitante, usado nos limites, vem dele.
  if (NODE_ENV === 'production') app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: URL_FRONTEND, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use('/api', criarRotasDaApi());
  app.use(tratarErros);
  return app;
}
