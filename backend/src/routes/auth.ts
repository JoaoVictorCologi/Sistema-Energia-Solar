import { Router } from 'express';
import { entrar, esquemaLogin, obterUsuarioLogado, sair } from '../controllers/authController.ts';
import { autenticar } from '../middlewares/autenticar.ts';
import { criarLimite } from '../middlewares/limites.ts';
import { validar } from '../middlewares/validar.ts';

// Criado por função porque a contagem do limite vive no router: cada app (e cada teste) começa do zero.
export function criarRotasAuth(): Router {
  const rotas = Router();
  // Contra força bruta na senha: 5 tentativas a cada 15 minutos por IP.
  const limiteLogin = criarLimite({ janelaMs: 15 * 60_000, maximo: 5 });

  rotas.post('/auth/login', limiteLogin, validar(esquemaLogin), entrar);
  rotas.post('/auth/logout', sair);
  rotas.get('/auth/me', autenticar, obterUsuarioLogado);
  return rotas;
}
