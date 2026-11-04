// Uma interface por tabela do núcleo, com os tipos que o driver pg devolve.
// Colunas numeric chegam como texto (`string`): o repository converte para Decimal antes de devolver.
// Colunas date chegam como texto 'AAAA-MM-DD', por configuração da conexão.

export type Papel = 'admin' | 'gestor' | 'operador';

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  senha_hash: string;
  papel: Papel;
  ativo: boolean;
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
  cnpj: string;
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

export type ContatoPreferido = 'whatsapp' | 'telefone' | 'email';
export type MelhorHorario = 'manha' | 'tarde' | 'noite';

export interface Cliente {
  id: number;
  nome: string;
  email: string;
  telefone: string;
  cep: string;
  aceite_em: Date;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  contato_preferido: ContatoPreferido | null;
  melhor_horario: MelhorHorario | null;
  autoriza_calibracao: boolean;
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

export type TipoDeEquipamento = 'modulo' | 'inversor';

export interface Equipamento {
  id: number;
  tipo: TipoDeEquipamento;
  fabricante: string;
  modelo: string;
  potencia_w: string;
  degradacao_anual: string | null;
  preco: string;
  ativo: boolean;
  criado_em: Date;
  atualizado_em: Date;
}

export type StatusDaProposta = 'rascunho' | 'enviada' | 'aceita' | 'recusada';

export interface Proposta {
  id: number;
  cliente_id: number;
  simulacao_id: number;
  status: StatusDaProposta;
  investimento: string;
  valida_ate: string;
  snapshot: unknown;
  versao: number;
  proposta_raiz_id: number | null;
  observacoes: string | null;
  escolhas: unknown;
  criada_por: number | null;
  criado_em: Date;
  atualizado_em: Date;
}

export interface MunicipioDistribuidora {
  id: number;
  codigo_ibge: number;
  distribuidora_id: number;
  conjuntos: number;
  sugerida: boolean;
  importacao_id: number | null;
  criado_em: Date;
  atualizado_em: Date;
}

export interface ConfiguracaoComercial {
  id: number;
  margem: string;
  instalacao_por_kwp: string;
  custo_referencia_por_kwp: string;
  validade_dias: number;
  limite_desconto: string;
  alterado_por: number | null;
  criado_em: Date;
  atualizado_em: Date;
}

export type TipoDePagamento = 'avista' | 'parcelado' | 'financiado';

export interface FormaPagamento {
  id: number;
  tipo: TipoDePagamento;
  nome: string;
  taxa_mensal: string | null;
  parcelas_minimas: number;
  parcelas_maximas: number;
  entrada_minima: string;
  carencia_maxima_dias: number;
  desconto_avista: string;
  ativa: boolean;
  alterado_por: number | null;
  criado_em: Date;
  atualizado_em: Date;
}

export type TipoDeAjuste = 'desconto' | 'acrescimo';
export type ModoDoAjuste = 'valor' | 'percentual';

export interface PropostaAjuste {
  id: number;
  proposta_id: number;
  tipo: TipoDeAjuste;
  descricao: string;
  modo: ModoDoAjuste;
  valor: string;
  justificativa: string | null;
  criado_por: number | null;
  criado_em: Date;
  atualizado_em: Date;
}

export interface PropostaCondicao {
  id: number;
  proposta_id: number;
  forma_pagamento_id: number;
  nome: string;
  tipo: TipoDePagamento;
  taxa_mensal: string;
  desconto_avista: string;
  entrada_minima: string;
  entrada: string | null;
  parcelas: number;
  carencia_dias: number;
  criado_por: number | null;
  criado_em: Date;
  atualizado_em: Date;
}

export interface PropostaEvento {
  id: number;
  proposta_id: number;
  usuario_id: number | null;
  tipo: string;
  descricao: string;
  justificativa: string | null;
  criado_em: Date;
  atualizado_em: Date;
}
