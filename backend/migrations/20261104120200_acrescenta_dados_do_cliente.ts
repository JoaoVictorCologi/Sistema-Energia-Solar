import type { Knex } from 'knex';

// Endereço da instalação e contato, informados no pedido de proposta (todos opcionais).
// O endereço fica só aqui, nunca na simulação (LGPD).
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cliente', (tabela) => {
    tabela.string('logradouro', 150);
    tabela.string('numero', 20);
    tabela.string('complemento', 80);
    tabela.string('bairro', 80);
    tabela.enu('contato_preferido', ['whatsapp', 'telefone', 'email']);
    tabela.enu('melhor_horario', ['manha', 'tarde', 'noite']);
    tabela.boolean('autoriza_calibracao').notNullable().defaultTo(false);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cliente', (tabela) => {
    tabela.dropColumns('logradouro', 'numero', 'complemento', 'bairro', 'contato_preferido', 'melhor_horario', 'autoriza_calibracao');
  });
}
