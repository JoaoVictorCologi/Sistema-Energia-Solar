// Rotas da área restrita. Toda rota exige sessão e o papel certo: equipe (admin, gestor, operador) ou gestão (admin, gestor).
import { Router } from 'express';
import { listarClientesDoAdmin, listarSimulacoesDoAdmin, obterCliente, obterPainel } from '../controllers/adminController.ts';
import {
  criarForma, editarConfiguracao, editarForma, esquemaConfiguracao, esquemaMudancaDeForma, esquemaNovaForma, listarFormas, obterConfiguracao,
} from '../controllers/configuracoesController.ts';
import {
  alterarEquipamentoDoAdmin, alterarStatusDaProposta, criarEquipamento, criarProposta, duplicar, editarProposta, enviarOrcamento, esquemaAjuste, esquemaCondicao,
  esquemaEdicaoDoRascunho, esquemaMudancaDeEquipamento, esquemaNovaProposta, esquemaNovoEquipamento, esquemaStatus, esquemaTrocaNaCopia, excluirAjuste, excluirCondicao,
  excluirRascunhoDaProposta, incluirAjuste, incluirCondicao, listarEquipamentosDoAdmin, listarPropostasDoAdmin, novaVersao, obterProposta,
} from '../controllers/propostasController.ts';
import {
  criarUsuario, editarUsuario, esquemaMudancaDeUsuario, esquemaNovaSenha, esquemaNovoUsuario, listarUsuarios, removerUsuario, trocarSenhaDoUsuario,
} from '../controllers/usuariosController.ts';
import { autenticar, exigirEquipe, exigirGestao } from '../middlewares/autenticar.ts';
import { validar } from '../middlewares/validar.ts';

export const rotasAdmin = Router();
const equipe = [autenticar, exigirEquipe];
const gestao = [autenticar, exigirGestao];

rotasAdmin.get('/admin/painel', ...equipe, obterPainel);
rotasAdmin.get('/admin/clientes', ...equipe, listarClientesDoAdmin);
rotasAdmin.get('/admin/clientes/:id', ...equipe, obterCliente);
rotasAdmin.get('/admin/simulacoes', ...equipe, listarSimulacoesDoAdmin);

// O operador lê catálogo, configurações e formas para orçar; quem altera é a gestão.
rotasAdmin.get('/admin/equipamentos', ...equipe, listarEquipamentosDoAdmin);
rotasAdmin.post('/admin/equipamentos', ...gestao, validar(esquemaNovoEquipamento), criarEquipamento);
rotasAdmin.patch('/admin/equipamentos/:id', ...gestao, validar(esquemaMudancaDeEquipamento), alterarEquipamentoDoAdmin);
rotasAdmin.get('/admin/configuracoes-comerciais', ...equipe, obterConfiguracao);
rotasAdmin.patch('/admin/configuracoes-comerciais', ...gestao, validar(esquemaConfiguracao), editarConfiguracao);
rotasAdmin.get('/admin/formas-pagamento', ...equipe, listarFormas);
rotasAdmin.post('/admin/formas-pagamento', ...gestao, validar(esquemaNovaForma), criarForma);
rotasAdmin.patch('/admin/formas-pagamento/:id', ...gestao, validar(esquemaMudancaDeForma), editarForma);

rotasAdmin.get('/admin/usuarios', ...gestao, listarUsuarios);
rotasAdmin.post('/admin/usuarios', ...gestao, validar(esquemaNovoUsuario), criarUsuario);
rotasAdmin.patch('/admin/usuarios/:id', ...gestao, validar(esquemaMudancaDeUsuario), editarUsuario);
rotasAdmin.post('/admin/usuarios/:id/senha', ...gestao, validar(esquemaNovaSenha), trocarSenhaDoUsuario);
rotasAdmin.delete('/admin/usuarios/:id', ...gestao, removerUsuario);

rotasAdmin.get('/admin/propostas', ...equipe, listarPropostasDoAdmin);
rotasAdmin.post('/admin/propostas', ...equipe, validar(esquemaNovaProposta), criarProposta);
rotasAdmin.get('/admin/propostas/:id', ...equipe, obterProposta);
rotasAdmin.patch('/admin/propostas/:id', ...equipe, validar(esquemaEdicaoDoRascunho), editarProposta);
rotasAdmin.delete('/admin/propostas/:id', ...equipe, excluirRascunhoDaProposta);
rotasAdmin.post('/admin/propostas/:id/ajustes', ...equipe, validar(esquemaAjuste), incluirAjuste);
rotasAdmin.delete('/admin/propostas/:id/ajustes/:itemId', ...equipe, excluirAjuste);
rotasAdmin.post('/admin/propostas/:id/condicoes', ...equipe, validar(esquemaCondicao), incluirCondicao);
rotasAdmin.delete('/admin/propostas/:id/condicoes/:itemId', ...equipe, excluirCondicao);
rotasAdmin.post('/admin/propostas/:id/enviar', ...equipe, enviarOrcamento);
rotasAdmin.post('/admin/propostas/:id/nova-versao', ...equipe, validar(esquemaTrocaNaCopia), novaVersao);
rotasAdmin.post('/admin/propostas/:id/duplicar', ...equipe, validar(esquemaTrocaNaCopia), duplicar);
rotasAdmin.patch('/admin/propostas/:id/status', ...equipe, validar(esquemaStatus), alterarStatusDaProposta);
