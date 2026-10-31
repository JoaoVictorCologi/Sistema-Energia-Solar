// Uma interface por tabela do núcleo, com os tipos que o driver pg devolve.

export type Papel = 'admin' | 'usuario';

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  senha_hash: string;
  papel: Papel;
  criado_em: Date;
  atualizado_em: Date;
}
