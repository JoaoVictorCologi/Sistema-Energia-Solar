import { EmConstrucao } from '../../components/EmConstrucao.tsx';
import type { ModuloDoFrontend } from '../index.ts';

// Módulo de desempenho das usinas. Por enquanto, apenas a navegação: a tela definitiva entra junto com a API do módulo.
export const moduloDesempenho: ModuloDoFrontend = {
  rotasAdmin: [{
    caminho: '/admin/desempenho',
    elemento: (
      <EmConstrucao
        titulo="Desempenho" origem="Desempenho das usinas"
        descricao="Geração esperada pelo motor de cálculo × geração informada a cada mês, com gráfico por usina e alerta quando a usina fica abaixo de 80% do esperado."
      />
    ),
  }],
  menuAdmin: [{ rotulo: 'Desempenho', caminho: '/admin/desempenho' }],
};
