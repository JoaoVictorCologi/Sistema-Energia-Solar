import type { Knex } from 'knex';

// Simulação pública: guarda a entrada e o resultado (JSONB) e as referências usadas,
// para reproduzir o cálculo e ligar o pedido de proposta (tarefa 12) sem recalcular.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('simulacao', (tabela) => {
    tabela.increments('id');
    // Identificador público (o id sequencial não sai do backend): o pedido de proposta usa este código.
    tabela.uuid('codigo').notNullable().unique().defaultTo(knex.fn.uuid());
    tabela.string('cep', 8).notNullable();
    tabela.integer('codigo_ibge').notNullable().references('codigo_ibge').inTable('municipio');
    tabela.integer('tarifa_id').notNullable().references('id').inTable('tarifa');
    tabela.integer('irradiacao_id').notNullable().references('id').inTable('irradiacao_municipio');
    tabela.string('versao_parametros', 40).notNullable();
    tabela.jsonb('entrada').notNullable();
    tabela.jsonb('resultado').notNullable();
    tabela.timestamp('criado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    tabela.timestamp('atualizado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('simulacao');
}
