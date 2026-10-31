import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import * as api from '../services/api.ts';
import type { Usuario } from '../services/api.ts';

interface ValorDoAuth {
  usuario: Usuario | null;
  carregando: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
}

const AuthContext = createContext<ValorDoAuth | null>(null);

export const MENSAGEM_SO_ADMIN = 'Acesso restrito ao administrador.';

// O token fica no cookie HttpOnly; aqui guardamos só quem está logado, lido de /api/auth/me.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api.buscarUsuarioLogado()
      .then(setUsuario)
      .catch(() => setUsuario(null))
      .finally(() => setCarregando(false));
  }, []);

  async function entrar(email: string, senha: string) {
    const logado = await api.entrar(email, senha);
    // A área restrita é só do administrador: outro papel não fica com a sessão aberta.
    if (logado.papel !== 'admin') {
      await api.sair();
      throw new api.ErroDaApi(403, 'SEM_PERMISSAO', MENSAGEM_SO_ADMIN);
    }
    setUsuario(logado);
  }

  async function sair() {
    await api.sair();
    setUsuario(null);
  }

  return <AuthContext value={{ usuario, carregando, entrar, sair }}>{children}</AuthContext>;
}

export function useAuth(): ValorDoAuth {
  const valor = use(AuthContext);
  if (!valor) throw new Error('useAuth precisa estar dentro de <AuthProvider>.');
  return valor;
}
