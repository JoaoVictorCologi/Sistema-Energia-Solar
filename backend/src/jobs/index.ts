import { jobsDosModulos } from '../modulos/index.ts';
import { importarDistribuidorasDosMunicipios, TIPO_DISTRIBUIDORAS_ANEEL } from '../services/distribuidorasService.ts';
import { importarIndicadores, TIPO_INDICADORES_BCB } from '../services/indicadoresService.ts';
import { importarTarifasDaAneel, TIPO_TARIFAS_ANEEL } from '../services/tarifasAneelService.ts';
import type { JobDeImportacao } from './tipos.ts';

// 06:00 em São Paulo, uma depois da outra (o agendador roda na ordem desta lista).
const jobsDoNucleo: JobDeImportacao[] = [
  { tipo: TIPO_TARIFAS_ANEEL, descricao: 'Tarifas (TE, TUSD) e Fio B da ANEEL', agenda: '0 6 * * *', executar: importarTarifasDaAneel },
  { tipo: TIPO_INDICADORES_BCB, descricao: 'IPCA e Selic do Banco Central', agenda: '0 6 * * *', executar: importarIndicadores },
  // Semanal (domingo, 05:00): a área de cada distribuidora quase não muda.
  { tipo: TIPO_DISTRIBUIDORAS_ANEEL, descricao: 'Distribuidora de cada município (ANEEL)', agenda: '0 5 * * 0', executar: importarDistribuidorasDosMunicipios },
];

export function listarJobs(): JobDeImportacao[] {
  return [...jobsDoNucleo, ...jobsDosModulos];
}
