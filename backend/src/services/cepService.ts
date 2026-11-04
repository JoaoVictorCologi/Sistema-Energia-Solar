// CEP → município → distribuidoras que o cliente pode escolher, em qualquer lugar do Brasil.
import { buscarEnderecoDoCep } from '../integracoes/viaCep.ts';
import { ErroDeIntegracao } from '../integracoes/http.ts';
import { ErroHttp } from '../middlewares/erros.ts';
import { buscarCodigoIbgeDoCep, salvarCepNoCache } from '../repositories/cepRepository.ts';
import { listarDistribuidorasDaUf, listarDistribuidorasDoMunicipio } from '../repositories/distribuidorasRepository.ts';
import { buscarMunicipio, type MunicipioParaGravar } from '../repositories/municipiosRepository.ts';
import { listarCnpjsComTarifaDesde } from '../repositories/tarifasRepository.ts';
import { somarDias } from '../utils/datas.ts';

// Tarifa vencida há mais que isso deixa a distribuidora fora da escolha (ex.: incorporada, sem tarifa nova).
const DIAS_DE_TOLERANCIA_DA_TARIFA = 13 * 30;

export interface OpcaoDeDistribuidora {
  cnpj: string;
  sigla: string;
  // A de mais conjuntos no município; vem marcada na tela quando há mais de uma.
  sugerida: boolean;
}

export interface LocalDoCep {
  cep: string;
  cidade: string;
  uf: string;
  codigoIbge: number;
  // Uma só: escolha automática. Mais de uma: o cliente escolhe. Nenhuma: região não atendida.
  distribuidoras: OpcaoDeDistribuidora[];
  atendido: boolean;
}

// Município sem vínculo na ANEEL: o cliente escolhe entre as distribuidoras da UF.
async function opcoesDoMunicipio(municipio: MunicipioParaGravar, hoje: string): Promise<OpcaoDeDistribuidora[]> {
  const [doMunicipio, comTarifa] = await Promise.all([
    listarDistribuidorasDoMunicipio(municipio.codigoIbge), listarCnpjsComTarifaDesde(somarDias(hoje, -DIAS_DE_TOLERANCIA_DA_TARIFA)),
  ]);
  const ligadas = doMunicipio.filter((distribuidora) => comTarifa.has(distribuidora.cnpj));
  if (ligadas.length > 0) return ligadas.map(({ cnpj, sigla, sugerida }) => ({ cnpj, sigla, sugerida: ligadas.length > 1 && sugerida }));
  const daUf = (await listarDistribuidorasDaUf(municipio.uf)).filter((distribuidora) => comTarifa.has(distribuidora.cnpj));
  return daUf.map(({ cnpj, sigla }) => ({ cnpj, sigla, sugerida: false }));
}

// `conhecido`: o município está no banco (dá para simular).
async function buscarMunicipioDoCep(cep: string): Promise<{ municipio: MunicipioParaGravar; conhecido: boolean }> {
  const codigoEmCache = await buscarCodigoIbgeDoCep(cep);
  const emCache = codigoEmCache === undefined ? undefined : await buscarMunicipio(codigoEmCache);
  if (emCache) return { municipio: emCache, conhecido: true };

  let endereco;
  try {
    endereco = await buscarEnderecoDoCep(cep);
  } catch (erro) {
    if (erro instanceof ErroDeIntegracao) throw new ErroHttp(503, 'CEP_INDISPONIVEL', 'Não foi possível consultar o CEP agora. Tente de novo em instantes.');
    throw erro;
  }
  if (!endereco) throw new ErroHttp(404, 'CEP_NAO_ENCONTRADO', 'CEP não encontrado. Confira os números.');
  const municipio = await buscarMunicipio(endereco.codigoIbge);
  // Município fora do banco (lista do IBGE desatualizada): responde, mas não guarda no cache nem simula.
  if (!municipio) return { municipio: { codigoIbge: endereco.codigoIbge, nome: endereco.cidade, uf: endereco.uf }, conhecido: false };
  await salvarCepNoCache(cep, endereco.codigoIbge);
  return { municipio, conhecido: true };
}

export async function consultarCep(cep: string, hoje: string): Promise<LocalDoCep> {
  const { municipio, conhecido } = await buscarMunicipioDoCep(cep);
  const distribuidoras = conhecido ? await opcoesDoMunicipio(municipio, hoje) : [];
  return { cep, cidade: municipio.nome, uf: municipio.uf, codigoIbge: municipio.codigoIbge, distribuidoras, atendido: distribuidoras.length > 0 };
}
