import { createBrowserRouter, Navigate, Outlet, RouterProvider, ScrollRestoration, type RouteObject } from 'react-router';
import { EmConstrucao } from './components/EmConstrucao.tsx';
import { LayoutPublico } from './components/publico/LayoutPublico.tsx';
import { RotaProtegida } from './components/RotaProtegida.tsx';
import { AuthProvider } from './contexts/AuthContext.tsx';
import { rotasAdminDosModulos, rotasPublicasDosModulos, type RotaDeModulo } from './modulos/index.ts';
import { LayoutAdmin } from './pages/admin/LayoutAdmin.tsx';
import { Login } from './pages/admin/Login.tsx';
import { NaoEncontradaAdmin } from './pages/admin/NaoEncontradaAdmin.tsx';
import { Painel } from './pages/admin/Painel.tsx';
import { DetalheSolucao } from './pages/publico/DetalheSolucao.tsx';
import { Metodologia } from './pages/publico/Metodologia.tsx';
import { NaoEncontrada } from './pages/publico/NaoEncontrada.tsx';
import { Privacidade } from './pages/publico/Privacidade.tsx';
import { Projetos } from './pages/publico/Projetos.tsx';
import { Simulador } from './pages/publico/Simulador.tsx';
import { Solucoes } from './pages/publico/Solucoes.tsx';

function comoRota({ caminho, elemento }: RotaDeModulo): RouteObject {
  return { path: caminho, element: elemento };
}

// Enquanto nenhum módulo registra a página inicial, '/' leva ao simulador (AGENTS.md, regra 7 dos planos).
const inicioDoSite: RouteObject[] = rotasPublicasDosModulos.some((rota) => rota.caminho === '/')
  ? []
  : [{ path: '/', element: <Navigate to="/simulador" replace /> }];

const rotasPublicas: RouteObject[] = [
  ...inicioDoSite,
  { path: '/simulador', element: <Simulador /> },
  { path: '/metodologia', element: <Metodologia /> },
  { path: '/solucoes', element: <Solucoes /> },
  { path: '/solucoes/:slug', element: <DetalheSolucao /> },
  { path: '/projetos', element: <Projetos /> },
  { path: '/privacidade', element: <Privacidade /> },
  ...rotasPublicasDosModulos.map(comoRota),
  { path: '*', element: <NaoEncontrada /> },
];

// Telas do Plano 1 que ainda esperam a API; cada uma troca pela tela de verdade na sua tarefa.
const telasProvisoriasDoNucleo: RouteObject[] = [
  {
    path: 'clientes',
    element: <EmConstrucao titulo="Clientes" origem="Plano 1 · tarefa 13" descricao="Lista com busca por nome ou e-mail e paginação; no detalhe, os dados de contato, as simulações e as propostas de cada cliente." />,
  },
  {
    path: 'propostas',
    element: <EmConstrucao titulo="Propostas" origem="Plano 1 · tarefa 14" descricao="Proposta gerada a partir de uma simulação, com o preço dos equipamentos calculado no servidor, status (enviada, aceita, recusada) e página de impressão." />,
  },
  {
    path: 'importacoes',
    element: <EmConstrucao titulo="Importações" origem="Plano 1 · tarefas 6 e 15" descricao="Última execução de cada importação (ANEEL, Banco Central e as dos módulos), com status, aviso de dado desatualizado e o botão “atualizar agora”." />,
  },
];

// O AuthProvider fica só na área restrita: as páginas públicas não consultam /api/auth/me.
const rotasDoAdmin: RouteObject = {
  path: '/admin',
  element: <AuthProvider><Outlet /></AuthProvider>,
  children: [
    { path: 'login', element: <Login /> },
    {
      element: <RotaProtegida />,
      children: [{
        element: <LayoutAdmin />,
        children: [
          { index: true, element: <Painel /> },
          ...telasProvisoriasDoNucleo,
          ...rotasAdminDosModulos.map(comoRota),
          { path: '*', element: <NaoEncontradaAdmin /> },
        ],
      }],
    },
  ],
};

function Raiz() {
  return (
    <>
      <ScrollRestoration />
      <Outlet />
    </>
  );
}

const roteador = createBrowserRouter([
  { element: <Raiz />, children: [{ element: <LayoutPublico />, children: rotasPublicas }, rotasDoAdmin] },
]);

export function App() {
  return <RouterProvider router={roteador} />;
}
