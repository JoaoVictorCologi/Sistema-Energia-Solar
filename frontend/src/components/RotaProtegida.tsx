import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../contexts/AuthContext.tsx';

// Sem sessão de administrador, manda para o login e guarda a página pedida para voltar depois.
export function RotaProtegida() {
  const { usuario, carregando } = useAuth();
  const local = useLocation();

  if (carregando) return <p role="status" className="p-10 text-sm text-muted-foreground">Carregando…</p>;
  if (usuario?.papel !== 'admin') {
    return <Navigate to="/admin/login" replace state={{ de: local.pathname + local.search }} />;
  }
  return <Outlet />;
}
