import { perfisSolares } from "@/lib/perfis-solares";
import { detalhesSolares } from "@/lib/servicos-detalhes";

const servicosBase = [
  {
    id: "residencial", titulo: "Residencial",
    intro: "Energia solar para o consumo e as características da sua casa.",
    beneficios: ["Consumo de energia ao longo do ano", "Área disponível e condições da cobertura", "Horários de uso e mudanças previstas na rotina", "Informações para conversar sobre o projeto"],
  },
  {
    id: "comercial", titulo: "Comercial",
    intro: "Um projeto solar começa pelo perfil de consumo e pela rotina do negócio.",
    beneficios: ["Horários de funcionamento da empresa", "Consumo dos equipamentos e variações de demanda", "Condições do imóvel e espaço disponível", "Planos de ampliação da operação"],
  },
  {
    id: "rural", titulo: "Rural",
    intro: "A rotina e a sazonalidade da propriedade orientam a conversa sobre energia solar.",
    beneficios: ["Atividades e períodos de maior consumo", "Equipamentos e horários de utilização", "Variações do consumo ao longo do ano", "Área disponível e condições de instalação"],
  },
  {
    id: "usina", titulo: "Usina de investimento",
    intro: "Objetivo, localização e condições do projeto precisam de uma avaliação específica.",
    beneficios: ["Objetivo do projeto de geração solar", "Localização e características da área", "Condições de conexão e implantação a avaliar", "Premissas, custos e responsabilidades a esclarecer"],
  },
] as const;

export const servicos = perfisSolares.map((perfil) => {
  const base = servicosBase.find((item) => item.id === perfil.id);
  if (!base) throw new Error("Perfil solar sem dados: " + perfil.id);
  return { ...base, ...perfil, ...detalhesSolares[perfil.id] };
});

export type Servico = (typeof servicos)[number];
