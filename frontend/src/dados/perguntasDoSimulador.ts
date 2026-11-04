import type { ContatoPreferido, HorasDeSol, Inclinacao, MelhorHorario, Orientacao, PerfilDeConsumo, TipoDePagamento, TipoDeTelhado } from '../services/api.ts';

// Rótulos das opções das perguntas do simulador, usados no formulário e na área restrita. Os fatores de cálculo ficam no backend.

export const NOMES_DO_PERFIL: Record<PerfilDeConsumo, string> = {
  noite: 'Mais à noite (passa o dia fora)',
  equilibrado: 'Dividido entre o dia e a noite',
  dia: 'Mais durante o dia (fica em casa ou é comércio)',
};

export const NOMES_DAS_HORAS: Record<HorasDeSol, string> = {
  diaTodo: 'O dia todo (mais de 8 h)',
  de6a8: 'De 6 a 8 horas',
  de4a6: 'De 4 a 6 horas',
  menosDe4: 'Menos de 4 horas',
};

export const NOMES_DA_ORIENTACAO: Record<Orientacao, string> = {
  norte: 'Norte', nordeste: 'Nordeste', noroeste: 'Noroeste', leste: 'Leste', oeste: 'Oeste',
  sudeste: 'Sudeste', sudoeste: 'Sudoeste', sul: 'Sul', plano: 'Laje plana',
};

export const NOMES_DA_INCLINACAO: Record<Inclinacao, string> = {
  plano: 'Quase plano (até 5°)',
  pouca: 'Pouca inclinação (5° a 10°)',
  media: 'Inclinação comum (10° a 30°)',
  muita: 'Bem inclinado (mais de 30°)',
};

export const NOMES_DO_TELHADO: Record<TipoDeTelhado, string> = {
  ceramica: 'Telha cerâmica', metalico: 'Telha metálica', fibrocimento: 'Fibrocimento', laje: 'Laje', solo: 'No solo',
};

export const NOMES_DO_PAGAMENTO: Record<TipoDePagamento, string> = { avista: 'À vista', parcelado: 'Parcelado', financiado: 'Financiado' };

export const NOMES_DO_CONTATO: Record<ContatoPreferido, string> = { whatsapp: 'WhatsApp', telefone: 'Telefone', email: 'E-mail' };

export const NOMES_DO_HORARIO: Record<MelhorHorario, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };

// Converte um mapa de nomes nas opções de um grupo de rádio, mantendo a ordem em que foram escritas.
export function comoOpcoes<Valor extends string>(nomes: Record<Valor, string>): { valor: Valor; rotulo: string }[] {
  return (Object.keys(nomes) as Valor[]).map((valor) => ({ valor, rotulo: nomes[valor] }));
}

export const NOMES_DOS_MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
