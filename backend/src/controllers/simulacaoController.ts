// Consulta de CEP e simulação pública.
import type { Request, Response } from 'express';
import { Decimal } from 'decimal.js';
import { z } from 'zod';
import { ErroHttp } from '../middlewares/erros.ts';
import { consultarCep } from '../services/cepService.ts';
import { simularEconomia } from '../services/simulacaoService.ts';
import { hojeEmSaoPaulo } from '../utils/datas.ts';

const cep = z.string().regex(/^\d{5}-?\d{3}$/, 'Informe o CEP com 8 números.').transform((valor) => valor.replace('-', ''));

const numeroDecimal = (minimo: number, maximo: number, mensagem: string) =>
  z.number().min(minimo, mensagem).max(maximo, mensagem).transform((valor) => new Decimal(String(valor)));

// Perguntas opcionais do formulário: resposta ausente significa "não sei" e usa o valor típico.
const telhado = z.strictObject({
  horasDeSol: z.enum(['diaTodo', 'de6a8', 'de4a6', 'menosDe4']).optional(),
  orientacao: z.enum(['norte', 'nordeste', 'noroeste', 'leste', 'oeste', 'sudeste', 'sudoeste', 'sul', 'plano']).optional(),
  inclinacao: z.enum(['plano', 'pouca', 'media', 'muita']).optional(),
  tipo: z.enum(['ceramica', 'metalico', 'fibrocimento', 'laje', 'solo']).optional(),
  areaM2: numeroDecimal(1, 10_000, 'Informe a área entre 1 e 10.000 m².').optional(),
});

const conta = z.strictObject({
  valorReais: numeroDecimal(1, 1_000_000, 'Informe o valor da conta em reais.'),
  consumoKwh: numeroDecimal(1, 100_000, 'Informe o consumo da conta em kWh.'),
  iluminacaoPublicaReais: numeroDecimal(0, 10_000, 'Informe a iluminação pública em reais.').optional(),
});

// Só dados do visitante: tarifa, preço e premissas vêm do backend, nunca do corpo da requisição.
export const esquemaSimulacao = z.object({
  cep,
  tipoLigacao: z.enum(['monofasico', 'bifasico', 'trifasico']),
  subgrupo: z.enum(['B1', 'B2', 'B3']).default('B1'),
  // Obrigatório sem o histórico; com os 12 meses, vale a média deles.
  consumoMedioKwh: z.number().min(1, 'Informe um consumo de pelo menos 1 kWh.').max(20_000, 'O simulador aceita até 20.000 kWh por mês.').optional(),
  // CNPJ de uma das distribuidoras de GET /api/cep/:cep; obrigatório quando há mais de uma.
  distribuidora: z.string().regex(/^\d{14}$/, 'Escolha uma das distribuidoras do município.').optional(),
  conta: conta.optional(),
  consumoMensalKwh: z.array(numeroDecimal(0, 20_000, 'Cada mês precisa ficar entre 0 e 20.000 kWh.')).length(12, 'Informe os 12 meses.').optional(),
  perfilDeConsumo: z.enum(['noite', 'equilibrado', 'dia']).optional(),
  telhado: telhado.optional(),
  solarExistente: z.strictObject({ protocoloEm: z.iso.date('Informe a data do pedido de ligação.') }).optional(),
  aumentoPrevistoKwh: numeroDecimal(0, 5_000, 'Informe um aumento de 0 a 5.000 kWh por mês.').optional(),
  pagamentoPreferido: z.enum(['avista', 'parcelado', 'financiado']).optional(),
}).refine(({ consumoMedioKwh, consumoMensalKwh }) => consumoMedioKwh !== undefined || consumoMensalKwh !== undefined, {
  message: 'Informe o consumo médio ou os 12 meses.', path: ['consumoMedioKwh'],
}).refine(({ consumoMensalKwh }) => !consumoMensalKwh || Decimal.sum(...consumoMensalKwh).gte(12), {
  message: 'A média dos 12 meses precisa ser de pelo menos 1 kWh.', path: ['consumoMensalKwh'],
}).refine(({ conta: dados }) => !dados?.iluminacaoPublicaReais || dados.iluminacaoPublicaReais.lt(dados.valorReais), {
  message: 'A iluminação pública não pode passar do valor da conta.', path: ['conta', 'iluminacaoPublicaReais'],
}).refine(({ solarExistente }) => !solarExistente || solarExistente.protocoloEm <= hojeEmSaoPaulo(new Date()), {
  message: 'A data não pode estar no futuro.', path: ['solarExistente', 'protocoloEm'],
});

export async function obterCep(requisicao: Request, resposta: Response): Promise<void> {
  const parametros = z.object({ cep }).safeParse(requisicao.params);
  if (!parametros.success) throw new ErroHttp(400, 'ENTRADA_INVALIDA', 'Dados inválidos. Confira os campos.', { cep: 'Informe o CEP com 8 números.' });
  const local = await consultarCep(parametros.data.cep, hojeEmSaoPaulo(new Date()));
  // Mais de uma distribuidora: a tela pede a escolha, com a sugerida marcada.
  resposta.json({
    cep: local.cep, cidade: local.cidade, uf: local.uf, atendido: local.atendido,
    distribuidoras: local.distribuidoras, escolhaNecessaria: local.distribuidoras.length > 1,
  });
}

export async function criarSimulacao(requisicao: Request, resposta: Response): Promise<void> {
  const corpo = requisicao.body as z.infer<typeof esquemaSimulacao>;
  const consumoMedioKwh = corpo.consumoMensalKwh ? Decimal.sum(...corpo.consumoMensalKwh).div(12) : new Decimal(String(corpo.consumoMedioKwh));
  resposta.status(201).json({ simulacao: await simularEconomia({ ...corpo, consumoMedioKwh }) });
}
