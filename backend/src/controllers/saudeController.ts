import type { Request, Response } from 'express';
import { verificarSaude } from '../services/saudeService.ts';

export async function obterSaude(_requisicao: Request, resposta: Response): Promise<void> {
  const estado = await verificarSaude();
  resposta.status(estado.status === 'ok' ? 200 : 503).json(estado);
}
