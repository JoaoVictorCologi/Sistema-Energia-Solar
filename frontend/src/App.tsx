import { createBrowserRouter, Navigate, Outlet, RouterProvider, ScrollRestoration, type RouteObject } from 'react-router';
import { LayoutPublico } from './components/publico/LayoutPublico.tsx';
import { RotaProtegida } from './components/RotaProtegida.tsx';
import { AuthProvider } from './contexts/AuthContext.tsx';
import { rotasAdminDosModulos, rotasPublicasDosModulos, type RotaDeModulo } from './modulos/index.ts';
import { Clientes } from './pages/admin/Clientes.tsx';
import { DetalheDoCliente } from './pages/admin/DetalheDoCliente.tsx';
import { Equipamentos } from './pages/admin/Equipamentos.tsx';
import { Importacoes } from './pages/admin/Importacoes.tsx';
import { LayoutAdmin } from './pages/admin/LayoutAdmin.tsx';
import { Login } from './pages/admin/Login.tsx';
import { NaoEncontradaAdmin } from './pages/admin/NaoEncontradaAdmin.tsx';
import { Painel } from './pages/admin/Painel.tsx';
import { Propostas } from './pages/admin/Propostas.tsx';
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
  // Carregada só quando aberta: o Recharts do gráfico não pesa nas outras páginas.
  {
    path: '/simulador/resultado',
    lazy: async () => ({ Component: (await import('./pages/publico/ResultadoSimulacao.tsx')).ResultadoSimulacao }),
  },
  { path: '/metodologia', element: <Metodologia /> },
  { path: '/solucoes', element: <Solucoes /> },
  { path: '/solucoes/:slug', element: <DetalheSolucao /> },
  { path: '/projetos', element: <Projetos /> },
  { path: '/privacidade', element: <Privacidade /> },
  ...rotasPublicasDosModulos.map(comoRota),
  { path: '*', element: <NaoEncontrada /> },
];

// Telas do administrador do núcleo (Plano 1, tarefas 13 a 15).
const telasDoNucleo: RouteObject[] = [
  { path: 'clientes', element: <Clientes /> },
  { path: 'clientes/:id', element: <DetalheDoCliente /> },
  { path: 'propostas', element: <Propostas /> },
  // Com o gráfico (Recharts): carregada só quando aberta.
  { path: 'propostas/:id', lazy: async () => ({ Component: (await import('./pages/admin/DetalheDaProposta.tsx')).DetalheDaProposta }) },
  { path: 'equipamentos', element: <Equipamentos /> },
  { path: 'importacoes', element: <Importacoes /> },
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
          ...telasDoNucleo,
          ...rotasAdminDosModulos.map(comoRota),
          { path: '*', element: <NaoEncontradaAdmin /> },
        ],
      }],
    },
  ],
};

function CarregandoPagina() {
  return <p role="status" className="p-10 text-sm text-muted-foreground">Carregando…</p>;
}

function Raiz() {
  return (
    <>
      <ScrollRestoration />
      <Outlet />
    </>
  );
}

const roteador = createBrowserRouter([
  // HydrateFallback: o que aparece enquanto o código de uma rota sob demanda (resultado, proposta) chega na primeira abertura.
  { element: <Raiz />, HydrateFallback: CarregandoPagina, children: [{ element: <LayoutPublico />, children: rotasPublicas }, rotasDoAdmin] },
]);

export function App() {
  return <RouterProvider router={roteador} />;
}
