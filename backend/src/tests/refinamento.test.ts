import { Decimal } from 'decimal.js';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarApp } from '../app.ts';
import { buscarCodigoIbgeDoCep } from '../repositories/cepRepository.ts';
import { buscarConfiguracaoComercial, listarFormasDePagamento } from '../repositories/configuracoesRepository.ts';
import { listarDistribuidorasDoMunicipio } from '../repositories/distribuidorasRepository.ts';
import { buscarUltimoIndicador } from '../repositories/indicadoresRepository.ts';
import { buscarIrradiacaoDoMunicipio } from '../repositories/irradiacaoRepository.ts';
import { buscarMunicipio } from '../repositories/municipiosRepository.ts';
import { inserirSimulacao } from '../repositories/simulacoesRepository.ts';
import { buscarTarifaVigente, listarCnpjsComTarifaDesde } from '../repositories/tarifasRepository.ts';
import {
  aliquotaDaConta, coberturaDoPedido, consumoDoPedido, estimarParcela, fatorDoTelhado, modulosNaArea, regimeDoPedido, simultaneidadeDoPedido,
} from '../services/refinamento.ts';
import { AVISTA, CARTAO, CONFIGURACAO_INICIAL, FINANCIAMENTO } from './apoio/comercialDeTeste.ts';

vi.mock('../repositories/cepRepository.ts', () => ({ buscarCodigoIbgeDoCep: vi.fn(), salvarCepNoCache: vi.fn() }));
vi.mock('../repositories/configuracoesRepository.ts', () => ({ buscarConfiguracaoComercial: vi.fn(), listarFormasDePagamento: vi.fn() }));
vi.mock('../repositories/municipiosRepository.ts', () => ({ buscarMunicipio: vi.fn() }));
vi.mock('../repositories/distribuidorasRepository.ts', () => ({ listarDistribuidorasDoMunicipio: vi.fn(), listarDistribuidorasDaUf: vi.fn() }));
vi.mock('../repositories/tarifasRepository.ts', () => ({ buscarTarifaVigente: vi.fn(), buscarUltimaTarifaComFioB: vi.fn(), listarCnpjsComTarifaDesde: vi.fn() }));
vi.mock('../repositories/irradiacaoRepository.ts', () => ({ buscarIrradiacaoDoMunicipio: vi.fn() }));
vi.mock('../repositories/indicadoresRepository.ts', () => ({ buscarUltimoIndicador: vi.fn() }));
vi.mock('../repositories/simulacoesRepository.ts', () => ({ inserirSimulacao: vi.fn() }));

// Mococa-SP no Atlas, tarifa B1 da CPFL Santa Cruz: a tarifa com impostos dá R$ 1,062196/kWh.
const SANTA_CRUZ = { id: 1, cnpj: '53859112000169', sigla: 'CPFL Santa Cruz', conjuntos: 1, sugerida: true };
const HSP_MOCOCA = ['5.099', '5.569', '5.31', '5.47', '5', '4.881', '5.072', '5.76', '5.326', '5.407', '5.252', '5.251'];
const TARIFA_B1 = {
  id: 41, subgrupo: 'B1', modalidade: 'Convencional', classe: 'Residencial', subclasse: 'Residencial',
  te: new Decimal('0.25219'), tusd: new Decimal('0.56039'), fioB: new Decimal('0.272853'), inicioVigencia: '2026-04-22', fimVigencia: '2027-04-21',
};
const PEDIDO = { cep: '13730-250', tipoLigacao: 'monofasico', consumoMedioKwh: 400 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
  vi.mocked(buscarCodigoIbgeDoCep).mockResolvedValue(3530508);
  vi.mocked(buscarMunicipio).mockResolvedValue({ codigoIbge: 3530508, nome: 'Mococa', uf: 'SP' });
  vi.mocked(listarDistribuidorasDoMunicipio).mockResolvedValue([SANTA_CRUZ]);
  vi.mocked(listarCnpjsComTarifaDesde).mockResolvedValue(new Set([SANTA_CRUZ.cnpj]));
  vi.mocked(buscarTarifaVigente).mockResolvedValue(TARIFA_B1);
  vi.mocked(buscarIrradiacaoDoMunicipio).mockResolvedValue({ id: 7, hspAnual: new Decimal('5.283'), hspMensal: HSP_MOCOCA.map((hsp) => new Decimal(hsp)) });
  vi.mocked(buscarUltimoIndicador).mockImplementation(async (serie) => ({ data: '2026-09-01', valor: new Decimal(serie === 432 ? '13.75' : '4.58') }));
  vi.mocked(inserirSimulacao).mockResolvedValue('a1f811c5-cd03-45d1-b9aa-f107b9eefb47');
  vi.mocked(buscarConfiguracaoComercial).mockResolvedValue(CONFIGURACAO_INICIAL);
  vi.mocked(listarFormasDePagamento).mockResolvedValue([]);
});
afterEach(() => vi.unstubAllGlobals());

