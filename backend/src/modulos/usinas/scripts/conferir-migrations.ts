// Confere as migrations do módulo no banco de teste. Dentro de backend/:
//   node --env-file=.env.teste-migracoes src/modulos/usinas/scripts/conferir-migrations.ts integridade
//   node --env-file=.env.teste-migracoes src/modulos/usinas/scripts/conferir-migrations.ts reversao
// Exceções autorizadas pelo usuário, só nesta ferramenta: usa o Knex fora de repositories; e o modo integridade
// cria um cliente e um município próprios em tabelas do núcleo, em transação sempre desfeita.
import { readdirSync } from 'node:fs';
import path from 'node:path';
import type { Knex } from 'knex';
import { ErroDeConfiguracao, lerEnv } from '../../../config/env.ts';

try {
  lerEnv(process.env);
} catch (erro) {
  if (!(erro instanceof ErroDeConfiguracao)) throw erro;
  console.error(erro.message);
  process.exit(1);
}

const { db } = await import('../../../database/conexao.ts');

const BANCO_PERMITIDO = 'solar_gestao_teste';
const TABELAS_DO_MODULO = ['usina', 'usina_equipamento', 'usina_manutencao', 'usina_alerta'];
const MIGRATIONS_DO_MODULO = [
  '20261103221605_cria_usina.ts',
  '20261103221607_cria_usina_equipamento.ts',
  '20261103221608_cria_usina_manutencao.ts',
  '20261103221610_cria_usina_alerta.ts',
];
const MIGRATIONS_INVERTIDAS = [...MIGRATIONS_DO_MODULO].reverse();

// Código fora do padrão do IBGE (a UF 99 não existe), para nunca coincidir com um município real.
const IBGE_DO_TESTE = 9999999;
const IBGE_INEXISTENTE = 9999998;
const EMAIL_DO_TESTE = 'conferir-migrations@exemplo.invalid';
// Ids de cliente são positivos: -1 nunca existe.
const CLIENTE_INEXISTENTE = -1;
// Datas neutras: o teste verifica a estrutura e não define regra de ciclo.
const CICLO_A = '2000-01-01';
const CICLO_B = '2000-02-01';

class ErroDeConferencia extends Error {}

let falhas = 0;

function registrar(nome: string, passou: boolean, detalhe = ''): void {
  if (!passou) falhas += 1;
  console.log(`${passou ? 'OK   ' : 'FALHA'} ${nome}${detalhe ? ` -> ${detalhe}` : ''}`);
}

// Só o código e a restrição: mensagens de conexão podem citar servidor e usuário.
function descreverErro(erro: unknown): string {
  if (erro instanceof ErroDeConferencia) return erro.message;
  const { code, constraint, name } = erro as { code?: string; constraint?: string; name?: string };
  return [code ?? name ?? 'erro', constraint].filter(Boolean).join(' ');
}

async function exigirBancoDeTeste(): Promise<void> {
  const { rows } = await db.raw<{ rows: { banco: string }[] }>('SELECT current_database() AS banco');
  const banco = rows[0]?.banco;
  if (banco !== BANCO_PERMITIDO) throw new ErroDeConferencia(`Banco "${banco}" recusado: só roda em ${BANCO_PERMITIDO}. Nada foi alterado.`);
  console.log(`banco: ${banco}`);
}

async function contarLinhas(tabela: string): Promise<number> {
  const linha = await db(tabela).count('* as total').first();
  return Number(linha?.total);
}

// ---------- Modo integridade ----------

type Operacao<T> = (ponto: Knex.Transaction) => Promise<T>;
type Dados = Record<string, unknown>;

// Cada caso roda em um savepoint, para uma recusa não abortar a transação inteira.
async function esperarAceite<T>(transacao: Knex.Transaction, nome: string, operacao: Operacao<T>): Promise<T> {
  try {
    const resultado = await transacao.transaction(operacao);
    registrar(nome, true, 'aceito');
    return resultado;
  } catch (erro) {
    registrar(nome, false, `recusado: ${descreverErro(erro)}`);
    throw new ErroDeConferencia('Os casos seguintes dependem deste; conferência interrompida.');
  }
}

