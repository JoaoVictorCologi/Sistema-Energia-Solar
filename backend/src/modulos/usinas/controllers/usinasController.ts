// Entrada da API de usinas: esquemas de validação e handlers, que convertem o pedido e chamam o service.
import type { Request, Response } from 'express';
import { Decimal } from 'decimal.js';
import { z } from 'zod';
import { lerEntrada } from '../../../middlewares/validar.ts';
import {
  alterarEquipamentoDaUsina, alterarUsina, buscarMunicipiosParaUsina, buscarUsinasAtivas, cadastrarEquipamentoDaUsina, cadastrarUsina, consultarUsina, desativarUsina,
} from '../services/usinasService.ts';

// Limites das colunas integer e numeric(10,3): acima deles, o pedido viraria erro 500 do banco.
const MAIOR_INTEIRO_DO_BANCO = 2_147_483_647;
const MAIOR_KWP = 9_999_999.999;
const POR_PAGINA_MAXIMO = 100;

// A mensagem dada ao tipo vale também para as checagens sem mensagem própria: sem ela, o texto técnico do validador chegaria à tela.
const inteiroPositivo = (mensagem: string) => z.number(mensagem).int().positive().max(MAIOR_INTEIRO_DO_BANCO);
// Id fora do integer do banco é recusado aqui, antes de qualquer consulta.
const idDaRota = z.coerce.number().int().positive().max(MAIOR_INTEIRO_DO_BANCO);
// Mais de 3 casas seriam arredondadas em silêncio pela coluna numeric(10,3): o pedido é recusado.
const kwp = z.number('Informe a potência em kWp: maior que zero e até 9.999.999,999.').positive().max(MAIOR_KWP).refine((valor) => /^\d+(\.\d{1,3})?$/.test(String(valor)), 'Use até 3 casas decimais.');
// O ano 0000 passa no formato, mas o PostgreSQL não o aceita em uma coluna date.
const data = z.iso.date('Use uma data válida no formato AAAA-MM-DD.').refine((valor) => !valor.startsWith('0000'), 'Use uma data válida no formato AAAA-MM-DD.');
// O PostgreSQL não grava nem compara texto com o caractere nulo.
const semCaractereNulo = (texto: string) => !texto.includes('\0');
// trim antes dos limites: só espaços conta como vazio, e a série é comparada sem espaços nas pontas.
const textoObrigatorio = (maximo: number) => z.string('Preencha este campo.').trim().min(1).max(maximo, `Use no máximo ${maximo} caracteres.`).refine(semCaractereNulo, 'Caractere inválido.');
// Mensagem de tipo opcional: só a busca de municípios, que é obrigatória, a informa.
const textoDeBusca = (mensagemDeTipo?: string) => z.string(mensagemDeTipo).trim().max(120, 'Use no máximo 120 caracteres.').refine(semCaractereNulo, 'Caractere inválido.');
// Só o valor: a obrigatoriedade depende do tipo do equipamento e é conferida no service.
const garantiaDesempenhoAnos = inteiroPositivo('Informe a garantia de desempenho em anos: número inteiro de 1 a 2.147.483.647.');
// O regime já virou undefined na validação: um corpo só com ele não conta como alteração.
const temCampoAplicavel = (dados: object) => Object.values(dados).some((valor) => valor !== undefined);
// Sem um campo específico para apontar, o erro vai em fields.corpo.
const AO_MENOS_UM_CAMPO = { message: 'Informe ao menos um campo para alterar.', path: ['corpo'] };

// Base do POST e do PATCH de usina. O cliente precisa existir: o service confere antes de gravar.
const camposDaUsina = {
  clienteId: inteiroPositivo('Escolha um cliente.'),
  codigoIbge: inteiroPositivo('Escolha um município.'),
  kwp,
  dataProtocolo: data,
  dataConexao: data,
  intervaloLimpezaMeses: z.literal([6, 12], 'Use 6 ou 12 meses.'),
  // O regime é calculado pela data de protocolo: enviado no body, é ignorado sem recusar o pedido.
  regime: z.unknown().optional().transform(() => undefined),
};

// Base do POST e do PATCH de equipamento. Sem quantidade: a API grava 1 e recusa o campo no corpo.
const camposDoEquipamento = {
  tipo: z.enum(['modulo', 'inversor']),
  marca: textoObrigatorio(80),
  modelo: textoObrigatorio(120),
  numeroSerie: textoObrigatorio(100),
  dataInstalacao: data,
  garantiaProdutoMeses: inteiroPositivo('Informe a garantia do produto em meses: número inteiro de 1 a 2.147.483.647.'),
};

// O POST exige todos os campos; o PATCH aceita qualquer parte deles, desde que ao menos um se aplique.
export const esquemaNovaUsina = z.object(camposDaUsina);
export const esquemaMudancaDaUsina = z.object(camposDaUsina).partial().refine(temCampoAplicavel, AO_MENOS_UM_CAMPO);
// Garantia de desempenho opcional no esquema porque inversor não a informa; módulo sem ela é recusado pela regra do tipo.
export const esquemaNovoEquipamentoDaUsina = z.object({ ...camposDoEquipamento, garantiaDesempenhoAnos: garantiaDesempenhoAnos.optional() });
// null só no PATCH: sem ele, um módulo cadastrado por engano nunca poderia virar inversor, que não aceita essa garantia.
export const esquemaMudancaDoEquipamentoDaUsina = z.object({ ...camposDoEquipamento, garantiaDesempenhoAnos: garantiaDesempenhoAnos.nullable() })
  .partial().refine(temCampoAplicavel, AO_MENOS_UM_CAMPO);