const enviar = (corpo: object) => request(criarApp()).post('/api/simulacoes').send(corpo);
const simular = async (extra: object = {}) => {
  const resposta = await enviar({ ...PEDIDO, ...extra });
  expect(resposta.status).toBe(201);
  return resposta.body.simulacao;
};
const codigosDosAlertas = (simulacao: { alertas: { codigo: string }[] }) => simulacao.alertas.map((alerta) => alerta.codigo);
const semCodigo = ({ codigo: _codigo, ...simulacao }: Record<string, unknown>) => simulacao;

describe('sem responder nada', () => {
  it('o pedido antigo dá o mesmo resultado de sempre, tudo marcado como estimado', async () => {
    const simulacao = await simular();

    expect(simulacao.dimensionamento).toEqual({ numeroModulos: 6, potenciaModuloW: 550, kwpInstalado: 3.3, inversorKw: 3 });
    expect(simulacao.investimentoEstimado.valor).toBe(13200);
    expect(simulacao.premissas).toMatchObject({ simultaneidade: 0.3, performanceRatio: 0.78, tarifaComImpostos: 1.062196, regime: 'GD_II', telhado: { fator: 1 } });
    expect(simulacao.premissas.origem).toEqual({ performanceRatio: 'estimado', simultaneidade: 'estimado', tributos: 'estimado', telhado: 'estimado', consumoMensal: 'estimado' });
    expect(simulacao.parcelaEstimada).toBeNull();
  });

  it('respostas vazias não mudam o cálculo', async () => {
    expect(semCodigo(await simular({ telhado: {} }))).toEqual(semCodigo(await simular()));
  });
});

describe('entradas inválidas', () => {
  it.each([
    ['conta com valor zero', { conta: { valorReais: 0, consumoKwh: 300 } }, 'conta.valorReais'],
    ['conta sem consumo', { conta: { valorReais: 300 } }, 'conta.consumoKwh'],
    ['iluminação maior que a conta', { conta: { valorReais: 100, consumoKwh: 100, iluminacaoPublicaReais: 150 } }, 'conta.iluminacaoPublicaReais'],
    ['histórico de 11 meses', { consumoMensalKwh: Array(11).fill(400) }, 'consumoMensalKwh'],
    ['mês acima do limite', { consumoMensalKwh: [...Array(11).fill(400), 50_000] }, 'consumoMensalKwh.11'],
    ['histórico zerado', { consumoMensalKwh: Array(12).fill(0) }, 'consumoMensalKwh'],
    ['perfil desconhecido', { perfilDeConsumo: 'madrugada' }, 'perfilDeConsumo'],
    ['orientação desconhecida', { telhado: { orientacao: 'cima' } }, 'telhado.orientacao'],
    ['horas de sol desconhecidas', { telhado: { horasDeSol: 'muitas' } }, 'telhado.horasDeSol'],
    ['área zerada', { telhado: { areaM2: 0 } }, 'telhado.areaM2'],
    ['irradiação enviada pelo cliente', { telhado: { hsp: 6 } }, 'hsp'],
    ['protocolo em data inválida', { solarExistente: { protocoloEm: '07/01/2023' } }, 'solarExistente.protocoloEm'],
    ['protocolo no futuro', { solarExistente: { protocoloEm: '2999-01-01' } }, 'solarExistente.protocoloEm'],
    ['aumento negativo', { aumentoPrevistoKwh: -10 }, 'aumentoPrevistoKwh'],
    ['pagamento desconhecido', { pagamentoPreferido: 'fiado' }, 'pagamentoPreferido'],
    ['PR enviado no body', { performanceRatio: 0.9 }, 'performanceRatio'],
  ])('%s → 400, sem gravar', async (_caso, extra, campo) => {
    const resposta = await enviar({ ...PEDIDO, ...extra });

    expect(resposta.status).toBe(400);
    expect(Object.keys(resposta.body.error.fields)).toContain(campo);
    expect(inserirSimulacao).not.toHaveBeenCalled();
  });

  it('sem consumo médio nem histórico → 400', async () => {
    const resposta = await enviar({ cep: PEDIDO.cep, tipoLigacao: PEDIDO.tipoLigacao });

    expect(resposta.status).toBe(400);
    expect(Object.keys(resposta.body.error.fields)).toContain('consumoMedioKwh');
  });
});

