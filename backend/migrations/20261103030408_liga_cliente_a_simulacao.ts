import type { Knex } from 'knex';

// O pedido de proposta liga a simulação ao cliente criado. Simulação sem pedido fica sem cliente.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('simulacao', (tabela) => {
    tabela.integer('cliente_id').references('id').inTable('cliente').index();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('simulacao', (tabela) => {
    tabela.dropColumn('cliente_id');
  });
}
