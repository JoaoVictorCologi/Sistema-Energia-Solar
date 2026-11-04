// Monta a aplicação Express sem abrir porta: o servidor e os testes usam a mesma configuração.
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'node:path';
import express, { Router, type Express } from 'express';
import helmet from 'helmet';
import { obterEnv } from './config/env.ts';
import { rotaNaoEncontrada, tratarErros } from './middlewares/erros.ts';
import { entregarFrontend } from './middlewares/frontend.ts';
import { routersDosModulos } from './modulos/index.ts';
import { rotasAdmin } from './routes/admin.ts';
import { criarRotasAuth } from './routes/auth.ts';
import { criarRotasClientes } from './routes/clientes.ts';
import { rotasImportacoes } from './routes/importacoes.ts';
import { rotasSaude } from './routes/saude.ts';
import { criarRotasSimulacao } from './routes/simulacao.ts';

// Rotas sob /api. O 404 fica por último, depois dos módulos, para atender só o que nenhum router respondeu.
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
  const { NODE_ENV, URL_FRONTEND, PASTA_DO_FRONTEND } = obterEnv();
  const app = express();

  // Em produção há um proxy na frente da aplicação: é dele que vem o IP real do visitante, usado nos limites de requisição.
  if (NODE_ENV === 'production') app.set('trust proxy', 1);

  // Padrão do helmet, mais o iframe do mapa da página de Contato (maps.google.com redireciona para www.google.com).
  app.use(helmet({
    contentSecurityPolicy: { directives: { 'frame-src': ["'self'", 'https://maps.google.com', 'https://www.google.com'] } },
  }));
  app.use(cors({ origin: URL_FRONTEND, credentials: true }));
  // Os corpos esperados são pequenos: o limite barra envios abusivos antes da validação.
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use('/api', criarRotasDaApi());
  // Em produção, o mesmo processo entrega o site. O tratador de erros fica por último, para receber o erro de qualquer rota.
  const frontend = NODE_ENV === 'production' ? entregarFrontend(PASTA_DO_FRONTEND ?? path.resolve('..', 'frontend', 'dist')) : null;
  if (frontend) app.use(frontend);
  app.use(tratarErros);
  return app;
}
