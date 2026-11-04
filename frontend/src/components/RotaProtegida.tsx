import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../contexts/AuthContext.tsx';
import { ehDaEquipe, temAcesso, type NivelDeAcesso } from '../utils/papeis.ts';

// Sem sessão da equipe, redireciona ao login e guarda a página pedida para retornar depois.
export function RotaProtegida() {
  const { usuario, carregando } = useAuth();
  const local = useLocation();

  if (carregando) return <p role="status" className="p-10 text-sm text-muted-foreground">Carregando…</p>;
  if (!ehDaEquipe(usuario?.papel)) {
    return <Navigate to="/admin/login" replace state={{ de: local.pathname + local.search }} />;
  }
  return <Outlet />;
}

// Tela aberta por quem não tem o papel exigido (por um link salvo, por exemplo): explica o motivo em vez de exibir um erro 403.
export function RotaDoNivel({ nivel }: { nivel: NivelDeAcesso }) {
  const { usuario } = useAuth();
  if (temAcesso(usuario?.papel, nivel)) return <Outlet />;
  return (
    <>
      <h1 className="font-heading text-3xl font-medium tracking-tight text-brand-blue">Sem permissão</h1>
      <p className="mt-3 text-sm text-muted-foreground">Esta tela é da gestão. Se precisar dela, fale com o gestor da equipe.</p>
    </>
  );
}
