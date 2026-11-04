// Interfaces das tabelas do módulo, com o que o driver devolve: `numeric` e `date` chegam como texto.

export type StatusUsina = 'ativa' | 'desativada';
export type TipoEquipamentoDaUsina = 'modulo' | 'inversor';
export type TipoManutencao = 'limpeza' | 'corretiva';
export type TipoAlerta = 'limpeza' | 'garantia' | 'desempenho';
export type TipoGarantia = 'produto' | 'desempenho';
export type StatusAlerta = 'aberto' | 'resolvido';

export interface Usina {
  id: number;
  cliente_id: number;
  codigo_ibge: number;
  kwp: string;
  data_protocolo: string;
  data_conexao: string;
  intervalo_limpeza_meses: 6 | 12;
  status: StatusUsina;
  criado_em: Date;
  atualizado_em: Date;
}

export interface UsinaEquipamento {
  id: number;
  usina_id: number;
  tipo: TipoEquipamentoDaUsina;
  marca: string;
  modelo: string;
  numero_serie: string;
  quantidade: number;
  data_instalacao: string;
  garantia_produto_meses: number;
  garantia_desempenho_anos: number | null;
  criado_em: Date;
  atualizado_em: Date;
}

export interface UsinaManutencao {
  id: number;
  usina_id: number;
  tipo: TipoManutencao;
  data: string;
  descricao: string;
  criado_em: Date;
  atualizado_em: Date;
}

export interface UsinaAlerta {
  id: number;
  usina_id: number;
  usina_equipamento_id: number | null;
  tipo_garantia: TipoGarantia | null;
  tipo: TipoAlerta;
  descricao: string;
  status: StatusAlerta;
  ciclo: string;
  aberto_em: Date;
  resolvido_em: Date | null;
  resolucao: string | null;
  criado_em: Date;
  atualizado_em: Date;
}
