import cors from 'cors';
import express, { Router, type Express } from 'express';
import helmet from 'helmet';
import { rotaNaoEncontrada, tratarErros } from './middlewares/erros.ts';
import { routersDosModulos } from './modulos/index.ts';
import { rotasSaude } from './routes/saude.ts';

export interface ConfiguracaoApp {
  urlFrontend: string;
  producao: boolean;
}

function criarRotasDaApi(): Router {
  const api = Router();

  api.use(rotasSaude);
  for (const routerDoModulo of routersDosModulos) {
    api.use(routerDoModulo);
  }

  api.use(rotaNaoEncontrada);
  return api;
}

export function criarApp({ urlFrontend, producao }: ConfiguracaoApp): Express {
  const app = express();

  // Em produção o proxy do Render fica na frente: o IP real do visitante, usado nos limites, vem dele.
  if (producao) app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: urlFrontend, credentials: true }));
  app.use(express.json({ limit: '100kb' }));

  app.use('/api', criarRotasDaApi());
  app.use(tratarErros);
  return app;
}
