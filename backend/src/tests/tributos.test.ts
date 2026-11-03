import { Decimal } from 'decimal.js';
import { describe, expect, it } from 'vitest';
import dados from '../parametros/tributos-por-uf.json' with { type: 'json' };
import { lerTributos, tributos, tributosDaUf } from '../parametros/tributos.ts';

function comAlteracao(alterar: (copia: typeof dados) => void): unknown {
  const copia = structuredClone(dados);
  alterar(copia);
  return copia;
}

describe('tributos-por-uf.json', () => {
  it('tem as 27 UFs, cada uma com a última faixa de ICMS sem limite', () => {
    expect(Object.keys(tributos.ufs)).toHaveLength(27);
    for (const uf of Object.values(tributos.ufs)) expect(uf.icmsFaixas.at(-1)?.ateKwh).toBeNull();
  });

  it('usa a faixa do consumo médio: SP 12% até 200 kWh e 18% acima', () => {
    expect(tributosDaUf('SP', new Decimal(200)).icms.toString()).toBe('0.12');
    expect(tributosDaUf('SP', new Decimal(201)).icms.toString()).toBe('0.18');
  });

  it('o ICMS muda com a UF; PIS e COFINS são a média nacional', () => {
    const maranhao = tributosDaUf('MA', new Decimal(300));
    expect(maranhao.icms.toString()).toBe('0.23');
    expect([maranhao.pis.toString(), maranhao.cofins.toString()]).toEqual(['0.01', '0.045']);
  });

  it('UF desconhecida é erro', () => {
    expect(() => tributosDaUf('XX', new Decimal(100))).toThrow(/UF sem tributos/);
  });

  it('recusa o arquivo sem uma das UFs', () => {
    expect(() => lerTributos(comAlteracao((copia) => { delete (copia.ufs as Record<string, unknown>).TO; }))).toThrow(/ufs\.TO/);
  });

  it('recusa impostos que somam 0,5 ou mais', () => {
    expect(() => lerTributos(comAlteracao((copia) => { copia.pisCofins.cofins = '0.40'; }))).toThrow(/ICMS \+ PIS \+ COFINS/);
  });

  it('exige uma última faixa de ICMS sem limite', () => {
    expect(() => lerTributos(comAlteracao((copia) => { copia.ufs.SP.icmsFaixas = [{ ateKwh: '200', aliquota: '0.12' }]; }))).toThrow(/ateKwh nulo/);
  });
});
