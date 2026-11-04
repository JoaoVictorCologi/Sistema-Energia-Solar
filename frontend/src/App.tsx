// Declaração de todas as rotas da aplicação: site público, simulador e área restrita.
import { createBrowserRouter, Navigate, Outlet, RouterProvider, ScrollRestoration, type RouteObject } from 'react-router';
import { LayoutPublico } from './components/publico/LayoutPublico.tsx';
import { RotaDoNivel, RotaProtegida } from './components/RotaProtegida.tsx';
import { AuthProvider } from './contexts/AuthContext.tsx';
import { rotasAdminDosModulos, rotasPublicasDosModulos, type RotaDeModulo } from './modulos/index.ts';
import { Clientes } from './pages/admin/Clientes.tsx';
import { Configuracoes } from './pages/admin/Configuracoes.tsx';
import { DetalheDoCliente } from './pages/admin/DetalheDoCliente.tsx';
import { Equipamentos } from './pages/admin/Equipamentos.tsx';
import { Importacoes } from './pages/admin/Importacoes.tsx';
import { LayoutAdmin } from './pages/admin/LayoutAdmin.tsx';
import { Login } from './pages/admin/Login.tsx';
import { NaoEncontradaAdmin } from './pages/admin/NaoEncontradaAdmin.tsx';
import { Painel } from './pages/admin/Painel.tsx';
import { Propostas } from './pages/admin/Propostas.tsx';
import { Simulacoes } from './pages/admin/Simulacoes.tsx';
import { Usuarios } from './pages/admin/Usuarios.tsx';
import { DetalheSolucao } from './pages/publico/DetalheSolucao.tsx';
import { Metodologia } from './pages/publico/Metodologia.tsx';
import { NaoEncontrada } from './pages/publico/NaoEncontrada.tsx';
import { Privacidade } from './pages/publico/Privacidade.tsx';
import { Projetos } from './pages/publico/Projetos.tsx';
import { Simulador } from './pages/publico/Simulador.tsx';
import { Solucoes } from './pages/publico/Solucoes.tsx';

// Converte a rota declarada por um módulo para o formato do React Router.
function comoRota({ caminho, elemento }: RotaDeModulo): RouteObject {
  return { path: caminho, element: elemento };
}

// Sem um módulo que registre a página inicial, a raiz redireciona para o simulador.
const inicioDoSite: RouteObject[] = rotasPublicasDosModulos.some((rota) => rota.caminho === '/')
  ? []
  : [{ path: '/', element: <Navigate to="/simulador" replace /> }];

const rotasPublicas: RouteObject[] = [
  ...inicioDoSite,
  { path: '/simulador', element: <Simulador /> },
  // Rota sob demanda: o Recharts, usado nos gráficos, não entra no carregamento das demais páginas.
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

// Telas da equipe mantidas pelo núcleo. O acesso a cada grupo segue o nível exigido do papel.
const telasDoNucleo: RouteObject[] = [
  { path: 'clientes', element: <Clientes /> },
  { path: 'clientes/:id', element: <DetalheDoCliente /> },
  { path: 'simulacoes', element: <Simulacoes /> },
  { path: 'propostas', element: <Propostas /> },
  // Rota sob demanda, pelo mesmo motivo do resultado da simulação: contém gráfico.
  { path: 'propostas/:id', lazy: async () => ({ Component: (await import('./pages/admin/DetalheDaProposta.tsx')).DetalheDaProposta }) },
  {
    element: <RotaDoNivel nivel="gestao" />,
    children: [
      { path: 'equipamentos', element: <Equipamentos /> },
      { path: 'configuracoes', element: <Configuracoes /> },
      { path: 'usuarios', element: <Usuarios /> },
    ],
  },
  { element: <RotaDoNivel nivel="admin" />, children: [{ path: 'importacoes', element: <Importacoes /> }] },
];

// O AuthProvider envolve apenas a área restrita, para as páginas públicas não consultarem /api/auth/me.
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

// Raiz comum às duas áreas: restaura a posição de rolagem a cada navegação.
function Raiz() {
  return (
    <>
      <ScrollRestoration />
      <Outlet />
    </>
  );
}

const roteador = createBrowserRouter([
  // HydrateFallback: exibido enquanto o código de uma rota sob demanda é carregado pela primeira vez.
  { element: <Raiz />, HydrateFallback: CarregandoPagina, children: [{ element: <LayoutPublico />, children: rotasPublicas }, rotasDoAdmin] },
]);

export function App() {
  return <RouterProvider router={roteador} />;
}