describe('conta de luz', () => {
  it('a conta real reproduz a tarifa efetiva, descontando a iluminação pública', async () => {
    // R$ 340 de conta, com R$ 20 de iluminação, em 300 kWh: R$ 1,0667/kWh.
    const simulacao = await simular({ conta: { valorReais: 340, consumoKwh: 300, iluminacaoPublicaReais: 20 } });

    expect(simulacao.premissas.tarifaComImpostos).toBeCloseTo(320 / 300, 3);
    expect(simulacao.premissas.origem.tributos).toBe('informado');
    expect(codigosDosAlertas(simulacao)).not.toContain('CONTA_FORA_DO_ESPERADO');
  });

  it.each([
    ['muito acima da tarifa', { valorReais: 900, consumoKwh: 300 }],
    ['muito abaixo da tarifa', { valorReais: 60, consumoKwh: 300 }],
    ['iluminação que consome a conta inteira', { valorReais: 20, consumoKwh: 300, iluminacaoPublicaReais: 19 }],
  ])('conta absurda (%s): usa o imposto do estado e avisa', async (_caso, conta) => {
    const simulacao = await simular({ conta });

    expect(simulacao.premissas.tarifaComImpostos).toBe(1.062196);
    expect(simulacao.premissas.origem.tributos).toBe('estimado');
    expect(codigosDosAlertas(simulacao)).toContain('CONTA_FORA_DO_ESPERADO');
  });
});

describe('consumo', () => {
  it('12 meses iguais dão o mesmo resultado da média', async () => {
    const pelaMedia = await simular();
    const peloHistorico = await enviar({ cep: PEDIDO.cep, tipoLigacao: PEDIDO.tipoLigacao, consumoMensalKwh: Array(12).fill(400) });

    expect(peloHistorico.body.simulacao.dimensionamento).toEqual(pelaMedia.dimensionamento);
    expect(peloHistorico.body.simulacao.indicadores).toEqual(pelaMedia.indicadores);
    expect(peloHistorico.body.simulacao.premissas.origem.consumoMensal).toBe('informado');
  });

  it('o histórico segue o mês a mês e a média vem dele', async () => {
    const meses = [600, 600, 500, 400, 300, 300, 300, 300, 400, 400, 500, 600];

    const { body: { simulacao } } = await enviar({ cep: PEDIDO.cep, tipoLigacao: PEDIDO.tipoLigacao, consumoMensalKwh: meses });

    // Soma de 5.200 kWh ÷ 12; a tela recebe com uma casa.
    expect(simulacao.pedido.consumoMedioKwh).toBe(433.3);
    expect(simulacao.primeiroAno.map((mes: { mes: number; consumoKwh: number }) => mes.consumoKwh)).toEqual(simulacao.primeiroAno.map((mes: { mes: number }) => meses[mes.mes - 1]));
  });

  it('quem consome mais de dia economiza mais que quem consome à noite', async () => {
    const noite = await simular({ perfilDeConsumo: 'noite' });
    const dia = await simular({ perfilDeConsumo: 'dia' });

    expect(noite.premissas.simultaneidade).toBe(0.2);
    expect(dia.premissas.simultaneidade).toBe(0.45);
    expect(dia.indicadores.economiaPrimeiroAno).toBeGreaterThan(noite.indicadores.economiaPrimeiroAno);
    expect(dia.premissas.origem.simultaneidade).toBe('informado');
  });

  it('com o perfil informado, o aviso de calibração fala só do aproveitamento', async () => {
    const simulacao = await simular({ perfilDeConsumo: 'dia' });

    expect(simulacao.alertas).toContainEqual({
      codigo: 'PREMISSAS_NAO_CALIBRADAS', mensagem: 'Aproveitamento do sistema é um valor típico, ainda não calibrado com contas reais: o resultado é uma estimativa.',
    });
  });

  it('aumento pequeno soma ao consumo e aumenta o sistema, sem aviso', async () => {
    const simulacao = await simular({ aumentoPrevistoKwh: 60 });

    expect(simulacao.dimensionamento.numeroModulos).toBe(7);
    expect(simulacao.primeiroAno[0].consumoKwh).toBe(460);
    expect(codigosDosAlertas(simulacao)).not.toContain('AMPLIACAO_LIMITADA');
  });

  it('aumento grande limita o sistema a 120% do consumo atual e avisa', async () => {
    const simulacao = await simular({ aumentoPrevistoKwh: 400 });

    // Sem o limite, 800 kWh pediriam 12 módulos; com ele, cobre 480 kWh.
    expect(simulacao.dimensionamento.numeroModulos).toBeLessThan(9);
    expect(simulacao.coberturaAlcancada).toBeLessThan(0.7);
    expect(codigosDosAlertas(simulacao)).toContain('AMPLIACAO_LIMITADA');
  });
});

