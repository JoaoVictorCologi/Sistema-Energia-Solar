import knex from 'knex';
import configuracao from '../../knexfile.ts';

// Instância única do Knex: todos os repositories importam daqui.
export const db = knex(configuracao);
