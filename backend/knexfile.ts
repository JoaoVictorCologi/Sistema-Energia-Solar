// Configuração do Knex: conexão e pastas de migrations, compartilhadas pela API e pelos scripts.
import path from 'node:path';
import type { Knex } from 'knex';
import { obterEnv } from './src/config/env.ts';

const configuracao: Knex.Config = {
  client: 'pg',
  connection: obterEnv().DATABASE_URL,
  migrations: {
    // O núcleo vem primeiro; cada módulo acrescenta aqui a pasta com as suas migrations.
    directory: [
      path.join(import.meta.dirname, 'migrations'),
    ],
    extension: 'ts',
    loadExtensions: ['.ts'],
  },
};

export default configuracao;