async function esperarRecusa(transacao: Knex.Transaction, nome: string, restricaoEsperada: string, operacao: Operacao<unknown>): Promise<void> {
  try {
    await transacao.transaction(async (ponto) => {
      await operacao(ponto);
      // Desfaz o savepoint: um caso que passou indevidamente não pode afetar os seguintes.
      throw new ErroDeConferencia('aceito pelo banco');
    });
  } catch (erro) {
    if (erro instanceof ErroDeConferencia) {
      registrar(nome, false, erro.message);
      return;
    }
    const { code, constraint } = erro as { code?: string; constraint?: string };
    registrar(nome, (constraint ?? code) === restricaoEsperada, `recusado: ${descreverErro(erro)}`);
  }
}

function inserir(tabela: string, dados: Dados): Operacao<number> {
  return async (ponto) => {
    const [linha] = await ponto(tabela).insert(dados).returning('id');
    return linha.id as number;
  };
}

async function conferirUsina(transacao: Knex.Transaction, clienteId: number): Promise<{ usinaId: number; outraUsinaId: number }> {
  const usina = { cliente_id: clienteId, codigo_ibge: IBGE_DO_TESTE, kwp: '3.850', data_protocolo: '2023-01-07', data_conexao: '2023-03-01', intervalo_limpeza_meses: 6 };
  const recusar = (nome: string, restricao: string, dados: Dados) => esperarRecusa(transacao, `usina: ${nome}`, restricao, inserir('usina', { ...usina, ...dados }));

  const usinaId = await esperarAceite(transacao, 'usina: válida', inserir('usina', usina));
  const outraUsinaId = await inserir('usina', usina)(transacao);
  await recusar('cliente_id inexistente', 'usina_cliente_id_foreign', { cliente_id: CLIENTE_INEXISTENTE });
  await recusar('município inexistente', 'usina_codigo_ibge_foreign', { codigo_ibge: IBGE_INEXISTENTE });
  await recusar('kwp igual a zero', 'usina_kwp_positivo', { kwp: '0' });
  await recusar('kwp negativo', 'usina_kwp_positivo', { kwp: '-1' });
  await recusar('intervalo diferente de 6 e 12', 'usina_intervalo_limpeza_valido', { intervalo_limpeza_meses: 7 });
  await recusar('status inválido', 'usina_status_check', { status: 'parada' });
  await recusar('data de protocolo nula', '23502', { data_protocolo: null });
  await recusar('data de conexão nula', '23502', { data_conexao: null });
  await esperarRecusa(transacao, 'usina: apagar cliente com usina (RESTRICT)', 'usina_cliente_id_foreign', (ponto) => ponto('cliente').where({ id: clienteId }).del());

  const colunasDeRegime = await transacao('information_schema.columns').select('column_name')
    .where({ table_schema: 'public', table_name: 'usina' }).whereILike('column_name', '%regime%');
  registrar('usina: não existe coluna de regime', colunasDeRegime.length === 0);
  return { usinaId, outraUsinaId };
}

async function conferirEquipamento(transacao: Knex.Transaction, usinaId: number): Promise<number> {
  const modulo = { usina_id: usinaId, tipo: 'modulo', marca: 'Marca', modelo: 'Modelo', numero_serie: 'S1', quantidade: 6, data_instalacao: '2023-03-01', garantia_produto_meses: 144, garantia_desempenho_anos: 25 };
  const recusar = (nome: string, restricao: string, dados: Dados) => esperarRecusa(transacao, `equipamento: ${nome}`, restricao, inserir('usina_equipamento', { ...modulo, ...dados }));

  const moduloId = await esperarAceite(transacao, 'equipamento: módulo com garantia de desempenho', inserir('usina_equipamento', modulo));
  await esperarAceite(transacao, 'equipamento: módulo sem garantia de desempenho', inserir('usina_equipamento', { ...modulo, garantia_desempenho_anos: null }));
  await recusar('inversor com garantia de desempenho', 'usina_equipamento_garantia_desempenho_so_em_modulo', { tipo: 'inversor' });
  await recusar('garantia de produto nula', '23502', { garantia_produto_meses: null });
  await recusar('quantidade igual a zero', 'usina_equipamento_quantidade_positiva', { quantidade: 0 });
  await recusar('garantia de produto igual a zero', 'usina_equipamento_garantia_produto_positiva', { garantia_produto_meses: 0 });
  await recusar('garantia de desempenho igual a zero', 'usina_equipamento_garantia_desempenho_positiva', { garantia_desempenho_anos: 0 });
  await recusar('tipo inválido', 'usina_equipamento_tipo_check', { tipo: 'bateria', garantia_desempenho_anos: null });
  return moduloId;
}

