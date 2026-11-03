import type { Knex } from 'knex';

// Tabelas alimentadas pelos scripts de carga (IBGE, Atlas) e pelas importações da tarefa 6 (ANEEL, Banco Central).
// O resto do sistema só lê. Valores de tarifa e irradiação em numeric: o repository converte para Decimal.

function datasDeControle(knex: Knex, tabela: Knex.CreateTableBuilder): void {
  tabela.timestamp('criado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  tabela.timestamp('atualizado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('municipio', (tabela) => {
    tabela.increments('id');
    tabela.integer('codigo_ibge').notNullable().unique();
    tabela.string('nome', 100).notNullable();
    tabela.string('uf', 2).notNullable().index();
    datasDeControle(knex, tabela);
  });

  await knex.schema.createTable('distribuidora', (tabela) => {
    tabela.increments('id');
    // SigAgente da ANEEL: chave das tarifas. O CNPJ é a chave dos componentes tarifários (Fio B).
    tabela.string('sigla', 60).notNullable().unique();
    tabela.string('cnpj', 14).unique();
    tabela.string('nome', 150).notNullable();
    datasDeControle(knex, tabela);
  });

  await knex.schema.createTable('importacao', (tabela) => {
    tabela.increments('id');
    tabela.string('tipo', 60).notNullable();
    tabela.enu('status', ['executando', 'sucesso', 'sem_alteracao', 'erro']).notNullable();
    tabela.timestamp('iniciada_em', { useTz: true }).notNullable();
    tabela.timestamp('finalizada_em', { useTz: true });
    // Data de modificação ou hash do recurso na origem: sem mudança, a próxima execução não baixa nada.
    tabela.string('versao_da_fonte', 100);
    tabela.integer('linhas_gravadas').notNullable().defaultTo(0);
    tabela.text('mensagem');
    datasDeControle(knex, tabela);
    tabela.index(['tipo', 'iniciada_em']);
  });

  await knex.schema.createTable('tarifa', (tabela) => {
    tabela.increments('id');
    tabela.integer('distribuidora_id').notNullable().references('id').inTable('distribuidora');
    tabela.string('subgrupo', 10).notNullable();
    tabela.string('modalidade', 40).notNullable();
    tabela.string('classe', 60).notNullable();
    tabela.string('subclasse', 80).notNullable();
    // Reais por kWh, sem impostos (a ANEEL publica por MWh; a importação divide por 1000).
    tabela.decimal('te_rs_kwh', 12, 6).notNullable();
    tabela.decimal('tusd_rs_kwh', 12, 6).notNullable();
    // Fio B vem de outro conjunto da ANEEL (componentes tarifários); base da cobrança da Lei 14.300.
    tabela.decimal('fio_b_rs_kwh', 12, 6);
    tabela.date('inicio_vigencia').notNullable();
    tabela.date('fim_vigencia');
    tabela.integer('importacao_id').references('id').inTable('importacao');
    datasDeControle(knex, tabela);
    // Vigência nova vira linha nova: o histórico de tarifas fica preservado.
    tabela.unique(['distribuidora_id', 'subgrupo', 'modalidade', 'classe', 'subclasse', 'inicio_vigencia']);
  });

  await knex.schema.createTable('irradiacao_municipio', (tabela) => {
    tabela.increments('id');
    tabela.integer('codigo_ibge').notNullable().unique().references('codigo_ibge').inTable('municipio');
    // HSP (horas de sol pleno por dia) = irradiação no plano inclinado em Wh/m² por dia ÷ 1000.
    tabela.decimal('hsp_anual', 6, 3).notNullable();
    for (const mes of MESES) tabela.decimal(`hsp_${mes}`, 6, 3).notNullable();
    datasDeControle(knex, tabela);
  });

  await knex.schema.createTable('indicador_economico', (tabela) => {
    tabela.increments('id');
    // Código da série no SGS do Banco Central: 433 (IPCA mensal), 13522 (IPCA em 12 meses), 432 (Selic meta).
    tabela.integer('serie').notNullable();
    tabela.date('data').notNullable();
    tabela.decimal('valor', 12, 6).notNullable();
    tabela.integer('importacao_id').references('id').inTable('importacao');
    datasDeControle(knex, tabela);
    tabela.unique(['serie', 'data']);
  });

  await knex.schema.createTable('cep_cache', (tabela) => {
    tabela.increments('id');
    // Só o CEP e o município: o endereço completo é dado pessoal e não fica no cache.
    tabela.string('cep', 8).notNullable().unique();
    tabela.integer('codigo_ibge').notNullable().references('codigo_ibge').inTable('municipio');
    datasDeControle(knex, tabela);
  });
}

export async function down(knex: Knex): Promise<void> {
  for (const tabela of ['cep_cache', 'indicador_economico', 'irradiacao_municipio', 'tarifa', 'importacao', 'distribuidora', 'municipio']) {
    await knex.schema.dropTable(tabela);
  }
}
