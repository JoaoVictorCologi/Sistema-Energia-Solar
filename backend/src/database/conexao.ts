import knex from 'knex';
import pg from 'pg';
import configuracao from '../../knexfile.ts';

// Colunas `date` (vigência de tarifa, data de indicador) chegam como texto 'AAAA-MM-DD'.
// Sem isso, o driver cria um Date à meia-noite do fuso local, e a data pode voltar um dia ao virar UTC.
const TIPO_DATE = 1082;
pg.types.setTypeParser(TIPO_DATE, (valor) => valor);

// Instância única do Knex: todos os repositories importam daqui.
export const db = knex(configuracao);
