import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('usuario', (tabela) => {
    tabela.increments('id');
    tabela.string('nome', 120).notNullable();
    // Guardado sempre em minúsculas pelo service, por isso o índice único simples basta.
    tabela.string('email', 254).notNullable().unique();
    tabela.string('senha_hash', 100).notNullable();
    tabela.enu('papel', ['admin', 'usuario']).notNullable().defaultTo('usuario');
    tabela.timestamp('criado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    tabela.timestamp('atualizado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('usuario');
}
