import { buscarMunicipiosDoBrasil } from '../integracoes/ibge.ts';
import { salvarMunicipios } from '../repositories/municipiosRepository.ts';

// Carga única (script): todos os municípios do Brasil. Rodar de novo só atualiza nome e UF.
export async function carregarMunicipios(): Promise<{ quantidade: number; ufs: number }> {
  const municipios = await buscarMunicipiosDoBrasil();
  await salvarMunicipios(municipios);
  return { quantidade: municipios.length, ufs: new Set(municipios.map((municipio) => municipio.uf)).size };
}
