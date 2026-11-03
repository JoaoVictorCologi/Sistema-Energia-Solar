// Datas de calendário ('AAAA-MM-DD') no fuso de São Paulo, usado pelo agendador e pelas importações.
// O banco guarda tudo em UTC; só o "que dia é hoje" depende do fuso.

const FUSO = 'America/Sao_Paulo';

export function hojeEmSaoPaulo(agora: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}

export function somarDias(data: string, dias: number): string {
  const [ano, mes, dia] = data.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

export function somarAnos(data: string, anos: number): string {
  const [ano, mes, dia] = data.split('-').map(Number);
  return new Date(Date.UTC(ano + anos, mes - 1, dia)).toISOString().slice(0, 10);
}

// '01/09/2026' (formato do Banco Central) → '2026-09-01'.
export function deDataBrasileira(data: string): string {
  const [dia, mes, ano] = data.split('/');
  return `${ano}-${mes}-${dia}`;
}

export function paraDataBrasileira(data: string): string {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}
