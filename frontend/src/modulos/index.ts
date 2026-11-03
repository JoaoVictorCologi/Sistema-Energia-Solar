import type { ReactElement } from 'react';
import { moduloCatalogo } from './catalogo/index.tsx';
import { moduloDesempenho } from './desempenho/index.tsx';
import { moduloSite } from './site/index.tsx';
import { moduloTarifas } from './tarifas/index.tsx';
import { moduloUsinas } from './usinas/index.tsx';

export interface RotaDeModulo {
  caminho: string;
  elemento: ReactElement;
}

// `ordem` posiciona o item entre os do núcleo (menu público: Soluções 20, Projetos 30, Simulador 40).
// Sem `ordem`, o item vai para o fim, na ordem em que o módulo foi registrado.
export interface ItemDeMenu {
  rotulo: string;
  caminho: string;
  ordem?: number;
}

// Rotas públicas entram no layout do site (cabeçalho e rodapé), com caminho completo: '/sobre'.
// Rotas do admin entram em /admin, já protegidas pelo login, com caminho completo: '/admin/usinas'.
// Um módulo que registra '/' (Plano 6) substitui o redirecionamento padrão para o simulador.
export interface ModuloDoFrontend {
  rotasPublicas?: RotaDeModulo[];
  rotasAdmin?: RotaDeModulo[];
  menuPublico?: ItemDeMenu[];
  menuAdmin?: ItemDeMenu[];
}

// PONTO DE EXTENSÃO: cada módulo (Plano 2 em diante) acrescenta uma linha com as suas rotas e itens de menu.
export const modulosDoFrontend: ModuloDoFrontend[] = [
  moduloUsinas,
  moduloCatalogo,
  moduloDesempenho,
  moduloTarifas,
  moduloSite,
];

export const rotasPublicasDosModulos = modulosDoFrontend.flatMap((modulo) => modulo.rotasPublicas ?? []);
export const rotasAdminDosModulos = modulosDoFrontend.flatMap((modulo) => modulo.rotasAdmin ?? []);
export const menuPublicoDosModulos = modulosDoFrontend.flatMap((modulo) => modulo.menuPublico ?? []);
export const menuAdminDosModulos = modulosDoFrontend.flatMap((modulo) => modulo.menuAdmin ?? []);

const ORDEM_DO_FIM = 1000;

// A ordenação do JavaScript é estável: itens com a mesma ordem mantêm a ordem de registro.
export function ordenarMenu(itens: ItemDeMenu[]): ItemDeMenu[] {
  return [...itens].sort((a, b) => (a.ordem ?? ORDEM_DO_FIM) - (b.ordem ?? ORDEM_DO_FIM));
}
