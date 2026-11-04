import type { Papel } from '../services/api.ts';

// Níveis de acesso da área restrita. A interface apenas organiza a navegação: a permissão é conferida pelo backend, que responde 403.
export type NivelDeAcesso = 'equipe' | 'gestao' | 'admin';

const PAPEIS_DO_NIVEL: Record<NivelDeAcesso, Papel[]> = {
  equipe: ['admin', 'gestor', 'operador'],
  gestao: ['admin', 'gestor'],
  admin: ['admin'],
};

export function temAcesso(papel: Papel | undefined, nivel: NivelDeAcesso): boolean {
  return papel !== undefined && PAPEIS_DO_NIVEL[nivel].includes(papel);
}

export function ehDaEquipe(papel: Papel | undefined): boolean {
  return temAcesso(papel, 'equipe');
}

export const ROTULOS_DO_PAPEL: Record<Papel, string> = { admin: 'TI (administrador)', gestor: 'Gestor', operador: 'Operador' };
