// Importações de dados: acesso só da TI.
import { Router } from 'express';
import { executarImportacao, listarImportacoes } from '../controllers/importacoesController.ts';
import { autenticar, exigirAdmin } from '../middlewares/autenticar.ts';

export const rotasImportacoes = Router();

rotasImportacoes.get('/admin/importacoes', autenticar, exigirAdmin, listarImportacoes);
rotasImportacoes.post('/admin/importacoes/:tipo', autenticar, exigirAdmin, executarImportacao);
