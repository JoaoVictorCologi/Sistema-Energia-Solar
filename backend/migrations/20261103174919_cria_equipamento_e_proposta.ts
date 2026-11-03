import type { Knex } from 'knex';

// Tarefa 14: catálogo de módulos e inversores com preço, e a proposta com o snapshot do que foi calculado.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('equipamento', (tabela) => {
    tabela.increments('id');
    tabela.enu('tipo', ['modulo', 'inversor']).notNullable();
    tabela.string('fabricante', 80).notNullable();
    tabela.string('modelo', 120).notNullable();
    // Módulo: potência de pico (W). Inversor: potência CA nominal (W).
    tabela.decimal('potencia_w', 10, 1).notNullable();
    // Só módulo; vazio usa a degradação padrão do parametros.json.
    tabela.decimal('degradacao_anual', 6, 4);
    tabela.decimal('preco', 12, 2).notNullable();
    tabela.boolean('ativo').notNullable().defaultTo(true);
    tabela.timestamp('criado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    tabela.timestamp('atualizado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    tabela.unique(['tipo', 'fabricante', 'modelo']);
  });

  await knex.schema.createTable('proposta', (tabela) => {
    tabela.increments('id');
    tabela.integer('cliente_id').notNullable().references('id').inTable('cliente').index();
    tabela.integer('simulacao_id').notNullable().references('id').inTable('simulacao');
    tabela.enu('status', ['enviada', 'aceita', 'recusada']).notNullable().defaultTo('enviada');
    tabela.decimal('investimento', 12, 2).notNullable();
    tabela.date('valida_ate').notNullable();
    // Entrada, resultado e preços da data: reabrir a proposta nunca recalcula.
    tabela.jsonb('snapshot').notNullable();
    tabela.timestamp('criado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    tabela.timestamp('atualizado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('proposta');
  await knex.schema.dropTable('equipamento');
}
