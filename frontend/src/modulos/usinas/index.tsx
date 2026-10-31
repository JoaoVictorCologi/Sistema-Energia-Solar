import { EmConstrucao } from '../../components/EmConstrucao.tsx';
import type { ModuloDoFrontend } from '../index.ts';

// Plano 2 — Usinas e alertas. Por enquanto só a navegação: a tela de verdade entra junto com a API do módulo.
export const moduloUsinas: ModuloDoFrontend = {
  rotasAdmin: [{
    caminho: '/admin/usinas',
    elemento: (
      <EmConstrucao
        titulo="Usinas" origem="Plano 2 · Usinas e alertas"
        descricao="Cadastro das usinas dos clientes, com equipamentos, número de série, garantias e regime GD I ou GD II, e a lista de pendências de limpeza e garantia gerada todos os dias."
      />
    ),
  }],
  menuAdmin: [{ rotulo: 'Usinas', caminho: '/admin/usinas' }],
};
