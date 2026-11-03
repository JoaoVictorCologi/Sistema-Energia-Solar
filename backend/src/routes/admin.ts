import { Router } from 'express';
import { listarClientesDoAdmin, obterCliente, obterPainel } from '../controllers/adminController.ts';
import { autenticar, exigirAdmin } from '../middlewares/autenticar.ts';

export const rotasAdmin = Router();

rotasAdmin.get('/admin/painel', autenticar, exigirAdmin, obterPainel);
rotasAdmin.get('/admin/clientes', autenticar, exigirAdmin, listarClientesDoAdmin);
rotasAdmin.get('/admin/clientes/:id', autenticar, exigirAdmin, obterCliente);
