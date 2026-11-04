// Formatação para exibição. Os números chegam calculados e arredondados pelo backend.

const reais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const reaisSemCentavos = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const percentual = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 2 });
const mesAbreviado = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' });
const data = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });

export function formatarReais(valor: number, semCentavos = false): string {
  return (semCentavos ? reaisSemCentavos : reais).format(valor);
}

const reaisCurto = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 0 });

// "R$ 150 mil": para eixos de gráfico; o valor exato fica na dica e na tabela.
export function formatarReaisCurto(valor: number): string {
  return reaisCurto.format(valor);
}

export function formatarNumero(valor: number, casas = 0): string {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export function formatarPercentual(fracao: number): string {
  return percentual.format(fracao);
}

// null: o investimento não se paga dentro do horizonte de 25 anos.
export function formatarAnos(anos: number | null): string {
  if (anos === null) return 'Acima de 25 anos';
  return `${formatarNumero(anos, 1)} ${anos === 1 ? 'ano' : 'anos'}`;
}

// "dez/26": rótulo curto para o eixo do gráfico.
export function rotuloDoMes(ano: number, mes: number): string {
  const nome = mesAbreviado.format(new Date(Date.UTC(ano, mes - 1, 1))).replace('.', '');
  return `${nome}/${String(ano).slice(2)}`;
}

// Datas sem hora chegam da API como 'AAAA-MM-DD'.
export function formatarData(texto: string): string {
  return data.format(new Date(`${texto}T00:00:00Z`));
}

const dataEHora = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
const dataDeSaoPaulo = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' });

// Instantes chegam da API em ISO (UTC) e são exibidos no horário de São Paulo.
export function formatarDataEHora(iso: string | null): string {
  return iso ? dataEHora.format(new Date(iso)) : '—';
}

export function formatarDiaDoInstante(iso: string): string {
  return dataDeSaoPaulo.format(new Date(iso));
}