describe('telhado', () => {
  it('voltado ao sul pede mais módulos, custa mais e demora mais a pagar', async () => {
    const norte = await simular({ telhado: { orientacao: 'norte' } });
    const sul = await simular({ telhado: { orientacao: 'sul' } });

    expect(sul.premissas.telhado.fator).toBe(0.72);
    expect(sul.premissas.hspMedio).toBeLessThan(norte.premissas.hspMedio);
    expect(sul.dimensionamento.numeroModulos).toBeGreaterThan(norte.dimensionamento.numeroModulos);
    expect(sul.investimentoEstimado.valor).toBeGreaterThan(norte.investimentoEstimado.valor);
    expect(sul.indicadores.paybackSimplesAnos).toBeGreaterThan(norte.indicadores.paybackSimplesAnos);
    expect(sul.premissas.origem.telhado).toBe('informado');
  });

  it('área pequena limita os módulos, a geração cai e o resultado avisa', async () => {
    const livre = await simular();
    const limitado = await simular({ telhado: { areaM2: 6 } });

    expect(limitado.dimensionamento.numeroModulos).toBe(2);
    expect(limitado.coberturaAlcancada).toBeLessThan(livre.coberturaAlcancada);
    expect(codigosDosAlertas(limitado)).toContain('AREA_INSUFICIENTE');
  });

  it('menos de 4 horas de sol recomenda visita técnica', async () => {
    const simulacao = await simular({ telhado: { horasDeSol: 'menosDe4' } });

    expect(codigosDosAlertas(simulacao)).toContain('VISITA_TECNICA_RECOMENDADA');
    expect(simulacao.premissas.telhado.fator).toBe(0.65);
  });
});

describe('quem já tem solar', () => {
  it('protocolo até 07/01/2023 fica em GD I, sem Fio B; a partir de 08/01/2023, GD II', async () => {
    const antes = await simular({ solarExistente: { protocoloEm: '2023-01-07' } });
    const depois = await simular({ solarExistente: { protocoloEm: '2023-01-08' } });

    expect(antes.premissas.regime).toBe('GD_I');
    expect(depois.premissas.regime).toBe('GD_II');
    expect(antes.indicadores.economiaPrimeiroAno).toBeGreaterThan(depois.indicadores.economiaPrimeiroAno);
  });
});

describe('parcela estimada', () => {
  it('mostra a forma preferida entre as ativas, pelo investimento estimado', async () => {
    vi.mocked(listarFormasDePagamento).mockResolvedValue([AVISTA, CARTAO, FINANCIAMENTO]);

    const simulacao = await simular({ pagamentoPreferido: 'avista' });

    expect(listarFormasDePagamento).toHaveBeenCalledWith(true);
    expect(simulacao.parcelaEstimada).toEqual({ forma: 'À vista', tipo: 'avista', parcelas: 1, entrada: 0, taxaMensal: 0, valorParcela: 12540 });
  });

  it('sem preferência, usa o financiamento como referência', async () => {
    vi.mocked(listarFormasDePagamento).mockResolvedValue([AVISTA, FINANCIAMENTO]);

    const { parcelaEstimada } = await simular();

    expect(parcelaEstimada).toMatchObject({ forma: 'Financiamento solar', tipo: 'financiado', parcelas: 120, entrada: 1320, taxaMensal: 0.015 });
    expect(parcelaEstimada.valorParcela).toBeGreaterThan(0);
  });

  it('forma preferida desativada: fica sem parcela', async () => {
    vi.mocked(listarFormasDePagamento).mockResolvedValue([AVISTA]);

    expect((await simular({ pagamentoPreferido: 'financiado' })).parcelaEstimada).toBeNull();
  });
});

