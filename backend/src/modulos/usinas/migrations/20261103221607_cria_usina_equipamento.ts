import type { Knex } from 'knex';

// Os vencimentos das garantias não são colunas: são calculados a partir da data de instalação.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('usina_equipamento', (tabela) => {
    tabela.increments('id');
    tabela.integer('usina_id').notNullable().references('id').inTable('usina').onDelete('RESTRICT');
    tabela.enu('tipo', ['modulo', 'inversor']).notNullable();
    tabela.string('marca', 80).notNullable();
    tabela.string('modelo', 120).notNullable();
    tabela.string('numero_serie', 100).notNullable();
    tabela.integer('quantidade').notNullable();
    tabela.date('data_instalacao').notNullable();
    tabela.integer('garantia_produto_meses').notNullable();
    tabela.integer('garantia_desempenho_anos');
    tabela.timestamp('criado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    tabela.timestamp('atualizado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    // Alvo da chave composta de usina_alerta, que impede alerta apontando para equipamento de outra usina.
    tabela.unique(['usina_id', 'id']);
    tabela.check('quantidade > 0', [], 'usina_equipamento_quantidade_positiva');
    tabela.check('garantia_produto_meses > 0', [], 'usina_equipamento_garantia_produto_positiva');
    tabela.check('garantia_desempenho_anos > 0', [], 'usina_equipamento_garantia_desempenho_positiva');
    tabela.check("tipo = 'modulo' OR garantia_desempenho_anos IS NULL", [], 'usina_equipamento_garantia_desempenho_so_em_modulo');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('usina_equipamento');
}
