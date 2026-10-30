import express, { Router, type Express } from 'express';
import { routersDosModulos } from './modulos/index.ts';
import { rotasSaude } from './routes/saude.ts';

export function criarApp(): Express {
  const app = express();
  const api = Router();

  api.use(rotasSaude);
  for (const routerDoModulo of routersDosModulos) {
    api.use(routerDoModulo);
  }

  app.use('/api', api);
  return app;
}
