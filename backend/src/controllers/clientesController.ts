// Pedido de proposta feito pelo visitante a partir de uma simulação.
import type { Request, Response } from 'express';
import { z } from 'zod';
import { pedirProposta } from '../services/clientesService.ts';

// LGPD: sem o aceite do uso dos dados não há cadastro.
export const esquemaPedidoDeProposta = z.object({
  simulacao: z.uuid('Simulação inválida. Faça a simulação de novo.'),
  nome: z.string().trim().min(2, 'Informe o nome.').max(120, 'Nome longo demais.'),
  email: z.email('E-mail inválido.').max(254, 'E-mail longo demais.').transform((email) => email.toLowerCase()),
  telefone: z.string().max(30, 'Telefone inválido.')
    .transform((telefone) => telefone.replace(/\D/g, ''))
    .refine((telefone) => /^\d{10,11}$/.test(telefone), 'Informe o telefone com DDD.'),
  aceite: z.literal(true, { error: 'É preciso aceitar o uso dos dados para receber a proposta.' }),
  // Opcionais. O endereço fica só no cadastro do cliente, nunca na simulação.
  endereco: z.strictObject({
    logradouro: z.string().trim().min(2, 'Informe a rua.').max(150, 'Endereço longo demais.'),
    numero: z.string().trim().max(20, 'Número longo demais.').optional(),
    complemento: z.string().trim().max(80, 'Complemento longo demais.').optional(),
    bairro: z.string().trim().max(80, 'Bairro longo demais.').optional(),
  }).optional(),
  contatoPreferido: z.enum(['whatsapp', 'telefone', 'email']).optional(),
  melhorHorario: z.enum(['manha', 'tarde', 'noite']).optional(),
  // Consentimento separado do aceite da proposta (LGPD): sem ele, o pedido segue normal.
  autorizaUsoParaCalibracao: z.boolean().optional(),
});

// A resposta não devolve dados do cliente: só confirma o recebimento.
export async function criarPedidoDeProposta(requisicao: Request, resposta: Response): Promise<void> {
  const { simulacao, aceite: _aceiteJaConferido, ...dados } = requisicao.body as z.infer<typeof esquemaPedidoDeProposta>;
  await pedirProposta({ codigoDaSimulacao: simulacao, ...dados });
  resposta.status(201).json({ mensagem: 'Pedido recebido! Entraremos em contato para enviar a proposta.' });
}
