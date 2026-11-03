import { EmConstrucao } from '../../components/EmConstrucao.tsx';
import type { ModuloDoFrontend } from '../index.ts';

// Plano 4 — Desempenho das usinas. Por enquanto só a navegação: a tela de verdade entra junto com a API do módulo.
export const moduloDesempenho: ModuloDoFrontend = {
  rotasAdmin: [{
    caminho: '/admin/desempenho',
    elemento: (
      <EmConstrucao
        titulo="Desempenho" origem="Plano 4 · Desempenho das usinas"
        descricao="Geração esperada pelo motor de cálculo × geração informada a cada mês, com gráfico por usina e alerta quando a usina fica abaixo de 80% do esperado."
      />
    ),
  }],
  menuAdmin: [{ rotulo: 'Desempenho', caminho: '/admin/desempenho' }],
};
