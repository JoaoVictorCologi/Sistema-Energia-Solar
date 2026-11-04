import type { Knex } from 'knex';

// Papéis: admin (a TI), gestor (administra os usuários da operação) e operador.
// Excluir usuário é desativar: a conta segue ligada ao histórico dos orçamentos que fez.
export async function up(knex: Knex): Promise<void> {
  await knex.raw('alter table usuario drop constraint usuario_papel_check');
  await knex('usuario').where({ papel: 'usuario' }).update({ papel: 'operador' });
  await knex.raw("alter table usuario add constraint usuario_papel_check check (papel in ('admin', 'gestor', 'operador'))");
  await knex.raw("alter table usuario alter column papel set default 'operador'");
  await knex.schema.alterTable('usuario', (tabela) => {
    tabela.boolean('ativo').notNullable().defaultTo(true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('usuario', (tabela) => {
    tabela.dropColumn('ativo');
  });
  await knex.raw('alter table usuario drop constraint usuario_papel_check');
  await knex('usuario').whereIn('papel', ['gestor', 'operador']).update({ papel: 'usuario' });
  await knex.raw("alter table usuario add constraint usuario_papel_check check (papel in ('admin', 'usuario'))");
  await knex.raw("alter table usuario alter column papel set default 'usuario'");
}
