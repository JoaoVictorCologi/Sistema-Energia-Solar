// ViaCEP: cidade, UF e código IBGE do CEP. Consulta na hora em que o visitante digita, por isso
// com timeout curto e no máximo 2 tentativas: melhor responder "tente de novo" do que deixar a tela parada.
import { z } from 'zod';
import { buscarJson, ErroDeIntegracao } from './http.ts';

const esquemaEndereco = z.object({
  localidade: z.string().min(1),
  uf: z.string().length(2),
  ibge: z.string().regex(/^\d{7}$/),
});

// CEP inexistente: o ViaCEP responde 200 com { erro: true } (ou "true").
const esquemaCepInexistente = z.object({ erro: z.union([z.literal(true), z.literal('true')]) });

export interface EnderecoDoCep {
  cidade: string;
  uf: string;
  codigoIbge: number;
}

export async function buscarEnderecoDoCep(cep: string): Promise<EnderecoDoCep | null> {
  const resposta = await buscarJson(`https://viacep.com.br/ws/${cep}/json/`, { timeoutMs: 5_000, tentativas: 2, esperaEntreTentativasMs: 300 });
  if (esquemaCepInexistente.safeParse(resposta).success) return null;
  const endereco = esquemaEndereco.safeParse(resposta);
  if (!endereco.success) throw new ErroDeIntegracao('O ViaCEP devolveu o endereço num formato inesperado.');
  return { cidade: endereco.data.localidade, uf: endereco.data.uf, codigoIbge: Number(endereco.data.ibge) };
}
