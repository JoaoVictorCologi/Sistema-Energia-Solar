import type { Knex } from 'knex';

// A proposta nasce em rascunho, o operador ajusta e envia. Depois de enviada, só muda de status;
// alterar cria uma nova versão, e a anterior fica no histórico.
export async function up(knex: Knex): Promise<void> {
  await knex.raw('alter table proposta drop constraint proposta_status_check');
  await knex.raw("alter table proposta add constraint proposta_status_check check (status in ('rascunho', 'enviada', 'aceita', 'recusada'))");
  await knex.raw("alter table proposta alter column status set default 'rascunho'");
  await knex.schema.alterTable('proposta', (tabela) => {
    tabela.integer('versao').notNullable().defaultTo(1);
    // A primeira versão: todas as versões do mesmo orçamento apontam para ela (na primeira, fica vazia).
    tabela.integer('proposta_raiz_id').references('id').inTable('proposta').index();
    tabela.text('observacoes');
    // Módulo, inversor e premissas revisadas pelo operador: o que se refaz a cada alteração do rascunho.
    tabela.jsonb('escolhas');
    tabela.integer('criada_por').references('id').inTable('usuario');
  });
  // Propostas já emitidas viram a versão 1, com os equipamentos que estão no snapshot.
  await knex.raw("update proposta set escolhas = jsonb_build_object('moduloId', snapshot->'equipamentos'->'modulo'->'id', 'inversorId', snapshot->'equipamentos'->'inversor'->'id')");
  await knex.schema.alterTable('proposta', (tabela) => {
    tabela.jsonb('escolhas').notNullable().alter();
  });

  await knex.schema.createTable('proposta_ajuste', (tabela) => {
    tabela.increments('id');
    tabela.integer('proposta_id').notNullable().references('id').inTable('proposta').onDelete('CASCADE').index();
    tabela.enu('tipo', ['desconto', 'acrescimo']).notNullable();
    tabela.string('descricao', 200).notNullable();
    tabela.enu('modo', ['valor', 'percentual']).notNullable();
    // Em reais, ou fração do preço calculado (0,05 = 5%).
    tabela.decimal('valor', 12, 4).notNullable();
    tabela.text('justificativa');
    tabela.integer('criado_por').references('id').inTable('usuario');
    tabela.timestamp('criado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    tabela.timestamp('atualizado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('proposta_condicao', (tabela) => {
    tabela.increments('id');
    tabela.integer('proposta_id').notNullable().references('id').inTable('proposta').onDelete('CASCADE').index();
    tabela.integer('forma_pagamento_id').notNullable().references('id').inTable('forma_pagamento');
    // Cópia da forma na data: mudar a forma no painel não altera este orçamento.
    tabela.string('nome', 80).notNullable();
    tabela.enu('tipo', ['avista', 'parcelado', 'financiado']).notNullable();
    tabela.decimal('taxa_mensal', 8, 6).notNullable();
    tabela.decimal('desconto_avista', 6, 4).notNullable();
    tabela.decimal('entrada_minima', 6, 4).notNullable();
    // Vazia: a entrada mínima da forma, recalculada quando o valor final muda.
    tabela.decimal('entrada', 12, 2);
    tabela.integer('parcelas').notNullable();
    tabela.integer('carencia_dias').notNullable();
    tabela.integer('criado_por').references('id').inTable('usuario');
    tabela.timestamp('criado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    tabela.timestamp('atualizado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('proposta_evento', (tabela) => {
    tabela.increments('id');
    tabela.integer('proposta_id').notNullable().references('id').inTable('proposta').onDelete('CASCADE').index();
    // Vazio quando o evento veio de um script (dados de demonstração).
    tabela.integer('usuario_id').references('id').inTable('usuario');
    tabela.string('tipo', 40).notNullable();
    tabela.string('descricao', 300).notNullable();
    tabela.text('justificativa');
    tabela.timestamp('criado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    tabela.timestamp('atualizado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('proposta_evento');
  await knex.schema.dropTable('proposta_condicao');
  await knex.schema.dropTable('proposta_ajuste');
  await knex.schema.alterTable('proposta', (tabela) => {
    tabela.dropColumns('versao', 'proposta_raiz_id', 'observacoes', 'escolhas', 'criada_por');
  });
  await knex.raw('alter table proposta drop constraint proposta_status_check');
  await knex('proposta').where({ status: 'rascunho' }).update({ status: 'enviada' });
  await knex.raw("alter table proposta add constraint proposta_status_check check (status in ('enviada', 'aceita', 'recusada'))");
  await knex.raw("alter table proposta alter column status set default 'enviada'");
}
