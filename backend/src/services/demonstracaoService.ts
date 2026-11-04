// Dados fictícios de demonstração: catálogo, clientes com simulação e propostas em situações diferentes.
import { Decimal } from 'decimal.js';
import { apagarDadosDeDemonstracao } from '../repositories/demonstracaoRepository.ts';
import { pedirProposta } from './clientesService.ts';
import { cadastrarEquipamento } from './equipamentosService.ts';
import { consultarFormas } from './configuracoesService.ts';
import { adicionarAjuste, adicionarCondicao, enviarProposta, gerarProposta, mudarStatusDaProposta } from './propostasService.ts';
import { simularEconomia, type TipoLigacao } from './simulacaoService.ts';

export const DOMINIO_DA_DEMONSTRACAO = 'demo.exemplo.com';
export const FABRICANTE_DA_DEMONSTRACAO = 'Demonstração';

// Preços ilustrativos, só para a demonstração.
const CATALOGO = [
  { tipo: 'modulo', modelo: 'Módulo 550 W', potenciaW: 550, preco: '700.00' },
  { tipo: 'modulo', modelo: 'Módulo 600 W', potenciaW: 600, preco: '780.00' },
  { tipo: 'inversor', modelo: 'Inversor 3 kW', potenciaW: 3000, preco: '3500.00' },
  { tipo: 'inversor', modelo: 'Inversor 5 kW', potenciaW: 5000, preco: '5200.00' },
  { tipo: 'inversor', modelo: 'Inversor 8 kW', potenciaW: 8000, preco: '7800.00' },
] as const;

// CEPs reais da região (conferidos no ViaCEP); pessoas fictícias.
const CLIENTES: { nome: string; cep: string; tipoLigacao: TipoLigacao; consumo: number; proposta?: 'rascunho' | 'enviada' | 'aceita' | 'recusada' }[] = [
  { nome: 'Ana Souza', cep: '13730250', tipoLigacao: 'monofasico', consumo: 180, proposta: 'aceita' },
  { nome: 'Bruno Lima', cep: '13720071', tipoLigacao: 'bifasico', consumo: 320, proposta: 'enviada' },
  { nome: 'Carla Mendes', cep: '13026099', tipoLigacao: 'trifasico', consumo: 650, proposta: 'recusada' },
  { nome: 'Diego Rocha', cep: '13730250', tipoLigacao: 'bifasico', consumo: 420, proposta: 'enviada' },
  { nome: 'Elisa Prado', cep: '13720071', tipoLigacao: 'monofasico', consumo: 150 },
  { nome: 'Fábio Nunes', cep: '13026099', tipoLigacao: 'trifasico', consumo: 900, proposta: 'aceita' },
  { nome: 'Gabriela Reis', cep: '13730250', tipoLigacao: 'bifasico', consumo: 280 },
  { nome: 'Heitor Alves', cep: '13026099', tipoLigacao: 'monofasico', consumo: 230, proposta: 'rascunho' },
];

function emailDe(nome: string): string {
  return `${nome.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, '.')}@${DOMINIO_DA_DEMONSTRACAO}`;
}

async function cadastrarCatalogo() {
  const equipamentos = [];
  for (const item of CATALOGO) {
    equipamentos.push(await cadastrarEquipamento({
      tipo: item.tipo, fabricante: FABRICANTE_DA_DEMONSTRACAO, modelo: item.modelo, potenciaW: new Decimal(item.potenciaW),
      degradacaoAnual: item.tipo === 'modulo' ? new Decimal('0.005') : null, preco: new Decimal(item.preco),
    }));
  }
  return { modulo: equipamentos[0], inversores: equipamentos.filter((equipamento) => equipamento.tipo === 'inversor') };
}

// O inversor de potência mais próxima de kWp ÷ 1,25 (meio da faixa de razão CC/CA).
function inversorPara(kwp: number, inversores: { id: number; potenciaW: number }[]) {
  const alvo = (kwp / 1.25) * 1000;
  return inversores.reduce((melhor, inversor) => (Math.abs(inversor.potenciaW - alvo) < Math.abs(melhor.potenciaW - alvo) ? inversor : melhor));
}

// Usa os mesmos services da API, para a demonstração seguir as regras reais.
export async function criarDadosDeDemonstracao(): Promise<{ clientes: number; propostas: number }> {
  await apagarDadosDeDemonstracao(DOMINIO_DA_DEMONSTRACAO, FABRICANTE_DA_DEMONSTRACAO);
  const { modulo, inversores } = await cadastrarCatalogo();
  const avista = (await consultarFormas(true)).find((forma) => forma.tipo === 'avista');
  if (!avista) throw new Error('Ative uma forma de pagamento à vista no painel antes de criar a demonstração.');
  let propostas = 0;
  for (const [indice, cliente] of CLIENTES.entries()) {
    const simulacao = await simularEconomia({ cep: cliente.cep, tipoLigacao: cliente.tipoLigacao, subgrupo: 'B1', consumoMedioKwh: new Decimal(cliente.consumo) });
    await pedirProposta({ codigoDaSimulacao: simulacao.codigo, nome: cliente.nome, email: emailDe(cliente.nome), telefone: `1999000000${indice}` });
    if (!cliente.proposta) continue;
    const inversor = inversorPara(simulacao.dimensionamento.kwpInstalado, inversores);
    const proposta = await gerarProposta({ simulacao: simulacao.codigo, moduloId: modulo.id, inversorId: inversor.id });
    if (cliente.proposta === 'rascunho') {
      propostas++;
      continue;
    }
    if (cliente.proposta === 'aceita') {
      await adicionarAjuste(proposta.id, { tipo: 'desconto', descricao: 'Desconto de fechamento', modo: 'percentual', valor: new Decimal('0.05') }, null);
    }
    await adicionarCondicao(proposta.id, { formaPagamentoId: avista.id }, null);
    await enviarProposta(proposta.id, null);
    if (cliente.proposta !== 'enviada') await mudarStatusDaProposta(proposta.id, cliente.proposta, null);
    propostas++;
  }
  return { clientes: CLIENTES.length, propostas };
}
