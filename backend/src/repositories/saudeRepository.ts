// Consulta mínima para saber se o banco responde.
import { db } from '../database/conexao.ts';

export async function verificarConexaoBanco(): Promise<void> {
  await db.raw('select 1');
}
