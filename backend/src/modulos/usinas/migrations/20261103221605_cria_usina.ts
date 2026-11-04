import type { Knex } from 'knex';

// Plano 2: usina de um cliente do núcleo. O regime (GD I ou GD II) não é coluna: o backend o calcula
// pela data de protocolo, e assim ele nunca diverge da data nem depende de quem grava.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('usina', (tabela) => {
    tabela.increments('id');
    tabela.integer('cliente_id').notNullable().references('id').inTable('cliente').onDelete('RESTRICT').index();
    tabela.integer('codigo_ibge').notNullable().references('codigo_ibge').inTable('municipio').onDelete('RESTRICT');
    tabela.decimal('kwp', 10, 3).notNullable();
    tabela.date('data_protocolo').notNullable();
    tabela.date('data_conexao').notNullable();
    tabela.smallint('intervalo_limpeza_meses').notNullable();
    // Sem exclusão física: a usina desativada some das listas e do job, mas o histórico fica.
    tabela.enu('status', ['ativa', 'desativada']).notNullable().defaultTo('ativa');
    tabela.timestamp('criado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    tabela.timestamp('atualizado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    tabela.check('kwp > 0', [], 'usina_kwp_positivo');
    tabela.check('intervalo_limpeza_meses IN (6, 12)', [], 'usina_intervalo_limpeza_valido');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('usina');
}
