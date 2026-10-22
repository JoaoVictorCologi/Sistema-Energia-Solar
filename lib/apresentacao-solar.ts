import type { PerfilSolarId } from "@/lib/perfis-solares";

// Fotografias de composição: associação ao perfil da instalação não confirmada.
export const apresentacaoSolar = {
  residencial: { foto: "03", abertura: "O ponto de partida é a sua casa.", contexto: "Sua rotina vem antes do dimensionamento." },
  comercial: { foto: "01", abertura: "Entenda o consumo do seu negócio.", contexto: "A operação ajuda a explicar a conta." },
  rural: { foto: "11", abertura: "Cada propriedade tem uma rotina.", contexto: "Olhar para o ano inteiro faz diferença." },
  usina: { foto: "06", abertura: "Antes de investir, entender o projeto.", contexto: "Viabilidade exige mais do que área disponível." },
} as const satisfies Record<PerfilSolarId, { foto: string; abertura: string; contexto: string }>;
