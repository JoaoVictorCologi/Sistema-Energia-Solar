import { db } from '../database/conexao.ts';

// Apaga só o que o script de demonstração criou (e-mail do domínio e fabricante de demonstração), em transação.
export async function apagarDadosDeDemonstracao(dominioDoEmail: string, fabricante: string): Promise<void> {
  await db.transaction(async (transacao) => {
    const clientes = transacao('cliente').select('id').whereLike('email', `%@${dominioDoEmail}`);
    await transacao('proposta').whereIn('cliente_id', clientes).del();
    await transacao('simulacao').whereIn('cliente_id', clientes).del();
    await transacao('cliente').whereLike('email', `%@${dominioDoEmail}`).del();
    await transacao('equipamento').where({ fabricante }).del();
  });
}
