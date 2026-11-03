// Uma interface por tabela do núcleo, com os tipos que o driver pg devolve.
// Colunas numeric chegam como texto (`string`): o repository converte para Decimal antes de devolver.
// Colunas date chegam como texto 'AAAA-MM-DD' (ver database/conexao.ts).

export type Papel = 'admin' | 'usuario';

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  senha_hash: string;
  papel: Papel;
  criado_em: Date;
  atualizado_em: Date;
}

export interface Municipio {
  id: number;
  codigo_ibge: number;
  nome: string;
  uf: string;
  criado_em: Date;
  atualizado_em: Date;
}

export interface Distribuidora {
  id: number;
  sigla: string;
  cnpj: string | null;
  nome: string;
  criado_em: Date;
  atualizado_em: Date;
}

export type StatusDaImportacao = 'executando' | 'sucesso' | 'sem_alteracao' | 'erro';

export interface Importacao {
  id: number;
  tipo: string;
  status: StatusDaImportacao;
  iniciada_em: Date;
  finalizada_em: Date | null;
  versao_da_fonte: string | null;
  linhas_gravadas: number;
  mensagem: string | null;
  criado_em: Date;
  atualizado_em: Date;
}

export interface Tarifa {
  id: number;
  distribuidora_id: number;
  subgrupo: string;
  modalidade: string;
  classe: string;
  subclasse: string;
  te_rs_kwh: string;
  tusd_rs_kwh: string;
  fio_b_rs_kwh: string | null;
  inicio_vigencia: string;
  fim_vigencia: string | null;
  importacao_id: number | null;
  criado_em: Date;
  atualizado_em: Date;
}

export interface IrradiacaoMunicipio {
  id: number;
  codigo_ibge: number;
  hsp_anual: string;
  hsp_jan: string;
  hsp_fev: string;
  hsp_mar: string;
  hsp_abr: string;
  hsp_mai: string;
  hsp_jun: string;
  hsp_jul: string;
  hsp_ago: string;
  hsp_set: string;
  hsp_out: string;
  hsp_nov: string;
  hsp_dez: string;
  criado_em: Date;
  atualizado_em: Date;
}

export interface IndicadorEconomico {
  id: number;
  serie: number;
  data: string;
  valor: string;
  importacao_id: number | null;
  criado_em: Date;
  atualizado_em: Date;
}

export interface CepCache {
  id: number;
  cep: string;
  codigo_ibge: number;
  criado_em: Date;
  atualizado_em: Date;
}

export interface Cliente {
  id: number;
  nome: string;
  email: string;
  telefone: string;
  cep: string;
  aceite_em: Date;
  criado_em: Date;
  atualizado_em: Date;
}

export interface Simulacao {
  id: number;
  codigo: string;
  cep: string;
  codigo_ibge: number;
  tarifa_id: number;
  irradiacao_id: number;
  versao_parametros: string;
  cliente_id: number | null;
  entrada: unknown;
  resultado: unknown;
  criado_em: Date;
  atualizado_em: Date;
}
