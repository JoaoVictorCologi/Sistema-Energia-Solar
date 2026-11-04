import { Router } from 'express';
// Proteção e validação vêm do núcleo; o módulo só as usa.
import { autenticar, exigirAdmin } from '../../middlewares/autenticar.ts';
import { validar } from '../../middlewares/validar.ts';
// Os esquemas ficam junto dos handlers no controller; aqui cada rota só os liga.
import {
  alterarEquipamentoDaUsinaDoAdmin, alterarUsinaDoAdmin, buscarMunicipiosDoAdmin, criarEquipamentoDaUsina, criarUsina, desativarUsinaDoAdmin, esquemaMudancaDaUsina,
  esquemaMudancaDoEquipamentoDaUsina, esquemaNovaUsina, esquemaNovoEquipamentoDaUsina, listarUsinasDoAdmin, obterUsina,
} from './controllers/usinasController.ts';

// Rotas restritas do módulo. Cada uma leva o próprio caminho e a própria proteção: um use(autenticar) sem caminho
// aqui valeria também para as rotas registradas depois deste router.
export const rotasUsinas = Router();
// Sessão válida e papel de administrador: toda rota do módulo é restrita.
const admin = [autenticar, exigirAdmin];

// Lista só as usinas ativas, com busca pelo cliente e paginação.
rotasUsinas.get('/admin/usinas', ...admin, listarUsinasDoAdmin);
// Cadastra a usina; o corpo é validado antes de chegar ao controller.
rotasUsinas.post('/admin/usinas', ...admin, validar(esquemaNovaUsina), criarUsina);
// Busca de municípios do formulário da usina; só lê.
// Antes de /:id: senão "municipios" seria lido como o id de uma usina.
rotasUsinas.get('/admin/usinas/municipios', ...admin, buscarMunicipiosDoAdmin);
// Detalhe com equipamentos e vencimentos; responde também para usina desativada.
rotasUsinas.get('/admin/usinas/:id', ...admin, obterUsina);
// Altera só os campos enviados; o status não muda por aqui.
rotasUsinas.patch('/admin/usinas/:id', ...admin, validar(esquemaMudancaDaUsina), alterarUsinaDoAdmin);
// Rota própria para desativar: não apaga nada, e repetir o pedido não altera a usina.
rotasUsinas.post('/admin/usinas/:id/desativar', ...admin, desativarUsinaDoAdmin);
// Um equipamento físico por pedido.
rotasUsinas.post('/admin/usinas/:id/equipamentos', ...admin, validar(esquemaNovoEquipamentoDaUsina), criarEquipamentoDaUsina);
// Só encontra o equipamento dentro da usina da rota; o de outra usina responde 404.
rotasUsinas.patch('/admin/usinas/:id/equipamentos/:equipamentoId', ...admin, validar(esquemaMudancaDoEquipamentoDaUsina), alterarEquipamentoDaUsinaDoAdmin);
