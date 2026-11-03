import type { Knex } from 'knex';

// O tipo separa as limpezas: só a última limpeza (nunca uma corretiva) reinicia o prazo do alerta de limpeza.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('usina_manutencao', (tabela) => {
    tabela.increments('id');
    tabela.integer('usina_id').notNullable().references('id').inTable('usina').onDelete('RESTRICT');
    tabela.enu('tipo', ['limpeza', 'corretiva']).notNullable();
    tabela.date('data').notNullable();
    tabela.text('descricao').notNullable();
    tabela.timestamp('criado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    tabela.timestamp('atualizado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    tabela.index(['usina_id', 'tipo', 'data']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('usina_manutencao');
}
