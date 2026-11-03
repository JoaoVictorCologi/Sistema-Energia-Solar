import { Router } from 'express';
import { criarPedidoDeProposta, esquemaPedidoDeProposta } from '../controllers/clientesController.ts';
import { criarLimite } from '../middlewares/limites.ts';
import { validar } from '../middlewares/validar.ts';

// Contra cadastro em massa: 5 pedidos por minuto por IP (o limite vive no router criado aqui).
export function criarRotasClientes(): Router {
  const rotas = Router();
  rotas.post('/clientes', criarLimite({ janelaMs: 60_000, maximo: 5 }), validar(esquemaPedidoDeProposta), criarPedidoDeProposta);
  return rotas;
}