async function conferirManutencao(transacao: Knex.Transaction, usinaId: number): Promise<void> {
  const manutencao = { usina_id: usinaId, tipo: 'preventiva', data: '2024-01-10', descricao: 'Teste' };
  await esperarRecusa(transacao, 'manutenção: tipo inválido', 'usina_manutencao_tipo_check', inserir('usina_manutencao', manutencao));
}

async function conferirAlertaSemEquipamento(transacao: Knex.Transaction, usinaId: number): Promise<void> {
  const alerta = { usina_id: usinaId, descricao: 'Teste', ciclo: CICLO_A };
  for (const tipo of ['limpeza', 'garantia', 'desempenho']) {
    await esperarAceite(transacao, `alerta: ${tipo} sem equipamento`, inserir('usina_alerta', { ...alerta, tipo }));
  }
  await esperarRecusa(transacao, 'alerta: outro tipo', 'usina_alerta_tipo_check', inserir('usina_alerta', { ...alerta, tipo: 'outro' }));
}

async function conferirAlertaComEquipamento(transacao: Knex.Transaction, usinaId: number, outraUsinaId: number, moduloId: number): Promise<void> {
  const alerta = { usina_id: usinaId, usina_equipamento_id: moduloId, tipo: 'garantia', descricao: 'Teste', ciclo: CICLO_A };
  const recusar = (nome: string, restricao: string, dados: Dados) => esperarRecusa(transacao, `alerta: ${nome}`, restricao, inserir('usina_alerta', { ...alerta, ...dados }));

  await esperarAceite(transacao, 'alerta: garantia de produto com equipamento', inserir('usina_alerta', { ...alerta, tipo_garantia: 'produto' }));
  await esperarAceite(transacao, 'alerta: garantia de desempenho do mesmo módulo convive', inserir('usina_alerta', { ...alerta, tipo_garantia: 'desempenho' }));
  await recusar('equipamento sem tipo_garantia', 'usina_alerta_equipamento_com_tipo_de_garantia', {});
  await recusar('tipo_garantia sem equipamento', 'usina_alerta_equipamento_com_tipo_de_garantia', { usina_equipamento_id: null, tipo_garantia: 'produto' });
  await recusar('equipamento de outra usina', 'usina_alerta_equipamento_da_mesma_usina', { usina_id: outraUsinaId, tipo_garantia: 'produto' });
}

// Usa a outra usina, que ainda não tem alerta, para o alvo começar limpo.
async function conferirCicloDeVida(transacao: Knex.Transaction, usinaId: number): Promise<void> {
  const alerta = { usina_id: usinaId, tipo: 'desempenho', descricao: 'Teste', ciclo: CICLO_A };
  const alertaId = await inserir('usina_alerta', alerta)(transacao);
  const resolver = (dados: Dados): Operacao<number> => (ponto) => ponto('usina_alerta').where({ id: alertaId }).update({ status: 'resolvido', resolvido_em: ponto.fn.now(), ...dados });

  await esperarRecusa(transacao, 'alerta: segundo aberto igual', 'usina_alerta_unico_aberto', inserir('usina_alerta', alerta));
  await esperarRecusa(transacao, 'alerta: segundo aberto igual, outro ciclo', 'usina_alerta_unico_aberto', inserir('usina_alerta', { ...alerta, ciclo: CICLO_B }));
  await esperarRecusa(transacao, 'alerta: resolver sem descrição', 'usina_alerta_resolucao_coerente', resolver({}));
  await esperarAceite(transacao, 'alerta: resolver com descrição', resolver({ resolucao: 'Conferido' }));
  await esperarRecusa(transacao, 'alerta: reabrir o mesmo alvo no mesmo ciclo', 'usina_alerta_unico_por_ciclo', inserir('usina_alerta', alerta));
}

async function executarCasos(transacao: Knex.Transaction): Promise<void> {
  const clienteId = await inserir('cliente', { nome: 'Conferência', email: EMAIL_DO_TESTE, telefone: '0000000000', cep: '00000000', aceite_em: transacao.fn.now() })(transacao);
  await transacao('municipio').insert({ codigo_ibge: IBGE_DO_TESTE, nome: 'Município de teste', uf: 'XX' });

  const { usinaId, outraUsinaId } = await conferirUsina(transacao, clienteId);
  const moduloId = await conferirEquipamento(transacao, usinaId);
  await conferirManutencao(transacao, usinaId);
  await conferirAlertaSemEquipamento(transacao, usinaId);
  await conferirAlertaComEquipamento(transacao, usinaId, outraUsinaId, moduloId);
  await conferirCicloDeVida(transacao, outraUsinaId);
}

