import type { Knex } from 'knex';

// Cadastro de quem pede uma proposta. A ligação com a simulação vem numa migration posterior.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('cliente', (tabela) => {
    tabela.increments('id');
    tabela.string('nome', 120).notNullable();
    tabela.string('email', 254).notNullable().index();
    tabela.string('telefone', 20).notNullable();
    tabela.string('cep', 8).notNullable();
    // LGPD: só existe cliente com aceite do uso dos dados, e a data do aceite fica registrada.
    tabela.timestamp('aceite_em', { useTz: true }).notNullable();
    tabela.timestamp('criado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    tabela.timestamp('atualizado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('cliente');
}
