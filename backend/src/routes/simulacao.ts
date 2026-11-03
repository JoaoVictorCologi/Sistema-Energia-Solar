import { Router } from 'express';
import { criarSimulacao, esquemaSimulacao, obterCep } from '../controllers/simulacaoController.ts';
import { criarLimite } from '../middlewares/limites.ts';
import { validar } from '../middlewares/validar.ts';

// Rotas públicas: 30 requisições por minuto por IP em cada uma (o limite vive no router criado aqui).
export function criarRotasSimulacao(): Router {
  const rotas = Router();
  rotas.get('/cep/:cep', criarLimite({ janelaMs: 60_000, maximo: 30 }), obterCep);
  rotas.post('/simulacoes', criarLimite({ janelaMs: 60_000, maximo: 30 }), validar(esquemaSimulacao), criarSimulacao);
  return rotas;
}
