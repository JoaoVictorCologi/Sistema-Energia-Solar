import type { ReactElement } from 'react';

export interface RotaDeModulo {
  caminho: string;
  elemento: ReactElement;
}

export interface ItemDeMenu {
  rotulo: string;
  caminho: string;
}

export interface ModuloDoFrontend {
  rotas: RotaDeModulo[];
  menu: ItemDeMenu[];
}

// PONTO DE EXTENSÃO: cada módulo (Plano 2 em diante) acrescenta uma linha com as suas rotas e itens de menu do admin.
export const modulosDoFrontend: ModuloDoFrontend[] = [
];