async function exigirIdentificadoresLivres(): Promise<void> {
  const municipios = await db('municipio').select('codigo_ibge').whereIn('codigo_ibge', [IBGE_DO_TESTE, IBGE_INEXISTENTE]);
  const clientes = await db('cliente').select('id').where({ email: EMAIL_DO_TESTE });
  if (municipios.length || clientes.length) throw new ErroDeConferencia('O código IBGE ou o e-mail do teste já existe no banco. Nada foi alterado.');
}

async function conferirIntegridade(): Promise<void> {
  const tabelas = ['cliente', 'municipio', ...TABELAS_DO_MODULO];
  const contagensIniciais = await Promise.all(tabelas.map(contarLinhas));
  await exigirIdentificadoresLivres();

  const transacao = await db.transaction();
  try {
    await executarCasos(transacao);
  } finally {
    await transacao.rollback();
  }

  const contagensFinais = await Promise.all(tabelas.map(contarLinhas));
  tabelas.forEach((tabela, indice) => {
    registrar(`limpeza: contagem de ${tabela} igual à inicial`, contagensFinais[indice] === contagensIniciais[indice], `${contagensIniciais[indice]} -> ${contagensFinais[indice]}`);
  });
  const clientes = await db('cliente').select('id').where({ email: EMAIL_DO_TESTE });
  const municipios = await db('municipio').select('id').where({ codigo_ibge: IBGE_DO_TESTE });
  registrar('limpeza: cliente do teste não existe', clientes.length === 0);
  registrar('limpeza: município do teste não existe', municipios.length === 0);
}

// ---------- Modo reversao ----------

interface EstadoDoBanco {
  migracoes: { name: string; batch: number }[];
  tabelas: string[];
}

async function lerEstado(): Promise<EstadoDoBanco> {
  const migracoes = await db('knex_migrations').select('name', 'batch').orderBy('id');
  const linhas = await db('information_schema.tables').select('table_name').where({ table_schema: 'public', table_type: 'BASE TABLE' }).orderBy('table_name');
  return { migracoes, tabelas: linhas.map((linha: { table_name: string }) => linha.table_name) };
}

