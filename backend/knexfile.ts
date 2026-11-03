import path from 'node:path';
import type { Knex } from 'knex';
import { obterEnv } from './src/config/env.ts';

const configuracao: Knex.Config = {
  client: 'pg',
  connection: obterEnv().DATABASE_URL,
  migrations: {
    // Pastas de migrations: o núcleo primeiro; cada módulo (Plano 2 em diante) acrescenta uma linha com a sua.
    directory: [
      path.join(import.meta.dirname, 'migrations'),
      path.join(import.meta.dirname, 'src', 'modulos', 'usinas', 'migrations'),
    ],
    extension: 'ts',
    loadExtensions: ['.ts'],
  },
};

export default configuracao;
