import type { Knex } from 'knex';

// Plano 5, tarefa 2: a distribuidora passa a ser identificada pelo CNPJ (a sigla muda depois de incorporações:
// o mesmo CNPJ aparece como "CPFL JAGUARI" e como "CPFL Santa Cruz"), e cada município é ligado às suas.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('distribuidora', (tabela) => {
    tabela.dropUnique(['sigla']);
    tabela.string('cnpj', 14).notNullable().alter();
  });

  await knex.schema.createTable('municipio_distribuidora', (tabela) => {
    tabela.increments('id');
    tabela.integer('codigo_ibge').notNullable().references('codigo_ibge').inTable('municipio');
    tabela.integer('distribuidora_id').notNullable().references('id').inTable('distribuidora');
    // Conjuntos de unidades consumidoras da distribuidora no município (indicadores de qualidade da ANEEL).
    tabela.integer('conjuntos').notNullable();
    // A de mais conjuntos: vem marcada quando o cliente precisa escolher entre mais de uma.
    tabela.boolean('sugerida').notNullable();
    tabela.integer('importacao_id').references('id').inTable('importacao');
    tabela.timestamp('criado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    tabela.timestamp('atualizado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    tabela.unique(['codigo_ibge', 'distribuidora_id']);
    tabela.index(['distribuidora_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('municipio_distribuidora');
  await knex.schema.alterTable('distribuidora', (tabela) => {
    tabela.string('cnpj', 14).nullable().alter();
    tabela.unique(['sigla']);
  });
}
