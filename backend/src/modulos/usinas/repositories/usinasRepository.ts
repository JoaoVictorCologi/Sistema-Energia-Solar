// Usinas e equipamentos do módulo. Cliente e município só são lidos aqui: o módulo não grava em tabelas do núcleo.
import { Decimal } from 'decimal.js';
import type { Knex } from 'knex';
import { db } from '../../../database/conexao.ts';
import type { Municipio } from '../../../tipos/tabelas.ts';
import type { StatusUsina, TipoEquipamentoDaUsina, Usina, UsinaEquipamento } from '../tipos.ts';

// Formatos que o repository troca com o service, em camelCase e com kWp em Decimal.
export interface MunicipioDaUsina {
  codigoIbge: number;
  nome: string;
  uf: string;
}

export interface UsinaDoBanco {
  id: number;
  clienteId: number;
  clienteNome: string;
  municipio: MunicipioDaUsina;
  kwp: Decimal;
  dataProtocolo: string;
  dataConexao: string;
  intervaloLimpezaMeses: 6 | 12;
  status: StatusUsina;
}

export interface DadosDaUsina {
  clienteId: number;
  codigoIbge: number;
  kwp: Decimal;
  dataProtocolo: string;
  dataConexao: string;
  intervaloLimpezaMeses: 6 | 12;
}

// O que o service precisa da usina travada: saber que existe e as datas atuais, para conferir o PATCH.
export interface UsinaTravada {
  id: number;
  dataProtocolo: string;
  dataConexao: string;
}

export interface FiltroDeUsinas {
  status: StatusUsina;
  busca?: string;
  pagina: number;
  porPagina: number;
}

export interface EquipamentoDaUsina {
  id: number;
  tipo: TipoEquipamentoDaUsina;
  marca: string;
  modelo: string;
  numeroSerie: string;
  quantidade: number;
  dataInstalacao: string;
  garantiaProdutoMeses: number;
  garantiaDesempenhoAnos: number | null;
}

export type DadosDoEquipamento = Omit<EquipamentoDaUsina, 'id'>;
// Sem quantidade: ela não muda depois do cadastro.
export type MudancaDoEquipamento = Partial<Omit<DadosDoEquipamento, 'quantidade'>>;

// Gravação recusada por chave estrangeira; o service transforma este resultado em erro de campo.
export type CampoDeReferencia = 'clienteId' | 'codigoIbge';
export interface ReferenciaInexistente {
  campoInexistente: CampoDeReferencia;
}

// Linha da consulta com cliente e município, antes da conversão.
type LinhaDaUsina = Pick<Usina, 'id' | 'cliente_id' | 'codigo_ibge' | 'kwp' | 'data_protocolo' | 'data_conexao' | 'intervalo_limpeza_meses' | 'status'> & {
  cliente_nome: string;
  municipio_nome: string;
  municipio_uf: string;
};

// Colunas sempre explícitas: do cliente, só o nome vai para a resposta.
const COLUNAS_DA_USINA = [
  'usina.id', 'usina.cliente_id', 'usina.codigo_ibge', 'usina.kwp', 'usina.data_protocolo', 'usina.data_conexao', 'usina.intervalo_limpeza_meses',
  'usina.status', 'cliente.nome as cliente_nome', 'municipio.nome as municipio_nome', 'municipio.uf as municipio_uf',
];
const COLUNAS_DO_EQUIPAMENTO = [
  'id', 'tipo', 'marca', 'modelo', 'numero_serie', 'quantidade', 'data_instalacao', 'garantia_produto_meses', 'garantia_desempenho_anos',
] as const;
// A busca devolve uma lista curta, sem paginação: quem não achar refina o texto.
const MAXIMO_DE_MUNICIPIOS = 20;
// Violação de chave estrangeira no PostgreSQL.
const CODIGO_DE_CHAVE_ESTRANGEIRA = '23503';
// Nome de cada restrição no banco e o campo do pedido que a violou.
const CAMPO_DA_CHAVE: Record<string, CampoDeReferencia> = {
  usina_cliente_id_foreign: 'clienteId',
  usina_codigo_ibge_foreign: 'codigoIbge',
};

// numeric chega do driver como texto; o resto do código só vê Decimal.
function comoUsina(linha: LinhaDaUsina): UsinaDoBanco {
  return {
    id: linha.id, clienteId: linha.cliente_id, clienteNome: linha.cliente_nome,
    municipio: { codigoIbge: linha.codigo_ibge, nome: linha.municipio_nome, uf: linha.municipio_uf },
    kwp: new Decimal(linha.kwp), dataProtocolo: linha.data_protocolo, dataConexao: linha.data_conexao,
    intervaloLimpezaMeses: linha.intervalo_limpeza_meses, status: linha.status,
  };
}

