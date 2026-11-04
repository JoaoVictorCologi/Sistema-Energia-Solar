// Leitura de campos digitados no formato brasileiro: "1.234,56" vira 1234.56; texto não numérico vira NaN.
// Apenas interpreta o campo: a validação definitiva e o cálculo são do backend, com Decimal.
export function lerNumero(texto: string): number {
  return Number(texto.trim().replace(/\./g, '').replace(',', '.'));
}

// Campo opcional: vazio vira undefined.
export function lerNumeroOpcional(texto: string): number | undefined {
  return texto.trim() === '' ? undefined : lerNumero(texto);
}

// Percentual digitado (78 ou 7,5) para a fração usada pela API (0.78 ou 0.075). O toFixed elimina resíduos de ponto flutuante.
export function percentualParaFracao(percentual: number): number {
  return Number((percentual / 100).toFixed(6));
}

// Fração da API para o campo de percentual: 0.075 vira "7,5".
export function fracaoParaCampo(fracao: number | null | undefined): string {
  if (fracao === null || fracao === undefined) return '';
  return String(Number((fracao * 100).toFixed(4))).replace('.', ',');
}
