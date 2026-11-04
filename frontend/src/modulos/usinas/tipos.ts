// Tipos das telas de usinas: o que a API devolve e o que ela recebe.
import type { Pagina, TipoDeEquipamento } from '../../services/api.ts';

// Formatos do contrato em docs/arquitetura/backend.md.

export type RegimeDaUsina = 'GD_I' | 'GD_II';
export type StatusDaUsina = 'ativa' | 'desativada';
export type IntervaloDeLimpeza = 6 | 12;

export interface MunicipioDaUsina {
  codigoIbge: number;
  nome: string;
  uf: string;
}

// Parte comum à lista e ao detalhe, que diferem na forma do cliente e nos equipamentos.
interface DadosDaUsina {
  id: number;
  municipio: MunicipioDaUsina;
  kwp: number;
  regime: RegimeDaUsina;
  dataProtocolo: string;
  dataConexao: string;
  intervaloLimpezaMeses: IntervaloDeLimpeza;
  status: StatusDaUsina;
}

export interface UsinaDaLista extends DadosDaUsina {
  clienteId: number;
  clienteNome: string;
}

export type PaginaDeUsinas = Pagina & { usinas: UsinaDaLista[] };

// O nome "Equipamento" já é do catálogo em services/api.ts, com outro formato.
export interface EquipamentoDaUsina {
  id: number;
  tipo: TipoDeEquipamento;
  marca: string;
  modelo: string;
  numeroSerie: string;
  quantidade: number;
  dataInstalacao: string;
  garantiaProdutoMeses: number;
  garantiaDesempenhoAnos: number | null;
  vencimentoGarantiaProduto: string;
  vencimentoGarantiaDesempenho: string | null;
}

export interface ClienteDaUsina {
  id: number;
  nome: string;
}

export interface UsinaDetalhada extends DadosDaUsina {
  cliente: ClienteDaUsina;
  equipamentos: EquipamentoDaUsina[];
}

// Campo limpo vai como null ou texto vazio, nunca omitido: omitido, o PATCH manteria o valor antigo e a tela pareceria salva.
export interface CorpoDaUsina {
  clienteId: number | null;
  codigoIbge: number | null;
  kwp: number | null;
  dataProtocolo: string;
  dataConexao: string;
  intervaloLimpezaMeses: IntervaloDeLimpeza | null;
}

// Aqui o campo pode faltar: no POST a API recusa null na garantia de desempenho, e no PATCH o null limpa o valor.
export interface CorpoDoEquipamento {
  tipo: TipoDeEquipamento;
  marca: string;
  modelo: string;
  numeroSerie: string;
  dataInstalacao: string;
  garantiaProdutoMeses: number | null;
  garantiaDesempenhoAnos?: number | null;
}
