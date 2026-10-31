import { EmConstrucao } from '../../components/EmConstrucao.tsx';
import type { ModuloDoFrontend } from '../index.ts';

// Plano 3 — Catálogo de marcas. Por enquanto só a navegação: a tela de verdade entra junto com a API do módulo.
export const moduloCatalogo: ModuloDoFrontend = {
  rotasAdmin: [{
    caminho: '/admin/catalogo',
    elemento: (
      <EmConstrucao
        titulo="Catálogo" origem="Plano 3 · Catálogo de marcas"
        descricao="Marcas e produtos com que a empresa trabalha (módulos, inversores, estruturas e proteções), com especificações e ficha técnica, sem preço. A vitrine pública entra no menu do site junto com a API."
      />
    ),
  }],
  menuAdmin: [{ rotulo: 'Catálogo', caminho: '/admin/catalogo' }],
};
