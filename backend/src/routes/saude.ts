import { Router } from 'express';
import { obterSaude } from '../controllers/saudeController.ts';

export const rotasSaude = Router();

rotasSaude.get('/health', obterSaude);