describe('respostas gravadas', () => {
  it('ficam na entrada da simulação, para o operador ver depois', async () => {
    await simular({ perfilDeConsumo: 'noite', telhado: { orientacao: 'leste', tipo: 'ceramica' } });

    const { entrada } = vi.mocked(inserirSimulacao).mock.calls[0][0] as { entrada: { pedido: Record<string, unknown> } };
    expect(entrada.pedido).toMatchObject({ perfilDeConsumo: 'noite', telhado: { orientacao: 'leste', tipo: 'ceramica' } });
  });
});

describe('regras do refinamento', () => {
  it('fator do telhado multiplica orientação, inclinação e sombra', () => {
    expect(fatorDoTelhado(undefined).toString()).toBe('1');
    expect(fatorDoTelhado({ orientacao: 'sul', inclinacao: 'muita', horasDeSol: 'de4a6' }).toString()).toBe(new Decimal('0.72').times('0.95').times('0.80').toString());
  });

  it('área: 2,8 m² por módulo, arredondando para baixo e com pelo menos um', () => {
    expect(modulosNaArea(undefined)).toBeUndefined();
    expect(modulosNaArea(new Decimal(28))).toBe(10);
    expect(modulosNaArea(new Decimal('5.5'))).toBe(1);
    expect(modulosNaArea(new Decimal(1))).toBe(1);
  });

  it('simultaneidade por subgrupo e perfil', () => {
    expect(simultaneidadeDoPedido('B1', undefined).toString()).toBe('0.3');
    expect(simultaneidadeDoPedido('B3', undefined).toString()).toBe('0.4');
    expect(simultaneidadeDoPedido('B3', 'dia').toString()).toBe('0.55');
  });

  it('regime: sem sistema instalado, GD II', () => {
    expect(regimeDoPedido(undefined)).toBe('GD_II');
    expect(regimeDoPedido({ protocoloEm: '2020-05-01' })).toBe('GD_I');
  });

  it('consumo com aumento soma a cada mês; cobertura cai só quando passa do limite', () => {
    const consumo = consumoDoPedido(new Decimal(400), { aumentoPrevistoKwh: new Decimal(50) });
    expect(consumo).toHaveLength(12);
    expect(consumo[0].toNumber()).toBe(450);

    const padrao = new Decimal(1);
    expect(coberturaDoPedido(padrao, new Decimal(400), {}).toNumber()).toBe(1);
    expect(coberturaDoPedido(padrao, new Decimal(400), { aumentoPrevistoKwh: new Decimal(50) }).toNumber()).toBe(1);
    expect(coberturaDoPedido(padrao, new Decimal(400), { aumentoPrevistoKwh: new Decimal(400) }).toNumber()).toBe(0.6);
  });

  it('alíquota da conta: 1 − tarifa sem impostos ÷ tarifa efetiva, dentro das faixas', () => {
    const conta = { valorReais: new Decimal(100), consumoKwh: new Decimal(100) };
    expect(aliquotaDaConta(conta, new Decimal('0.8'), new Decimal(1))?.toNumber()).toBe(0.2);
    expect(aliquotaDaConta(undefined, new Decimal('0.8'), new Decimal(1))).toBeNull();
    // Alíquota implícita de 5%: abaixo do mínimo.
    expect(aliquotaDaConta(conta, new Decimal('0.95'), new Decimal(1))).toBeNull();
  });

  it('parcela de referência: a de menor taxa entre as do tipo', () => {
    const maisCara = { ...FINANCIAMENTO, id: 9, nome: 'Banco caro', taxaMensal: new Decimal('0.03') };

    expect(estimarParcela(new Decimal(10000), 'financiado', [maisCara, FINANCIAMENTO])?.forma).toBe('Financiamento solar');
  });
});
