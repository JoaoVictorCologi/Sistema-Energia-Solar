import type { PerfilSolarId } from "@/lib/perfis-solares";

type Detalhe = {
  resumo: string;
  necessidade: string;
  solucao: string;
  pontos: readonly string[];
  etapas: readonly { titulo: string; texto: string }[];
  faq: readonly { pergunta: string; resposta: string }[];
};

export const detalhesSolares = {
  residencial: {
    resumo: "Um projeto de energia solar pensado para o consumo e as características da sua casa.",
    necessidade: "Cada residência tem uma rotina de consumo. Antes de escolher um sistema, é importante conhecer a conta de energia, o espaço disponível e as condições do imóvel.",
    solucao: "Para avaliar um projeto residencial, é importante reunir informações sobre o consumo e o imóvel. Converse com a equipe sobre o escopo da análise, as possibilidades de instalação e as condições da proposta.",
    pontos: ["Perfil de consumo da residência", "Espaço e condições para instalação", "Proposta adequada ao imóvel"],
    etapas: [
      { titulo: "Descreva a casa", texto: "Informe a cidade e as características do imóvel." },
      { titulo: "Reúna o consumo", texto: "Se possível, tenha em mãos uma conta de energia e o histórico de consumo." },
      { titulo: "Conte sobre a rotina", texto: "Informe horários de uso e mudanças previstas, como novos equipamentos." },
    ],
    faq: [
      { pergunta: "Preciso saber meu consumo para entrar em contato?", resposta: "Não. Esse dado é opcional no formulário. Uma conta de energia pode ajudar na análise, mas você pode começar a conversa apenas com seus dados de contato." },
      { pergunta: "O mesmo sistema atende qualquer casa?", resposta: "O dimensionamento depende do consumo e das condições do imóvel. A proposta deve considerar o seu caso, em vez de partir de um tamanho único." },
      { pergunta: "Posso pedir uma proposta para uma casa em outra cidade?", resposta: "Informe a cidade no contato para que a equipe confirme a possibilidade de atendimento e as condições do projeto." },
    ],
  },
  comercial: {
    resumo: "Energia solar para o perfil de consumo e a rotina do seu negócio.",
    necessidade: "Horários de funcionamento, equipamentos e consumo variam de uma empresa para outra. Essas informações ajudam a avaliar como um projeto solar pode se integrar à operação.",
    solucao: "O consumo, os horários de funcionamento e as condições do local ajudam a preparar a avaliação. Escopo, prazos e possíveis impactos na operação devem ser esclarecidos na proposta.",
    pontos: ["Consumo e horários da operação", "Condições do imóvel comercial", "Escopo e planejamento do projeto"],
    etapas: [
      { titulo: "Apresente a atividade", texto: "Informe a cidade, a atividade da empresa e os horários de funcionamento." },
      { titulo: "Reúna os dados de consumo", texto: "Separe as contas disponíveis e descreva os principais equipamentos." },
      { titulo: "Explique os planos do negócio", texto: "Conte sobre mudanças previstas e restrições da operação." },
    ],
    faq: [
      { pergunta: "Quais informações ajudam na primeira conversa?", resposta: "A cidade e uma conta de energia ajudam a contextualizar a necessidade. A equipe poderá orientar sobre outras informações para a análise." },
      { pergunta: "O horário de funcionamento faz diferença?", resposta: "Sim. A distribuição do consumo ao longo do dia é uma das informações relevantes ao estudo do projeto." },
      { pergunta: "Como ficam os prazos e a rotina da empresa?", resposta: "Prazos, acesso ao imóvel e planejamento da instalação precisam ser definidos na proposta e alinhados com os responsáveis pela operação." },
    ],
  },
  rural: {
    resumo: "Uma solução solar avaliada a partir das necessidades da sua propriedade rural.",
    necessidade: "Equipamentos, atividades e períodos de produção influenciam o consumo no campo. O local disponível e as condições de instalação também fazem parte da avaliação.",
    solucao: "A atividade e as variações de consumo da propriedade são informações importantes para a avaliação. Apresente as condições do local e converse com a equipe sobre o escopo do projeto.",
    pontos: ["Rotina e sazonalidade da propriedade", "Consumo dos equipamentos", "Condições do local de instalação"],
    etapas: [
      { titulo: "Descreva a propriedade", texto: "Informe a cidade e as principais atividades desenvolvidas." },
      { titulo: "Explique a sazonalidade", texto: "Indique os períodos de maior consumo e os equipamentos utilizados." },
      { titulo: "Apresente o local", texto: "Descreva a área disponível e as condições conhecidas da instalação." },
    ],
    faq: [
      { pergunta: "O consumo muda durante o ano. Isso importa?", resposta: "Sim. Informe os períodos de maior consumo e as atividades sazonais para que sejam considerados na análise." },
      { pergunta: "Posso informar o consumo de equipamentos específicos?", resposta: "Sim. Informações sobre os equipamentos ajudam a entender o perfil da propriedade. A equipe orientará quais dados são necessários ao projeto." },
      { pergunta: "É preciso definir o local da instalação antes de conversar?", resposta: "Não. Você pode apresentar as possibilidades e esclarecer com a equipe o que precisa ser avaliado tecnicamente." },
    ],
  },
  usina: {
    resumo: "Avaliação de projetos de geração solar com foco em usinas de investimento.",
    necessidade: "Uma usina exige uma avaliação específica do local, do projeto e das condições de implantação. Antes de uma decisão, é necessário entender o escopo e as premissas do estudo.",
    solucao: "Apresente os objetivos e as informações disponíveis sobre o local. Escopo do estudo, condições de implantação, premissas e responsabilidades precisam ser esclarecidos antes de qualquer projeção financeira. Esta página não oferece garantia de rentabilidade.",
    pontos: ["Objetivos e características do projeto", "Condições do local e da implantação", "Premissas e escopo da avaliação"],
    etapas: [
      { titulo: "Apresente o objetivo", texto: "Informe a cidade e o objetivo do projeto de geração solar." },
      { titulo: "Descreva a área", texto: "Conte quais informações sobre o local já estão disponíveis." },
      { titulo: "Liste o que precisa esclarecer", texto: "Converse sobre escopo, conexão, custos e premissas da avaliação." },
    ],
    faq: [
      { pergunta: "Existe um retorno financeiro garantido?", resposta: "Não é possível afirmar um retorno fixo nesta página. A avaliação depende das condições e premissas específicas do projeto, que precisam ser apresentadas e analisadas." },
      { pergunta: "Já preciso ter um terreno definido?", resposta: "Você pode iniciar a conversa informando seu objetivo e as opções disponíveis. A equipe indicará quais informações sobre o local serão necessárias à avaliação." },
      { pergunta: "Quais informações devo enviar no primeiro contato?", resposta: "Informe seu nome, telefone e cidade, selecione usina de investimento e conte mais sobre seu objetivo durante a conversa no WhatsApp." },
    ],
  },
} as const satisfies Record<PerfilSolarId, Detalhe>;
