import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// O motor só tem funções puras; banco, rede e relógio ficam com os services.
const PASTA_DO_MOTOR = path.join(import.meta.dirname, '..', '..', 'motor');
const PROIBIDOS = [/from 'knex'/, /from 'express'/, /\bfetch\(/, /Date\.now\(/, /new Date\(\)/, /\/database\//, /\/repositories\//];

describe('motor só com funções puras', () => {
  const arquivos = readdirSync(PASTA_DO_MOTOR).filter((arquivo) => arquivo.endsWith('.ts'));

  it.each(arquivos)('%s não usa banco, rede nem o relógio', (arquivo) => {
    const codigo = readFileSync(path.join(PASTA_DO_MOTOR, arquivo), 'utf8');
    expect(PROIBIDOS.filter((proibido) => proibido.test(codigo))).toEqual([]);
  });
});
