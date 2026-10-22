import { perfisSolares, type PerfilSolarId } from "@/lib/perfis-solares";
import type { DadosSimulador } from "@/lib/simulador-schema";

export const estadosBrasileiros = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"] as const;
export const ligacoes = [
  { id: "nao-sei", titulo: "Não sei" },
  { id: "monofasica", titulo: "Monofásica" },
  { id: "bifasica", titulo: "Bifásica" },
  { id: "trifasica", titulo: "Trifásica" },
] as const;

export type ContextoSimulador = {
  perfil: PerfilSolarId;
  cidade: string;
  consumoOuConta: string;
  ligacao: string;
};

export function contextoParaContato(dados: DadosSimulador): ContextoSimulador {
  const usina = dados.perfil === "usina";
  const valor = dados.valor.trim().replace(/^0+(?=\d)/, "");
  return {
    perfil: dados.perfil,
    cidade: dados.cidade + " / " + dados.uf,
    consumoOuConta: usina ? "Não informado — interesse em usina de investimento" : dados.tipoDado === "nao-sei" ? "Não informado" : dados.tipoDado === "conta" ? "Conta informada: R$ " + valor + "/mês" : "Consumo informado: " + valor + " kWh/mês",
    ligacao: usina ? "Não se aplica a esta preparação de atendimento" : ligacoes.find(item => item.id === dados.ligacao)!.titulo,
  };
}

export function nomePerfil(perfil: PerfilSolarId) {
  return perfisSolares.find(item => item.id === perfil)!.titulo;
}
