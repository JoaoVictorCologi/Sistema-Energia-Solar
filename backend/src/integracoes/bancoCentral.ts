// SGS do Banco Central: uma série por chamada, sempre com data inicial e final
// (séries diárias recusam janelas de 10 anos ou mais com HTTP 406).
import { z } from 'zod';
import { deDataBrasileira, paraDataBrasileira } from '../utils/datas.ts';
import { buscarJson, ErroDeIntegracao } from './http.ts';

const URL_BASE = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs';

const esquemaResposta = z.array(z.object({
  data: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
  valor: z.string(),
}));

export interface ValorDaSerie {
  data: string;
  valor: string;
}

export async function buscarSerie(codigo: number, dataInicial: string, dataFinal: string): Promise<ValorDaSerie[]> {
  const url = `${URL_BASE}.${codigo}/dados?formato=json&dataInicial=${paraDataBrasileira(dataInicial)}&dataFinal=${paraDataBrasileira(dataFinal)}`;
  let resposta: unknown;
  try {
    resposta = await buscarJson(url);
  } catch (erro) {
    // O SGS responde 404 quando não há valor no período: não é falha, só não há novidade.
    if (erro instanceof ErroDeIntegracao && erro.status === 404) return [];
    throw erro;
  }
  const resultado = esquemaResposta.safeParse(resposta);
  if (!resultado.success) throw new ErroDeIntegracao(`O Banco Central devolveu a série ${codigo} num formato inesperado.`);
  return resultado.data.map(({ data, valor }) => ({ data: deDataBrasileira(data), valor }));
}
