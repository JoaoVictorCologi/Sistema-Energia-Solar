import { EmConstrucao } from '../../components/EmConstrucao.tsx';
import type { ModuloDoFrontend } from '../index.ts';

// Plano 5 — Bandeiras e distribuidoras. Por enquanto só a navegação: a tela de verdade entra junto com a API do módulo.
export const moduloTarifas: ModuloDoFrontend = {
  rotasAdmin: [{
    caminho: '/admin/tarifas',
    elemento: (
      <EmConstrucao
        titulo="Tarifas" origem="Plano 5 · Bandeiras e distribuidoras"
        descricao="Histórico das bandeiras tarifárias e a distribuidora de cada município, com a escolha da principal onde houver mais de uma e o botão para atualizar os dados."
      />
    ),
  }],
  menuAdmin: [{ rotulo: 'Tarifas', caminho: '/admin/tarifas' }],
};
