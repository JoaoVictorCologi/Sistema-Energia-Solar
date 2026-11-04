// Usuários da área restrita: o admin é a TI; o gestor administra a operação; o operador orça.
import { ErroHttp } from '../middlewares/erros.ts';
import {
  atualizarSenha, atualizarUsuario, buscarUsuarioPorId, desativarUsuario, existeUsuarioComEmail, inserirUsuario, listarUsuariosAtivos,
  type UsuarioPublico,
} from '../repositories/usuariosRepository.ts';
import type { Papel } from '../tipos/tabelas.ts';
import { gerarHashDaSenha, type UsuarioDaSessao } from './authService.ts';

// A conta da TI só é criada por linha de comando. Gestor é criado pelo admin; operador, pelo admin ou por um gestor.
function papeisQuePodeAtribuir(ator: UsuarioDaSessao): Papel[] {
  return ator.papel === 'admin' ? ['gestor', 'operador'] : ['operador'];
}

function conferirPapelAtribuido(ator: UsuarioDaSessao, papel: Papel): void {
  if (!papeisQuePodeAtribuir(ator).includes(papel)) {
    throw new ErroHttp(403, 'SEM_PERMISSAO', 'Só a TI pode criar ou promover um gestor.');
  }
}

// A conta da TI não é alterada pela API, por ninguém.
async function buscarAlvoDaGestao(id: number): Promise<UsuarioPublico> {
  const alvo = await buscarUsuarioPorId(id);
  if (!alvo) throw new ErroHttp(404, 'USUARIO_NAO_ENCONTRADO', 'Usuário não encontrado.');
  if (alvo.papel === 'admin') throw new ErroHttp(403, 'SEM_PERMISSAO', 'O usuário da TI não pode ser alterado por aqui.');
  return alvo;
}

async function conferirEmailLivre(email: string): Promise<void> {
  if (await existeUsuarioComEmail(email)) throw new ErroHttp(409, 'EMAIL_EM_USO', 'Já existe um usuário com este e-mail, mesmo que excluído.');
}

// O gestor não vê a conta da TI.
export async function consultarUsuarios(ator: UsuarioDaSessao) {
  const usuarios = await listarUsuariosAtivos(ator.papel === 'admin' ? undefined : 'admin');
  return usuarios.map(({ id, nome, email, papel, criado_em: criadoEm }) => ({ id, nome, email, papel, criadoEm }));
}

export async function cadastrarUsuario(ator: UsuarioDaSessao, dados: { nome: string; email: string; senha: string; papel: Papel }) {
  conferirPapelAtribuido(ator, dados.papel);
  await conferirEmailLivre(dados.email);
  return inserirUsuario({ nome: dados.nome, email: dados.email, papel: dados.papel, senha_hash: await gerarHashDaSenha(dados.senha) });
}

export async function alterarUsuario(ator: UsuarioDaSessao, id: number, mudanca: { nome?: string; email?: string; papel?: Papel }) {
  const alvo = await buscarAlvoDaGestao(id);
  if (mudanca.papel && mudanca.papel !== alvo.papel) conferirPapelAtribuido(ator, mudanca.papel);
  if (mudanca.email && mudanca.email !== alvo.email) await conferirEmailLivre(mudanca.email);
  return atualizarUsuario(id, mudanca);
}

export async function redefinirSenha(id: number, senha: string): Promise<void> {
  await buscarAlvoDaGestao(id);
  await atualizarSenha(id, await gerarHashDaSenha(senha));
}

// Não apaga a linha: a conta segue ligada ao histórico dos orçamentos. Ninguém exclui a si mesmo, para não ficar sem acesso.
export async function excluirUsuario(ator: UsuarioDaSessao, id: number): Promise<void> {
  if (ator.id === id) throw new ErroHttp(409, 'EXCLUSAO_DA_PROPRIA_CONTA', 'Você não pode excluir a sua própria conta.');
  await buscarAlvoDaGestao(id);
  await desativarUsuario(id);
}
