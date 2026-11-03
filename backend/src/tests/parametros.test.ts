import { describe, expect, it } from 'vitest';
import dados from '../parametros/parametros.json' with { type: 'json' };
import { lerParametros, parametros } from '../parametros/parametros.ts';

function comAlteracao(alterar: (copia: typeof dados) => void): unknown {
  const copia = structuredClone(dados);
  alterar(copia);
  return copia;
}

describe('parametros.json', () => {
  it('carrega o arquivo do projeto com os valores como Decimal', () => {
    expect(parametros.uf).toBe('SP');
    expect(parametros.fioBPercentualPorAno['2026'].toString()).toBe('0.6');
    expect(parametros.consumoMinimoKwh.bifasico.toNumber()).toBe(50);
  });

  it('recusa valor fora da faixa, dizendo qual campo corrigir', () => {
    const invalido = comAlteracao((copia) => { copia.performanceRatio = '0.95'; });
    expect(() => lerParametros(invalido)).toThrow(/performanceRatio: precisa estar entre 0.70 e 0.85/);
  });

  it('recusa número sem aspas, que perderia precisão', () => {
    const invalido = comAlteracao((copia) => { (copia as Record<string, unknown>).custoReferenciaPorKwp = 4000; });
    expect(() => lerParametros(invalido)).toThrow(/custoReferenciaPorKwp/);
  });
});
