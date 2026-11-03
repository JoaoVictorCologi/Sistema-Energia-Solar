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
});

// A resposta não devolve dados do cliente: só confirma o recebimento.
export async function criarPedidoDeProposta(requisicao: Request, resposta: Response): Promise<void> {
  const { simulacao, nome, email, telefone } = requisicao.body as z.infer<typeof esquemaPedidoDeProposta>;
  await pedirProposta({ codigoDaSimulacao: simulacao, nome, email, telefone });
  resposta.status(201).json({ mensagem: 'Pedido recebido! Entraremos em contato para enviar a proposta.' });
}
