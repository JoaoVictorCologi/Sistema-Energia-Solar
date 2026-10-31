// Textos das quatro soluções, herdados do site Don Energy (lib/perfis-solares.ts, servicos-detalhes.ts e apresentacao-solar.ts).
// A foto é só de composição: a associação da instalação ao perfil não foi confirmada.

export interface Solucao {
  slug: string;
  titulo: string;
  nome: string;
  intro: string;
  resumo: string;
  abertura: string;
  contexto: string;
  necessidade: string;
  solucao: string;
  pontos: string[];
  etapas: { titulo: string; texto: string }[];
  perguntas: { pergunta: string; resposta: string }[];
  mensagemDoWhatsApp: string;
  foto: string;
}

export const solucoes: Solucao[] = [
  {
    slug: 'solar-residencial',
    titulo: 'Residencial',
    nome: 'Energia solar residencial',
    intro: 'Energia solar para o consumo e as características da sua casa.',
    resumo: 'Um projeto de energia solar pensado para o consumo e as características da sua casa.',
    abertura: 'O ponto de partida é a sua casa.',
    contexto: 'Sua rotina vem antes do dimensionamento.',
    necessidade: 'Cada residência tem uma rotina de consumo. Antes de escolher um sistema, é importante conhecer a conta de energia, o espaço disponível e as condições do imóvel.',
    solucao: 'Para avaliar um projeto residencial, é importante reunir informações sobre o consumo e o imóvel. Converse com a equipe sobre o escopo da análise, as possibilidades de instalação e as condições da proposta.',
    pontos: ['Perfil de consumo da residência', 'Espaço e condições para instalação', 'Proposta adequada ao imóvel'],
    etapas: [
      { titulo: 'Descreva a casa', texto: 'Informe a cidade e as características do imóvel.' },
      { titulo: 'Reúna o consumo', texto: 'Se possível, tenha em mãos uma conta de energia e o histórico de consumo.' },
      { titulo: 'Conte sobre a rotina', texto: 'Informe horários de uso e mudanças previstas, como novos equipamentos.' },
    ],
    perguntas: [
      { pergunta: 'Preciso saber meu consumo para entrar em contato?', resposta: 'Não. Esse dado é opcional no formulário. Uma conta de energia pode ajudar na análise, mas você pode começar a conversa apenas com seus dados de contato.' },
      { pergunta: 'O mesmo sistema atende qualquer casa?', resposta: 'O dimensionamento depende do consumo e das condições do imóvel. A proposta deve considerar o seu caso, em vez de partir de um tamanho único.' },
      { pergunta: 'Posso pedir uma proposta para uma casa em outra cidade?', resposta: 'Informe a cidade no contato para que a equipe confirme a possibilidade de atendimento e as condições do projeto.' },
    ],
    mensagemDoWhatsApp: 'Olá! Tenho interesse em energia solar residencial e gostaria de mais informações.',
    foto: '03',
  },
  {
    slug: 'solar-comercial',
    titulo: 'Comercial',
    nome: 'Energia solar comercial',
    intro: 'Um projeto solar começa pelo perfil de consumo e pela rotina do negócio.',
    resumo: 'Energia solar para o perfil de consumo e a rotina do seu negócio.',
    abertura: 'Entenda o consumo do seu negócio.',
    contexto: 'A operação ajuda a explicar a conta.',
    necessidade: 'Horários de funcionamento, equipamentos e consumo variam de uma empresa para outra. Essas informações ajudam a avaliar como um projeto solar pode se integrar à operação.',
    solucao: 'O consumo, os horários de funcionamento e as condições do local ajudam a preparar a avaliação. Escopo, prazos e possíveis impactos na operação devem ser esclarecidos na proposta.',
    pontos: ['Consumo e horários da operação', 'Condições do imóvel comercial', 'Escopo e planejamento do projeto'],
    etapas: [
      { titulo: 'Apresente a atividade', texto: 'Informe a cidade, a atividade da empresa e os horários de funcionamento.' },
      { titulo: 'Reúna os dados de consumo', texto: 'Separe as contas disponíveis e descreva os principais equipamentos.' },
      { titulo: 'Explique os planos do negócio', texto: 'Conte sobre mudanças previstas e restrições da operação.' },
    ],
    perguntas: [
      { pergunta: 'Quais informações ajudam na primeira conversa?', resposta: 'A cidade e uma conta de energia ajudam a contextualizar a necessidade. A equipe poderá orientar sobre outras informações para a análise.' },
      { pergunta: 'O horário de funcionamento faz diferença?', resposta: 'Sim. A distribuição do consumo ao longo do dia é uma das informações relevantes ao estudo do projeto.' },
      { pergunta: 'Como ficam os prazos e a rotina da empresa?', resposta: 'Prazos, acesso ao imóvel e planejamento da instalação precisam ser definidos na proposta e alinhados com os responsáveis pela operação.' },
    ],
    mensagemDoWhatsApp: 'Olá! Tenho interesse em energia solar comercial e gostaria de mais informações.',
    foto: '01',
  },
  {
    slug: 'solar-rural',
    titulo: 'Rural',
    nome: 'Energia solar rural',
    intro: 'A rotina e a sazonalidade da propriedade orientam a conversa sobre energia solar.',
    resumo: 'Uma solução solar avaliada a partir das necessidades da sua propriedade rural.',
    abertura: 'Cada propriedade tem uma rotina.',
    contexto: 'Olhar para o ano inteiro faz diferença.',
    necessidade: 'Equipamentos, atividades e períodos de produção influenciam o consumo no campo. O local disponível e as condições de instalação também fazem parte da avaliação.',
    solucao: 'A atividade e as variações de consumo da propriedade são informações importantes para a avaliação. Apresente as condições do local e converse com a equipe sobre o escopo do projeto.',
    pontos: ['Rotina e sazonalidade da propriedade', 'Consumo dos equipamentos', 'Condições do local de instalação'],
    etapas: [
      { titulo: 'Descreva a propriedade', texto: 'Informe a cidade e as principais atividades desenvolvidas.' },
      { titulo: 'Explique a sazonalidade', texto: 'Indique os períodos de maior consumo e os equipamentos utilizados.' },
      { titulo: 'Apresente o local', texto: 'Descreva a área disponível e as condições conhecidas da instalação.' },
    ],
    perguntas: [
      { pergunta: 'O consumo muda durante o ano. Isso importa?', resposta: 'Sim. Informe os períodos de maior consumo e as atividades sazonais para que sejam considerados na análise.' },
      { pergunta: 'Posso informar o consumo de equipamentos específicos?', resposta: 'Sim. Informações sobre os equipamentos ajudam a entender o perfil da propriedade. A equipe orientará quais dados são necessários ao projeto.' },
      { pergunta: 'É preciso definir o local da instalação antes de conversar?', resposta: 'Não. Você pode apresentar as possibilidades e esclarecer com a equipe o que precisa ser avaliado tecnicamente.' },
    ],
    mensagemDoWhatsApp: 'Olá! Tenho interesse em energia solar rural e gostaria de mais informações.',
    foto: '11',
  },
  {
    slug: 'usina-de-investimento',
    titulo: 'Usina de investimento',
    nome: 'Usina de investimento em energia solar',
    intro: 'Objetivo, localização e condições do projeto precisam de uma avaliação específica.',
    resumo: 'Avaliação de projetos de geração solar com foco em usinas de investimento.',
    abertura: 'Antes de investir, entender o projeto.',
    contexto: 'Viabilidade exige mais do que área disponível.',
    necessidade: 'Uma usina exige uma avaliação específica do local, do projeto e das condições de implantação. Antes de uma decisão, é necessário entender o escopo e as premissas do estudo.',
    solucao: 'Apresente os objetivos e as informações disponíveis sobre o local. Escopo do estudo, condições de implantação, premissas e responsabilidades precisam ser esclarecidos antes de qualquer projeção financeira. Esta página não oferece garantia de rentabilidade.',
    pontos: ['Objetivos e características do projeto', 'Condições do local e da implantação', 'Premissas e escopo da avaliação'],
    etapas: [
      { titulo: 'Apresente o objetivo', texto: 'Informe a cidade e o objetivo do projeto de geração solar.' },
      { titulo: 'Descreva a área', texto: 'Conte quais informações sobre o local já estão disponíveis.' },
      { titulo: 'Liste o que precisa esclarecer', texto: 'Converse sobre escopo, conexão, custos e premissas da avaliação.' },
    ],
    perguntas: [
      { pergunta: 'Existe um retorno financeiro garantido?', resposta: 'Não é possível afirmar um retorno fixo nesta página. A avaliação depende das condições e premissas específicas do projeto, que precisam ser apresentadas e analisadas.' },
      { pergunta: 'Já preciso ter um terreno definido?', resposta: 'Você pode iniciar a conversa informando seu objetivo e as opções disponíveis. A equipe indicará quais informações sobre o local serão necessárias à avaliação.' },
      { pergunta: 'Quais informações devo enviar no primeiro contato?', resposta: 'Informe seu nome, telefone e cidade, selecione usina de investimento e conte mais sobre seu objetivo durante a conversa no WhatsApp.' },
    ],
    mensagemDoWhatsApp: 'Olá! Tenho interesse em usina de investimento em energia solar e gostaria de mais informações.',
    foto: '06',
  },
];
