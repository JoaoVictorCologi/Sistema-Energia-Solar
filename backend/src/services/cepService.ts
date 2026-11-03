import { buscarEnderecoDoCep } from '../integracoes/viaCep.ts';
import { ErroDeIntegracao } from '../integracoes/http.ts';
import { ErroHttp } from '../middlewares/erros.ts';
import { parametros } from '../parametros/parametros.ts';
import { buscarCodigoIbgeDoCep, salvarCepNoCache } from '../repositories/cepRepository.ts';
import { buscarMunicipio } from '../repositories/municipiosRepository.ts';

export interface LocalDoCep {
  cep: string;
  cidade: string;
  uf: string;
  codigoIbge: number;
  // Só a UF do parametros.json é atendida, e só se o município estiver carregado.
  atendido: boolean;
}

// O cache guarda só CEPs da região atendida (a chave estrangeira exige o município no banco).
export async function consultarCep(cep: string): Promise<LocalDoCep> {
  const codigoEmCache = await buscarCodigoIbgeDoCep(cep);
  const municipioEmCache = codigoEmCache === undefined ? undefined : await buscarMunicipio(codigoEmCache);
  if (municipioEmCache) return { cep, cidade: municipioEmCache.nome, uf: municipioEmCache.uf, codigoIbge: municipioEmCache.codigoIbge, atendido: true };

  let endereco;
  try {
    endereco = await buscarEnderecoDoCep(cep);
  } catch (erro) {
    if (erro instanceof ErroDeIntegracao) throw new ErroHttp(503, 'CEP_INDISPONIVEL', 'Não foi possível consultar o CEP agora. Tente de novo em instantes.');
    throw erro;
  }
  if (!endereco) throw new ErroHttp(404, 'CEP_NAO_ENCONTRADO', 'CEP não encontrado. Confira os números.');

  const atendido = endereco.uf === parametros.uf && (await buscarMunicipio(endereco.codigoIbge)) !== undefined;
  if (atendido) await salvarCepNoCache(cep, endereco.codigoIbge);
  return { cep, ...endereco, atendido };
}
