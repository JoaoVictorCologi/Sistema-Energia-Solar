import type { Knex } from 'knex';

// Um alerta é identificado pelo alvo (usina, tipo, equipamento e tipo de garantia) e pelo ciclo, a data de
// referência da ocorrência: limpeza, o dia em que venceu o intervalo; garantia, o dia do vencimento.
// O valor de ciclo nos alertas de abrirAlerta será definido na P2-T3.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('usina_alerta', (tabela) => {
    tabela.increments('id');
    tabela.integer('usina_id').notNullable().references('id').inTable('usina').onDelete('RESTRICT');
    // Opcionais porque abrirAlerta(usinaId, tipo, descricao) não os informa; o job de garantia preenche os dois.
    tabela.integer('usina_equipamento_id');
    // Um módulo tem duas garantias: sem esta coluna, o alerta aberto de uma bloquearia o da outra.
    tabela.enu('tipo_garantia', ['produto', 'desempenho']);
    tabela.enu('tipo', ['limpeza', 'garantia', 'desempenho']).notNullable();
    tabela.text('descricao').notNullable();
    tabela.enu('status', ['aberto', 'resolvido']).notNullable().defaultTo('aberto');
    tabela.date('ciclo').notNullable();
    tabela.timestamp('aberto_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    tabela.timestamp('resolvido_em', { useTz: true });
    tabela.text('resolucao');
    tabela.timestamp('criado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    tabela.timestamp('atualizado_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    tabela.foreign(['usina_id', 'usina_equipamento_id'], 'usina_alerta_equipamento_da_mesma_usina')
      .references(['usina_id', 'id']).inTable('usina_equipamento').onDelete('RESTRICT');
    tabela.check(
      "tipo = 'garantia' OR (usina_equipamento_id IS NULL AND tipo_garantia IS NULL)",
      [],
      'usina_alerta_equipamento_so_em_garantia',
    );
    tabela.check(
      '(usina_equipamento_id IS NULL) = (tipo_garantia IS NULL)',
      [],
      'usina_alerta_equipamento_com_tipo_de_garantia',
    );
    // Resolver exige registro: alerta resolvido tem data e descrição, e alerta aberto não tem nenhuma das duas.
    // O IS NOT NULL é necessário: btrim(NULL) <> '' dá NULL, e um CHECK com resultado NULL deixa a linha passar.
    tabela.check(
      `(status = 'aberto' AND resolvido_em IS NULL AND resolucao IS NULL)
        OR (status = 'resolvido' AND resolvido_em IS NOT NULL AND resolucao IS NOT NULL AND btrim(resolucao) <> '')`,
      [],
      'usina_alerta_resolucao_coerente',
    );
  });

  // NULLS NOT DISTINCT: sem ele, duas linhas sem equipamento nunca colidiriam, porque nulo é diferente de nulo.
  // Impede duplicar um alerta aberto, mesmo de outro ciclo.
  await knex.raw(`
    CREATE UNIQUE INDEX usina_alerta_unico_aberto
    ON usina_alerta (usina_id, tipo, usina_equipamento_id, tipo_garantia) NULLS NOT DISTINCT
    WHERE status = 'aberto'
  `);
  // Vale para qualquer status: um alerta resolvido não reabre no mesmo ciclo.
  await knex.raw(`
    CREATE UNIQUE INDEX usina_alerta_unico_por_ciclo
    ON usina_alerta (usina_id, tipo, usina_equipamento_id, tipo_garantia, ciclo) NULLS NOT DISTINCT
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('usina_alerta');
}