// Da linha do banco para os nomes usados no resto do módulo.
function comoEquipamento(linha: Pick<UsinaEquipamento, (typeof COLUNAS_DO_EQUIPAMENTO)[number]>): EquipamentoDaUsina {
  return {
    id: linha.id, tipo: linha.tipo, marca: linha.marca, modelo: linha.modelo, numeroSerie: linha.numero_serie, quantidade: linha.quantidade,
    dataInstalacao: linha.data_instalacao, garantiaProdutoMeses: linha.garantia_produto_meses, garantiaDesempenhoAnos: linha.garantia_desempenho_anos,
  };
}

// Coluna por coluna: nada que chegue no pedido além destes campos vai para o banco. O Knex ignora o que está undefined.
function comoColunasDaUsina(dados: Partial<DadosDaUsina>) {
  return {
    cliente_id: dados.clienteId, codigo_ibge: dados.codigoIbge, kwp: dados.kwp?.toString(), data_protocolo: dados.dataProtocolo,
    data_conexao: dados.dataConexao, intervalo_limpeza_meses: dados.intervaloLimpezaMeses,
  };
}

// Sem quantidade, que só é gravada no cadastro. Na garantia de desempenho, null limpa o valor e undefined não o altera.
function comoColunasDoEquipamento(dados: MudancaDoEquipamento) {
  return {
    tipo: dados.tipo, marca: dados.marca, modelo: dados.modelo, numero_serie: dados.numeroSerie, data_instalacao: dados.dataInstalacao,
    garantia_produto_meses: dados.garantiaProdutoMeses, garantia_desempenho_anos: dados.garantiaDesempenhoAnos,
  };
}

// % e _ digitados na busca valem como texto, não como curinga do LIKE.
function comoTrechoDoLike(texto: string): string {
  return `%${texto.replace(/[\\%_]/g, (caractere) => `\\${caractere}`)}%`;
}

// Usado na lista e na contagem, para o total bater com as linhas filtradas. A busca olha nome e e-mail do cliente.
function filtrarUsinas(consulta: Knex.QueryBuilder, { status, busca }: FiltroDeUsinas): void {
  consulta.where('usina.status', status);
  if (!busca) return;
  const trecho = comoTrechoDoLike(busca);
  consulta.where((condicao) => condicao.whereILike('cliente.nome', trecho).orWhereILike('cliente.email', trecho));
}

// Base da contagem, que filtra pelo cliente e não precisa do município.
function usinasComCliente(): Knex.QueryBuilder {
  return db('usina').join('cliente', 'cliente.id', 'usina.cliente_id');
}

// Base das leituras, com os dados que a resposta da API mostra.
function usinasComClienteEMunicipio(): Knex.QueryBuilder {
  return usinasComCliente().join('municipio', 'municipio.codigo_ibge', 'usina.codigo_ibge').select(COLUNAS_DA_USINA);
}

// O id desempata usinas criadas no mesmo instante: sem ele, a paginação poderia repetir ou pular linhas.
export async function listarUsinas(filtro: FiltroDeUsinas): Promise<{ usinas: UsinaDoBanco[]; total: number }> {
  const [linhas, contagem] = await Promise.all([
    usinasComClienteEMunicipio()
      .modify(filtrarUsinas, filtro)
      .orderBy('usina.criado_em', 'desc')
      .orderBy('usina.id', 'desc')
      .limit(filtro.porPagina)
      .offset((filtro.pagina - 1) * filtro.porPagina),
    usinasComCliente().modify(filtrarUsinas, filtro).count<{ total: string }[]>({ total: '*' }),
  ]);
  return { usinas: (linhas as LinhaDaUsina[]).map(comoUsina), total: Number(contagem[0].total) };
}

// Sem filtro de status: o detalhe também atende usina desativada.
export async function buscarUsinaPorId(id: number): Promise<UsinaDoBanco | undefined> {
  const linha = await usinasComClienteEMunicipio().where('usina.id', id).first() as LinhaDaUsina | undefined;
  return linha && comoUsina(linha);
}

// ILIKE ignora maiúsculas, mas distingue acentos: "sao" não encontra "São".
export async function buscarMunicipiosPorNome({ busca, uf }: { busca: string; uf?: string }): Promise<MunicipioDaUsina[]> {
  const consulta = db<Municipio>('municipio')
    .select('codigo_ibge', 'nome', 'uf')
    .whereILike('nome', comoTrechoDoLike(busca))
    .orderBy([{ column: 'nome' }, { column: 'uf' }])
    .limit(MAXIMO_DE_MUNICIPIOS);
  if (uf) consulta.where({ uf });
  return (await consulta).map((linha) => ({ codigoIbge: linha.codigo_ibge, nome: linha.nome, uf: linha.uf }));
}