// Params e query são lidos nos handlers com lerEntrada: o Express 5 não deixa trocá-los em um middleware.
const esquemaIdDaUsina = z.object({ id: idDaRota });
const esquemaIdDoEquipamento = z.object({ id: idDaRota, equipamentoId: idDaRota });
// Sem campo de status: a lista só mostra ativas, e ?status é recusado como campo desconhecido. Busca vazia equivale a não buscar.
const esquemaListaDeUsinas = z.object({
  busca: textoDeBusca().optional().transform((busca) => busca || undefined),
  pagina: z.coerce.number().int().min(1).default(1),
  // Pedido acima do máximo não é erro: vem limitado a 100.
  porPagina: z.coerce.number().int().min(1).default(20).transform((quantidade) => Math.min(quantidade, POR_PAGINA_MAXIMO)),
});
// A UF passa para maiúsculas antes de a sigla ser conferida.
const esquemaBuscaDeMunicipios = z.object({
  busca: textoDeBusca('Digite ao menos 2 caracteres.').min(2),
  uf: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, 'Use a sigla da UF, com 2 letras.').optional(),
});

// A potência chega como número no JSON; daqui em diante circula como Decimal.
const comoDecimal = (valor: number) => new Decimal(String(valor));

// O filtro de status é definido no service, nunca no pedido.
export async function listarUsinasDoAdmin(requisicao: Request, resposta: Response): Promise<void> {
  resposta.json(await buscarUsinasAtivas(lerEntrada(esquemaListaDeUsinas, requisicao.query)));
}

// Só leitura: alimenta a escolha de município do formulário da usina.
export async function buscarMunicipiosDoAdmin(requisicao: Request, resposta: Response): Promise<void> {
  resposta.json({ municipios: await buscarMunicipiosParaUsina(lerEntrada(esquemaBuscaDeMunicipios, requisicao.query)) });
}

// O body já vem convertido por validar(). Campo a campo: o regime, ignorado na validação, não segue adiante.
export async function criarUsina(requisicao: Request, resposta: Response): Promise<void> {
  const dados = requisicao.body as z.infer<typeof esquemaNovaUsina>;
  const usina = await cadastrarUsina({
    clienteId: dados.clienteId, codigoIbge: dados.codigoIbge, kwp: comoDecimal(dados.kwp), dataProtocolo: dados.dataProtocolo,
    dataConexao: dados.dataConexao, intervaloLimpezaMeses: dados.intervaloLimpezaMeses,
  });
  resposta.status(201).json({ usina });
}

// Não filtra por status: o detalhe de usina desativada continua disponível.
export async function obterUsina(requisicao: Request, resposta: Response): Promise<void> {
  resposta.json({ usina: await consultarUsina(lerEntrada(esquemaIdDaUsina, requisicao.params).id) });
}

// kWp só vira Decimal se veio no pedido: undefined significa que o campo não muda.
export async function alterarUsinaDoAdmin(requisicao: Request, resposta: Response): Promise<void> {
  const { id } = lerEntrada(esquemaIdDaUsina, requisicao.params);
  const mudanca = requisicao.body as z.infer<typeof esquemaMudancaDaUsina>;
  const usina = await alterarUsina(id, {
    clienteId: mudanca.clienteId, codigoIbge: mudanca.codigoIbge, kwp: mudanca.kwp === undefined ? undefined : comoDecimal(mudanca.kwp),
    dataProtocolo: mudanca.dataProtocolo, dataConexao: mudanca.dataConexao, intervaloLimpezaMeses: mudanca.intervaloLimpezaMeses,
  });
  resposta.json({ usina });
}

// Sem corpo: a resposta traz a usina já com o status novo.
export async function desativarUsinaDoAdmin(requisicao: Request, resposta: Response): Promise<void> {
  resposta.json({ usina: await desativarUsina(lerEntrada(esquemaIdDaUsina, requisicao.params).id) });
}

// Garantia de desempenho não informada segue como null, o valor que a coluna guarda nesse caso.
export async function criarEquipamentoDaUsina(requisicao: Request, resposta: Response): Promise<void> {
  const { id } = lerEntrada(esquemaIdDaUsina, requisicao.params);
  const dados = requisicao.body as z.infer<typeof esquemaNovoEquipamentoDaUsina>;
  const equipamento = await cadastrarEquipamentoDaUsina(id, { ...dados, garantiaDesempenhoAnos: dados.garantiaDesempenhoAnos ?? null });
  resposta.status(201).json({ equipamento });
}

// Aqui null e ausente são diferentes: null limpa a garantia de desempenho, ausente a mantém.
export async function alterarEquipamentoDaUsinaDoAdmin(requisicao: Request, resposta: Response): Promise<void> {
  const { id, equipamentoId } = lerEntrada(esquemaIdDoEquipamento, requisicao.params);
  const mudanca = requisicao.body as z.infer<typeof esquemaMudancaDoEquipamentoDaUsina>;
  resposta.json({ equipamento: await alterarEquipamentoDaUsina(id, equipamentoId, mudanca) });
}
