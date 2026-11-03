import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { conferirAmbiente } from '../services/demonstracaoAmbiente.ts';

const SCRIPT = path.join(import.meta.dirname, '..', '..', 'scripts', 'dados-demo.ts');

describe('npm run dados-demo', () => {
  it('em produção, recusa sem --confirmar', () => {
    expect(conferirAmbiente('production', [])).toMatch(/--confirmar/);
    expect(conferirAmbiente('production', ['--confirmar'])).toBeNull();
    expect(conferirAmbiente('development', [])).toBeNull();
  });

  it('o script sai com erro antes de tocar no banco quando NODE_ENV=production', () => {
    const execucao = spawnSync(process.execPath, [SCRIPT], { env: { ...process.env, NODE_ENV: 'production' }, encoding: 'utf8' });

    expect(execucao.status).toBe(1);
    expect(execucao.stderr).toContain('Recusado: NODE_ENV=production');
  });
});