function iguais(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Falha aqui interrompe: depois de uma alteração, seguir adiante poderia piorar o estado do banco.
function exigir(nome: string, passou: boolean, detalhe = ''): void {
  registrar(nome, passou, passou ? '' : detalhe);
  if (!passou) throw new ErroDeConferencia(`Interrompido em: ${nome}`);
}

// As tabelas de controle vêm primeiro: migrate.list as criaria se faltassem, e aqui nada pode ser alterado.
async function conferirControleDasMigrations(): Promise<void> {
  const temControle = await db.schema.hasTable('knex_migrations') && await db.schema.hasTable('knex_migrations_lock');
  exigir('pré-condição: tabelas de controle do Knex existem', temControle, 'rode as migrations antes.');

  const travas = await db('knex_migrations_lock').select('is_locked');
  exigir('pré-condição: sem trava ativa', travas.length === 1 && travas[0].is_locked === 0, `situação da trava: ${JSON.stringify(travas)}`);

  const [, pendentes] = await db.migrate.list();
  exigir('pré-condição: nenhuma migration pendente', pendentes.length === 0, `${pendentes.length} pendente(s).`);
}

async function conferirPreCondicoes(): Promise<void> {
  await conferirControleDasMigrations();

  for (const tabela of TABELAS_DO_MODULO) {
    exigir(`pré-condição: tabela ${tabela} existe`, await db.schema.hasTable(tabela), 'tabela não encontrada.');
    const linhas = await contarLinhas(tabela);
    exigir(`pré-condição: tabela ${tabela} sem linhas`, linhas === 0, `${linhas} linha(s); nada foi apagado.`);
  }

  const arquivos = readdirSync(path.join(import.meta.dirname, '..', 'migrations')).sort();
  exigir('pré-condição: pasta de migrations do módulo confere', iguais(arquivos, MIGRATIONS_DO_MODULO), `encontrado: ${arquivos.join(', ')}`);

  const { migracoes } = await lerEstado();
  const ultimas = migracoes.slice(-MIGRATIONS_DO_MODULO.length).map((migracao) => migracao.name);
  exigir('pré-condição: as 4 do módulo são os últimos registros', iguais(ultimas, MIGRATIONS_DO_MODULO), `encontrado: ${ultimas.join(', ')}`);
}

async function executarReversao(): Promise<void> {
  const inicial = await lerEstado();
  const nucleo: EstadoDoBanco = {
    migracoes: inicial.migracoes.filter((migracao) => !MIGRATIONS_DO_MODULO.includes(migracao.name)),
    tabelas: inicial.tabelas.filter((tabela) => !TABELAS_DO_MODULO.includes(tabela)),
  };
  console.log(`registro: ${nucleo.migracoes.length} migrations do núcleo e ${nucleo.tabelas.length} tabelas fora do módulo`);

  for (const esperada of MIGRATIONS_INVERTIDAS) {
    const [, arquivos] = await db.migrate.down();
    exigir(`migrate.down desfez ${esperada}`, iguais(arquivos, [esperada]), `devolveu: ${arquivos.join(', ')}`);
  }

  const [loteNovo, aplicadas] = await db.migrate.latest();
  exigir('migrate.latest aplicou as 4', iguais(aplicadas, MIGRATIONS_DO_MODULO), `devolveu: ${aplicadas.join(', ')}`);
  const doLote = (await lerEstado()).migracoes.filter((migracao) => migracao.batch === loteNovo).map((migracao) => migracao.name);
  exigir(`as 4 ficaram em um lote próprio (${loteNovo})`, iguais(doLote, MIGRATIONS_DO_MODULO), `no lote: ${doLote.join(', ')}`);

  const [loteDesfeito, desfeitas] = await db.migrate.rollback();
  exigir(`migrate.rollback tirou só o lote ${loteNovo}`, loteDesfeito === loteNovo && iguais(desfeitas, MIGRATIONS_INVERTIDAS), `lote ${loteDesfeito}: ${desfeitas.join(', ')}`);

  const semModulo = await lerEstado();
  exigir('as 4 tabelas sumiram e as demais estão iguais ao registro', iguais(semModulo.tabelas, nucleo.tabelas), `tabelas: ${semModulo.tabelas.join(', ')}`);
  exigir('migrations do núcleo iguais ao registro', iguais(semModulo.migracoes, nucleo.migracoes), `migrations: ${semModulo.migracoes.map((migracao) => migracao.name).join(', ')}`);

  const [loteFinal] = await db.migrate.latest();
  const { tabelas } = await lerEstado();
  exigir(`migrate.latest devolveu as 4 tabelas (lote ${loteFinal})`, TABELAS_DO_MODULO.every((tabela) => tabelas.includes(tabela)), `tabelas: ${tabelas.join(', ')}`);
}

async function relatarEstado(): Promise<void> {
  const { migracoes, tabelas } = await lerEstado();
  const lotes = [...new Set(migracoes.map((migracao) => migracao.batch))];
  for (const lote of lotes) console.error(`lote ${lote}: ${migracoes.filter((migracao) => migracao.batch === lote).map((migracao) => migracao.name).join(', ')}`);
  console.error(`tabelas: ${tabelas.join(', ')}`);
}

async function conferirReversao(): Promise<void> {
  await conferirPreCondicoes();
  try {
    await executarReversao();
  } catch (erro) {
    console.error('A reversão parou no meio e nada foi reparado. Estado atual:');
    await relatarEstado();
    throw erro;
  }
}

// ---------- Execução ----------

const modos = new Map([['integridade', conferirIntegridade], ['reversao', conferirReversao]]);

try {
  const modo = process.argv[2] ?? '';
  const executar = modos.get(modo);
  if (!executar) throw new ErroDeConferencia(`Modo desconhecido: "${modo}". Use integridade ou reversao.`);
  await exigirBancoDeTeste();
  await executar();
} catch (erro) {
  registrar('conferência interrompida', false, descreverErro(erro));
} finally {
  await db.destroy();
}

console.log(falhas ? `RESULTADO: ${falhas} falha(s)` : 'RESULTADO: tudo conforme o esperado');
process.exitCode = falhas ? 1 : 0;
