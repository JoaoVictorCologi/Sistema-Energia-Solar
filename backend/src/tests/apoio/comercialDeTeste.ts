// Os valores iniciais gravados pela migration de configuração comercial.
import { Decimal } from 'decimal.js';
import type { ConfiguracaoVigente, FormaDePagamento } from '../../repositories/configuracoesRepository.ts';

export const CONFIGURACAO_INICIAL: ConfiguracaoVigente = {
  margem: new Decimal('0.20'), instalacaoPorKwp: new Decimal(700), custoReferenciaPorKwp: new Decimal(4000), validadeDias: 10,
  limiteDesconto: new Decimal('0.10'), alteradoEm: new Date('2026-11-04T12:00:00Z'),
};

export const AVISTA: FormaDePagamento = {
  id: 1, tipo: 'avista', nome: 'À vista', taxaMensal: null, parcelasMinimas: 1, parcelasMaximas: 1, entradaMinima: new Decimal(0),
  carenciaMaximaDias: 0, descontoAvista: new Decimal('0.05'), ativa: true,
};

export const CARTAO: FormaDePagamento = {
  id: 2, tipo: 'parcelado', nome: 'Cartão de crédito', taxaMensal: new Decimal(0), parcelasMinimas: 1, parcelasMaximas: 12, entradaMinima: new Decimal(0),
  carenciaMaximaDias: 0, descontoAvista: new Decimal(0), ativa: true,
};

export const FINANCIAMENTO: FormaDePagamento = {
  id: 3, tipo: 'financiado', nome: 'Financiamento solar', taxaMensal: new Decimal('0.015'), parcelasMinimas: 12, parcelasMaximas: 120, entradaMinima: new Decimal('0.10'),
  carenciaMaximaDias: 120, descontoAvista: new Decimal(0), ativa: true,
};
