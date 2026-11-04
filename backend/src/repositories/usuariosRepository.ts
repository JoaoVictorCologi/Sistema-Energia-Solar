// Usuários da área restrita. Só a consulta do login lê senha_hash.
import { db } from '../database/conexao.ts';
import type { Papel, Usuario } from '../tipos/tabelas.ts';

// O que pode sair do backend: nunca inclui senha_hash.
export type UsuarioPublico = Pick<Usuario, 'id' | 'nome' | 'email' | 'papel'>;
export type UsuarioParaLogin = UsuarioPublico & Pick<Usuario, 'senha_hash'>;
export type UsuarioDaLista = UsuarioPublico & Pick<Usuario, 'criado_em'>;

const COLUNAS_PUBLICAS = ['id', 'nome', 'email', 'papel'] as const;

// Usuário excluído é desativado: não entra, não aparece nas listas e segue ligado ao histórico dos orçamentos.
export async function buscarUsuarioParaLogin(email: string): Promise<UsuarioParaLogin | undefined> {
  return db<Usuario>('usuario').select(...COLUNAS_PUBLICAS, 'senha_hash').where({ email, ativo: true }).first();
}

export async function buscarUsuarioPorId(id: number): Promise<UsuarioPublico | undefined> {
  return db<Usuario>('usuario').select(...COLUNAS_PUBLICAS).where({ id, ativo: true }).first();
}

// Conta também os excluídos: o mesmo e-mail não pode ser recriado enquanto a conta existir.
export async function existeUsuarioComEmail(email: string): Promise<boolean> {
  const usuario = await db<Usuario>('usuario').select('id').where({ email }).first();
  return usuario !== undefined;
}

export async function inserirUsuario(dados: Pick<Usuario, 'nome' | 'email' | 'senha_hash' | 'papel'>): Promise<UsuarioPublico> {
  const [usuario] = await db<Usuario>('usuario').insert(dados).returning([...COLUNAS_PUBLICAS]);
  return usuario;
}

export async function listarUsuariosAtivos(semPapel?: Papel): Promise<UsuarioDaLista[]> {
  const consulta = db<Usuario>('usuario').select(...COLUNAS_PUBLICAS, 'criado_em').where({ ativo: true }).orderBy('nome');
  if (semPapel) consulta.whereNot({ papel: semPapel });
  return consulta;
}

export async function atualizarUsuario(id: number, mudanca: Partial<Pick<Usuario, 'nome' | 'email' | 'papel'>>): Promise<UsuarioPublico> {
  const [usuario] = await db<Usuario>('usuario').where({ id }).update({ ...mudanca, atualizado_em: new Date() }).returning([...COLUNAS_PUBLICAS]);
  return usuario;
}

export async function atualizarSenha(id: number, senhaHash: string): Promise<void> {
  await db<Usuario>('usuario').where({ id }).update({ senha_hash: senhaHash, atualizado_em: new Date() });
}

export async function desativarUsuario(id: number): Promise<void> {
  await db<Usuario>('usuario').where({ id }).update({ ativo: false, atualizado_em: new Date() });
}
