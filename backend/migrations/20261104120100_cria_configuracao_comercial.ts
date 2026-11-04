import type { Knex } from 'knex';

// Valores comerciais editados no painel, não no código.
// Toda alteração é uma linha nova: a mais recente vale, e as anteriores guardam quem mudou o quê e quando.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('configuracao_comercial', (tabela) => {
    tabela.increments('id');
    tabela.decimal('margem', 6, 4).notNullable();
    tabela.decimal('instalacao_por_kwp', 12, 2).notNullable();
    tabela.decimal('custo_referencia_por_kwp', 12, 2).notNullable();
    tabela.integer('validade_dias').notNullable();
    tabela.decimal('limite_desconto', 6, 4).notNullable();
    tabela.integer('alterado_por').references('id').inTable('usuario');
    tabela.timestamp('criado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    tabela.timestamp('atualizado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('forma_pagamento', (tabela) => {
    tabela.increments('id');
    tabela.enu('tipo', ['avista', 'parcelado', 'financiado']).notNullable();
    tabela.string('nome', 80).notNullable().unique();
    // Ao mês; vazia enquanto o gestor não define (a forma só fica ativa com a taxa preenchida).
    tabela.decimal('taxa_mensal', 8, 6);
    tabela.integer('parcelas_minimas').notNullable().defaultTo(1);
    tabela.integer('parcelas_maximas').notNullable().defaultTo(1);
    tabela.decimal('entrada_minima', 6, 4).notNullable().defaultTo(0);
    tabela.integer('carencia_maxima_dias').notNullable().defaultTo(0);
    tabela.decimal('desconto_avista', 6, 4).notNullable().defaultTo(0);
    tabela.boolean('ativa').notNullable().defaultTo(false);
    tabela.integer('alterado_por').references('id').inTable('usuario');
    tabela.timestamp('criado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    tabela.timestamp('atualizado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  // Valores iniciais: a gestão os ajusta antes do primeiro orçamento.
  await knex('configuracao_comercial').insert({
    margem: '0.20', instalacao_por_kwp: '700.00', custo_referencia_por_kwp: '4000.00', validade_dias: 10, limite_desconto: '0.10',
  });
  await knex('forma_pagamento').insert([
    { tipo: 'avista', nome: 'À vista', desconto_avista: '0.05', ativa: true },
    { tipo: 'parcelado', nome: 'Cartão de crédito', parcelas_maximas: 12 },
    { tipo: 'financiado', nome: 'Financiamento solar', parcelas_maximas: 120, carencia_maxima_dias: 120 },
  ]);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('forma_pagamento');
  await knex.schema.dropTable('configuracao_comercial');
}