// A conferência no service roda antes de gravar; se o cliente ou o município sumir nesse meio-tempo, o banco recusa e o pedido recebe o mesmo erro.
function comoReferenciaInexistente(erro: unknown): ReferenciaInexistente {
  const { code, constraint } = erro as { code?: string; constraint?: string };
  const campo = code === CODIGO_DE_CHAVE_ESTRANGEIRA && constraint ? CAMPO_DA_CHAVE[constraint] : undefined;
  if (!campo) throw erro;
  return { campoInexistente: campo };
}

// Chave estrangeira violada volta como valor; os demais erros seguem como exceção.
export async function inserirUsina(dados: DadosDaUsina): Promise<number | ReferenciaInexistente> {
  try {
    const [{ id }] = await db<Usina>('usina').insert(comoColunasDaUsina(dados)).returning('id');
    return id;
  } catch (erro) {
    return comoReferenciaInexistente(erro);
  }
}

// Mesmo tratamento do cadastro, dentro da transação que mantém a usina travada.
export async function atualizarUsina(transacao: Knex.Transaction, id: number, mudanca: Partial<DadosDaUsina>): Promise<ReferenciaInexistente | undefined> {
  try {
    await transacao<Usina>('usina').where({ id }).update({ ...comoColunasDaUsina(mudanca), atualizado_em: new Date() });
    return undefined;
  } catch (erro) {
    return comoReferenciaInexistente(erro);
  }
}

// Só a usina ainda ativa muda: desativar de novo não altera nada, nem atualizado_em.
export async function marcarUsinaComoDesativada(id: number): Promise<void> {
  await db<Usina>('usina').where({ id, status: 'ativa' }).update({ status: 'desativada', atualizado_em: new Date() });
}

// Transação com a linha da usina travada: serializa as gravações da mesma usina, o que permite conferir
// a série repetida sem índice único no banco e combinar o PATCH com os valores atuais sem corrida.
export async function comUsinaTravada<Resultado>(
  id: number,
  acao: (usina: UsinaTravada | undefined, transacao: Knex.Transaction) => Promise<Resultado>,
): Promise<Resultado> {
  return db.transaction(async (transacao) => {
    const linha = await transacao<Usina>('usina').select('id', 'data_protocolo', 'data_conexao').where({ id }).forUpdate().first();
    return acao(linha && { id: linha.id, dataProtocolo: linha.data_protocolo, dataConexao: linha.data_conexao }, transacao);
  });
}

// Por id: o detalhe mantém a ordem de cadastro, e o novo entra no fim.
export async function listarEquipamentosDaUsina(usinaId: number): Promise<EquipamentoDaUsina[]> {
  const linhas = await db<UsinaEquipamento>('usina_equipamento').select(...COLUNAS_DO_EQUIPAMENTO).where({ usina_id: usinaId }).orderBy('id');
  return linhas.map(comoEquipamento);
}

// O filtro por usina impede alcançar equipamento de outra usina pelo id.
export async function buscarEquipamentoDaUsina(transacao: Knex.Transaction, usinaId: number, id: number): Promise<EquipamentoDaUsina | undefined> {
  const linha = await transacao<UsinaEquipamento>('usina_equipamento').select(...COLUNAS_DO_EQUIPAMENTO).where({ id, usina_id: usinaId }).first();
  return linha && comoEquipamento(linha);
}

// Comparação exata, só dentro da usina. No PATCH, o próprio equipamento é ignorado, para poder manter a série.
export async function existeSerieNaUsina(transacao: Knex.Transaction, usinaId: number, numeroSerie: string, equipamentoIgnorado?: number): Promise<boolean> {
  const consulta = transacao<UsinaEquipamento>('usina_equipamento').select('id').where({ usina_id: usinaId, numero_serie: numeroSerie });
  if (equipamentoIgnorado !== undefined) consulta.whereNot({ id: equipamentoIgnorado });
  return (await consulta.first()) !== undefined;
}

// Recebe a transação para gravar sob a mesma trava da conferência da série.
export async function inserirEquipamentoDaUsina(transacao: Knex.Transaction, usinaId: number, dados: DadosDoEquipamento): Promise<EquipamentoDaUsina> {
  const [linha] = await transacao<UsinaEquipamento>('usina_equipamento')
    .insert({ ...comoColunasDoEquipamento(dados), usina_id: usinaId, quantidade: dados.quantidade })
    .returning([...COLUNAS_DO_EQUIPAMENTO]);
  return comoEquipamento(linha);
}

// O service já confirmou, na mesma transação, que o equipamento existe: a linha sempre volta.
export async function atualizarEquipamentoDaUsina(transacao: Knex.Transaction, usinaId: number, id: number, mudanca: MudancaDoEquipamento): Promise<EquipamentoDaUsina> {
  const [linha] = await transacao<UsinaEquipamento>('usina_equipamento')
    .where({ id, usina_id: usinaId })
    .update({ ...comoColunasDoEquipamento(mudanca), atualizado_em: new Date() })
    .returning([...COLUNAS_DO_EQUIPAMENTO]);
  return comoEquipamento(linha);
}
