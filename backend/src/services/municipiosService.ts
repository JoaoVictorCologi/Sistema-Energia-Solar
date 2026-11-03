import { buscarMunicipiosDaUf } from '../integracoes/ibge.ts';
import { parametros } from '../parametros/parametros.ts';
import { salvarMunicipios } from '../repositories/municipiosRepository.ts';

// Carga única (script): os municípios da UF atendida, que é a do parametros.json.
export async function carregarMunicipios(): Promise<{ uf: string; quantidade: number }> {
  const { uf } = parametros;
  const municipios = await buscarMunicipiosDaUf(uf);
  await salvarMunicipios(municipios);
  return { uf, quantidade: municipios.length };
}
