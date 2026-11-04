import type { ModuloDoFrontend } from '../index.ts';
// As telas do módulo, ligadas à API de usinas.
import { DetalheDaUsina } from './DetalheDaUsina.tsx';
import { CadastroDeUsina, EdicaoDeUsina } from './FormularioDaUsina.tsx';
import { ListaDeUsinas } from './ListaDeUsinas.tsx';

// Plano 2 — Usinas e alertas.
export const moduloUsinas: ModuloDoFrontend = {
  // Rotas da área restrita: o núcleo as coloca atrás do login.
  rotasAdmin: [
    // Usinas ativas, com busca e página na URL.
    { caminho: '/admin/usinas', elemento: <ListaDeUsinas /> },
    // Caminho fixo: o roteador o prefere a /:id, então "nova" não é lido como id.
    { caminho: '/admin/usinas/nova', elemento: <CadastroDeUsina /> },
    // Detalhe com equipamentos e desativação, também para usina desativada.
    { caminho: '/admin/usinas/:id', elemento: <DetalheDaUsina /> },
    // Edição dos dados da usina; regime e status não são campos dela.
    { caminho: '/admin/usinas/:id/editar', elemento: <EdicaoDeUsina /> },
  ],
  menuAdmin: [{ rotulo: 'Usinas', caminho: '/admin/usinas' }],
};
