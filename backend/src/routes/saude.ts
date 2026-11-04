// Sem limite de requisições: o monitoramento consulta esta rota o tempo todo.
import { Router } from 'express';
import { obterSaude } from '../controllers/saudeController.ts';

export const rotasSaude = Router();

rotasSaude.get('/health', obterSaude);
