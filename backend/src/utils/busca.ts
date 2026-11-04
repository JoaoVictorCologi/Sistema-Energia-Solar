// % e _ digitados na busca valem como texto, não como curinga do LIKE.
export function comoTrechoDoLike(texto: string): string {
  return `%${texto.replace(/[\\%_]/g, (caractere) => `\\${caractere}`)}%`;
}
