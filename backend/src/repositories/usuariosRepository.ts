import { db } from '../database/conexao.ts';
import type { Usuario } from '../tipos/tabelas.ts';

// O que pode sair do backend: nunca inclui senha_hash.
export type UsuarioPublico = Pick<Usuario, 'id' | 'nome' | 'email' | 'papel'>;
export type UsuarioParaLogin = UsuarioPublico & Pick<Usuario, 'senha_hash'>;

const COLUNAS_PUBLICAS = ['id', 'nome', 'email', 'papel'] as const;

export async function buscarUsuarioParaLogin(email: string): Promise<UsuarioParaLogin | undefined> {
  return db<Usuario>('usuario').select(...COLUNAS_PUBLICAS, 'senha_hash').where({ email }).first();
}

export async function buscarUsuarioPorId(id: number): Promise<UsuarioPublico | undefined> {
  return db<Usuario>('usuario').select(...COLUNAS_PUBLICAS).where({ id }).first();
}

export async function existeUsuarioComEmail(email: string): Promise<boolean> {
  const usuario = await db<Usuario>('usuario').select('id').where({ email }).first();
  return usuario !== undefined;
}

export async function inserirUsuario(dados: Pick<Usuario, 'nome' | 'email' | 'senha_hash' | 'papel'>): Promise<UsuarioPublico> {
  const [usuario] = await db<Usuario>('usuario').insert(dados).returning([...COLUNAS_PUBLICAS]);
  return usuario;
}
