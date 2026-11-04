import { EmConstrucao } from '../../components/EmConstrucao.tsx';
import type { ModuloDoFrontend } from '../index.ts';

// Módulo de bandeiras e distribuidoras. Por enquanto, apenas a navegação: a tela definitiva entra junto com a API do módulo.
export const moduloTarifas: ModuloDoFrontend = {
  rotasAdmin: [{
    caminho: '/admin/tarifas',
    elemento: (
      <EmConstrucao
        titulo="Tarifas" origem="Bandeiras e distribuidoras"
        descricao="Histórico das bandeiras tarifárias e a distribuidora de cada município, com a escolha da principal onde houver mais de uma e o botão para atualizar os dados."
      />
    ),
  }],
  menuAdmin: [{ rotulo: 'Tarifas', caminho: '/admin/tarifas' }],
};
