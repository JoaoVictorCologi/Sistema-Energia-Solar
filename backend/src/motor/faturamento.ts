// Seções 4 a 6 da especificação: autoconsumo, compensação (GD I e GD II), créditos e faturas do mês.
import { Decimal } from 'decimal.js';
import { kwh, reais, type Fracao, type Kwh, type Reais, type ReaisPorKwh } from './tipos.ts';

// GD I: protocolo até 07/01/2023, sem Fio B até 2045. GD II: regra de transição da Lei 14.300.
export type RegimeGd = 'GD_I' | 'GD_II';

// Créditos são lotes por mês de origem, usados do mais antigo para o mais novo.
export interface LoteDeCredito {
  // Índice do mês na simulação (0 = primeiro mês).
  mesDeOrigem: number;
  energia: Kwh;
}

export interface EntradaDeCompensacao {
  mes: number;
  consumoDaRede: Kwh;
  injecao: Kwh;
  consumoMinimo: Kwh;
  tarifaCheia: ReaisPorKwh;
  cobrancaFioB: ReaisPorKwh;
  regime: RegimeGd;
  validadeDosCreditosMeses: number;
}

export interface ResultadoDaCompensacao {
  energiaCompensada: Kwh;
  creditosNoFimDoMes: Kwh;
  creditosVencidos: Kwh;
  faturaComSolar: Reais;
  parcelaFioB: Reais;
  creditos: LoteDeCredito[];
}

export interface EntradaMes extends Omit<EntradaDeCompensacao, 'consumoDaRede' | 'injecao'> {
  consumo: Kwh;
  geracao: Kwh;
  simultaneidade: Fracao;
}

export interface ResultadoMes {
  geracao: Kwh;
  autoconsumo: Kwh;
  injecao: Kwh;
  consumoDaRede: Kwh;
  energiaCompensada: Kwh;
  creditosNoFimDoMes: Kwh;
  creditosVencidos: Kwh;
  faturaSemSolar: Reais;
  faturaComSolar: Reais;
  parcelaFioB: Reais;
  economia: Reais;
}

const ZERO = new Decimal(0);

function separarVencidos(lotes: LoteDeCredito[], mes: number, validade: number): { validos: LoteDeCredito[]; vencidos: Kwh } {
  const validos = lotes.filter((lote) => mes - lote.mesDeOrigem <= validade);
  const vencidos = lotes.filter((lote) => mes - lote.mesDeOrigem > validade);
  return { validos, vencidos: kwh(Decimal.sum(ZERO, ...vencidos.map((lote) => lote.energia))) };
}

// GD II (art. 16 e 27): abaixo do consumo mínimo não compensa nada. GD I: compensa só o que passa do mínimo.
function energiaACompensar(entrada: EntradaDeCompensacao, disponivel: Decimal): Kwh {
  const { consumoDaRede, consumoMinimo } = entrada;
  if (entrada.regime === 'GD_I') return kwh(Decimal.min(disponivel, Decimal.max(0, consumoDaRede.minus(consumoMinimo))));
  return kwh(consumoDaRede.gte(consumoMinimo) ? Decimal.min(disponivel, consumoDaRede) : ZERO);
}

// A injeção do próprio mês compensa primeiro; a sobra vira lote novo. Depois, os lotes do mais antigo ao mais novo.
function consumirCreditos(lotes: LoteDeCredito[], injecao: Kwh, compensada: Kwh, mes: number): LoteDeCredito[] {
  let falta = compensada.minus(Decimal.min(injecao, compensada));
  const restantes: LoteDeCredito[] = [];
  for (const lote of [...lotes].sort((a, b) => a.mesDeOrigem - b.mesDeOrigem)) {
    // Lote que não é tocado neste mês segue igual, sem conta (são até 60 lotes por mês, por 300 meses).
    if (falta.isZero()) {
      restantes.push(lote);
      continue;
    }
    const usado = Decimal.min(lote.energia, falta);
    falta = falta.minus(usado);
    if (lote.energia.gt(usado)) restantes.push({ mesDeOrigem: lote.mesDeOrigem, energia: kwh(lote.energia.minus(usado)) });
  }
  const sobraDaInjecao = injecao.minus(Decimal.min(injecao, compensada));
  if (sobraDaInjecao.gt(0)) restantes.push({ mesDeOrigem: mes, energia: kwh(sobraDaInjecao) });
  return restantes;
}

function faturar(entrada: EntradaDeCompensacao, compensada: Kwh): { faturaComSolar: Reais; parcelaFioB: Reais } {
  const { consumoDaRede, consumoMinimo, tarifaCheia } = entrada;
  if (entrada.regime === 'GD_I') {
    return { faturaComSolar: reais(Decimal.max(consumoDaRede.minus(compensada), consumoMinimo).times(tarifaCheia)), parcelaFioB: reais(ZERO) };
  }
  if (consumoDaRede.lt(consumoMinimo)) return { faturaComSolar: reais(consumoMinimo.times(tarifaCheia)), parcelaFioB: reais(ZERO) };
  const parcelaFioB = reais(compensada.times(entrada.cobrancaFioB));
  return { faturaComSolar: reais(consumoDaRede.minus(compensada).times(tarifaCheia).plus(parcelaFioB)), parcelaFioB };
}

// A partir do consumo da rede e da injeção medidos (é o que a conta de luz mostra).
export function compensarMes(entrada: EntradaDeCompensacao, creditosAnteriores: LoteDeCredito[]): ResultadoDaCompensacao {
  const { validos, vencidos } = separarVencidos(creditosAnteriores, entrada.mes, entrada.validadeDosCreditosMeses);
  const disponivel = entrada.injecao.plus(Decimal.sum(ZERO, ...validos.map((lote) => lote.energia)));
  const energiaCompensada = energiaACompensar(entrada, disponivel);
  return {
    energiaCompensada,
    creditosNoFimDoMes: kwh(disponivel.minus(energiaCompensada)),
    creditosVencidos: vencidos,
    ...faturar(entrada, energiaCompensada),
    creditos: consumirCreditos(validos, entrada.injecao, energiaCompensada, entrada.mes),
  };
}

// A partir do consumo e da geração: a simultaneidade separa o que é consumido na hora (nem passa pelo medidor).
export function faturarMes(entrada: EntradaMes, creditosAnteriores: LoteDeCredito[]): { resultado: ResultadoMes; creditos: LoteDeCredito[] } {
  const autoconsumo = kwh(Decimal.min(entrada.simultaneidade.times(entrada.geracao), entrada.consumo));
  const injecao = kwh(entrada.geracao.minus(autoconsumo));
  const consumoDaRede = kwh(entrada.consumo.minus(autoconsumo));
  const compensacao = compensarMes({ ...entrada, consumoDaRede, injecao }, creditosAnteriores);
  // A iluminação pública fica fora das duas faturas: é igual com e sem solar.
  const faturaSemSolar = reais(Decimal.max(entrada.consumo, entrada.consumoMinimo).times(entrada.tarifaCheia));
  return {
    resultado: {
      geracao: entrada.geracao,
      autoconsumo,
      injecao,
      consumoDaRede,
      energiaCompensada: compensacao.energiaCompensada,
      creditosNoFimDoMes: compensacao.creditosNoFimDoMes,
      creditosVencidos: compensacao.creditosVencidos,
      faturaSemSolar,
      faturaComSolar: compensacao.faturaComSolar,
      parcelaFioB: compensacao.parcelaFioB,
      economia: reais(faturaSemSolar.minus(compensacao.faturaComSolar)),
    },
    creditos: compensacao.creditos,
  };
}
