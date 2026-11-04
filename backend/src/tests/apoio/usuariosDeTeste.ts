// O middleware confere o usuário no banco a cada requisição: aqui o "banco" tem um usuário de cada papel.
import type { UsuarioPublico } from '../../repositories/usuariosRepository.ts';

const USUARIOS: Record<number, UsuarioPublico> = {
  1: { id: 1, nome: 'Ana TI', email: 'ti@exemplo.com', papel: 'admin' },
  2: { id: 2, nome: 'Olívia Operadora', email: 'operador@exemplo.com', papel: 'operador' },
  3: { id: 3, nome: 'Gil Gestor', email: 'gestor@exemplo.com', papel: 'gestor' },
};

export async function buscarUsuarioPorId(id: number): Promise<UsuarioPublico | undefined> {
  return USUARIOS[id];
}
