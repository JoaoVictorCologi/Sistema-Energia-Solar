// Funções que as telas do módulo usam para falar com o backend; sessão e formato de erro ficam em requisitar, do núcleo.
import { requisitar } from '../../services/api.ts';
import type { CorpoDaUsina, CorpoDoEquipamento, EquipamentoDaUsina, MunicipioDaUsina, PaginaDeUsinas, UsinaDetalhada } from './tipos.ts';

// Chamadas da API de usinas. Contrato em docs/arquitetura/backend.md.

// Busca e UF vazias ficam fora da query: a API recusa uf vazia.
function montarConsulta(parametros: Record<string, string | number | undefined>): string {
  const preenchidos = Object.entries(parametros).filter(([, valor]) => valor !== undefined && valor !== '');
  const texto = new URLSearchParams(preenchidos.map(([chave, valor]) => [chave, String(valor)])).toString();
  return texto ? `?${texto}` : '';
}

// A API só lista ativas: não há parâmetro de status.
export async function listarUsinas(filtro: { busca?: string; pagina: number }): Promise<PaginaDeUsinas> {
  return requisitar(`/admin/usinas${montarConsulta(filtro)}`);
}

// Devolve só a lista: o formulário não usa mais nada da resposta.
export async function buscarMunicipios(filtro: { busca: string; uf?: string }): Promise<MunicipioDaUsina[]> {
  return (await requisitar<{ municipios: MunicipioDaUsina[] }>(`/admin/usinas/municipios${montarConsulta(filtro)}`)).municipios;
}

// Funciona também para usina desativada.
export async function buscarUsina(id: number): Promise<UsinaDetalhada> {
  return (await requisitar<{ usina: UsinaDetalhada }>(`/admin/usinas/${id}`)).usina;
}

// A resposta traz a usina com o regime calculado pelo backend.
export async function cadastrarUsina(corpo: CorpoDaUsina): Promise<UsinaDetalhada> {
  return (await requisitar<{ usina: UsinaDetalhada }>('/admin/usinas', { metodo: 'POST', corpo })).usina;
}

// O corpo vai completo, com campo limpo como null ou texto vazio: ver CorpoDaUsina.
export async function alterarUsina(id: number, corpo: CorpoDaUsina): Promise<UsinaDetalhada> {
  return (await requisitar<{ usina: UsinaDetalhada }>(`/admin/usinas/${id}`, { metodo: 'PATCH', corpo })).usina;
}

// Sem corpo; a resposta já vem com o status novo.
export async function desativarUsina(id: number): Promise<UsinaDetalhada> {
  return (await requisitar<{ usina: UsinaDetalhada }>(`/admin/usinas/${id}/desativar`, { metodo: 'POST' })).usina;
}

// Um equipamento por chamada; os vencimentos vêm calculados na resposta.
export async function cadastrarEquipamentoDaUsina(idDaUsina: number, corpo: CorpoDoEquipamento): Promise<EquipamentoDaUsina> {
  return (await requisitar<{ equipamento: EquipamentoDaUsina }>(`/admin/usinas/${idDaUsina}/equipamentos`, { metodo: 'POST', corpo })).equipamento;
}

// O backend recusa equipamento que não seja desta usina.
export async function alterarEquipamentoDaUsina(idDaUsina: number, idDoEquipamento: number, corpo: CorpoDoEquipamento): Promise<EquipamentoDaUsina> {
  return (await requisitar<{ equipamento: EquipamentoDaUsina }>(`/admin/usinas/${idDaUsina}/equipamentos/${idDoEquipamento}`, { metodo: 'PATCH', corpo })).equipamento;
}
