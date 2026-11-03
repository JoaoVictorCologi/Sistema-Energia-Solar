import { Router } from 'express';
import { listarClientesDoAdmin, obterCliente, obterPainel } from '../controllers/adminController.ts';
import {
  alterarEquipamentoDoAdmin, alterarStatusDaProposta, criarEquipamento, criarProposta, esquemaMudancaDeEquipamento, esquemaNovaProposta,
  esquemaNovoEquipamento, esquemaStatus, listarEquipamentosDoAdmin, listarPropostasDoAdmin, obterProposta,
} from '../controllers/propostasController.ts';
import { autenticar, exigirAdmin } from '../middlewares/autenticar.ts';
import { validar } from '../middlewares/validar.ts';

export const rotasAdmin = Router();
const admin = [autenticar, exigirAdmin];

rotasAdmin.get('/admin/painel', ...admin, obterPainel);
rotasAdmin.get('/admin/clientes', ...admin, listarClientesDoAdmin);
rotasAdmin.get('/admin/clientes/:id', ...admin, obterCliente);

rotasAdmin.get('/admin/equipamentos', ...admin, listarEquipamentosDoAdmin);
rotasAdmin.post('/admin/equipamentos', ...admin, validar(esquemaNovoEquipamento), criarEquipamento);
rotasAdmin.patch('/admin/equipamentos/:id', ...admin, validar(esquemaMudancaDeEquipamento), alterarEquipamentoDoAdmin);

rotasAdmin.get('/admin/propostas', ...admin, listarPropostasDoAdmin);
rotasAdmin.post('/admin/propostas', ...admin, validar(esquemaNovaProposta), criarProposta);
rotasAdmin.get('/admin/propostas/:id', ...admin, obterProposta);
rotasAdmin.patch('/admin/propostas/:id/status', ...admin, validar(esquemaStatus), alterarStatusDaProposta);
