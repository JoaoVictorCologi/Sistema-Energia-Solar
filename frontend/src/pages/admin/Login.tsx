import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { empresa } from '../../dados/empresa.ts';
import { useTituloDaPagina } from '../../hooks/useTituloDaPagina.ts';
import { ErroDaApi } from '../../services/api.ts';

const classeDoCampo =
  'mt-2 block min-h-12 w-full rounded-sm border border-border bg-white px-3 text-base text-brand-ink aria-[invalid=true]:border-red-700';

export function Login() {
  const { usuario, carregando, entrar } = useAuth();
  const local = useLocation();
  const destino = (local.state as { de?: string } | null)?.de ?? '/admin';
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<ErroDaApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  useTituloDaPagina('Entrar — Solar Gestão');

  // Depois do login (ou se a sessão já existe), o próprio estado do AuthContext faz o redirecionamento.
  if (!carregando && usuario?.papel === 'admin') return <Navigate to={destino} replace />;

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    // Campo vazio nem vai ao servidor: não gasta uma das 5 tentativas de login.
    const camposVazios: Record<string, string> = {};
    if (!email.trim()) camposVazios.email = 'Informe o e-mail.';
    if (!senha) camposVazios.senha = 'Informe a senha.';
    if (Object.keys(camposVazios).length > 0) {
      setErro(new ErroDaApi(400, 'ENTRADA_INVALIDA', 'Preencha os campos.', camposVazios));
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      await entrar(email.trim(), senha);
    } catch (falha) {
      setErro(falha instanceof ErroDaApi ? falha : new ErroDaApi(0, 'ERRO_INTERNO', 'Algo deu errado. Tente de novo.'));
    } finally {
      setEnviando(false);
    }
  }

  const erroDoEmail = erro?.campos.email;
  const erroDaSenha = erro?.campos.senha;

  return (
    <main id="conteudo" className="flex min-h-svh flex-col items-center justify-center bg-brand-deep px-6 py-12">
      <Link to="/" aria-label="Don Energy — voltar ao site" className="rounded-sm text-white">
        <img src={empresa.logo.src} alt="Don Energy" width={empresa.logo.largura} height={empresa.logo.altura} className="h-16 w-auto" />
      </Link>

      <form onSubmit={enviar} noValidate className="mt-8 w-full max-w-sm rounded-md bg-white p-6 shadow-lg sm:p-8">
        <h1 className="font-heading text-2xl font-medium tracking-tight text-brand-blue">Área do administrador</h1>
        <p className="mt-2 text-sm text-muted-foreground">Entre com o e-mail e a senha cadastrados.</p>

        {erro && !erroDoEmail && !erroDaSenha && (
          <p role="alert" className="mt-5 rounded-sm border border-red-700/30 bg-red-50 px-3 py-2 text-sm text-red-800">
            {erro.message}
          </p>
        )}

        <label htmlFor="email" className="mt-6 block text-sm font-semibold text-brand-ink">E-mail</label>
        <input
          id="email" type="email" autoComplete="username" required value={email}
          onChange={(evento) => setEmail(evento.target.value)}
          aria-invalid={Boolean(erroDoEmail)} aria-describedby={erroDoEmail ? 'erro-email' : undefined}
          className={classeDoCampo}
        />
        {erroDoEmail && <p id="erro-email" className="mt-1 text-sm text-red-800">{erroDoEmail}</p>}

        <label htmlFor="senha" className="mt-5 block text-sm font-semibold text-brand-ink">Senha</label>
        <input
          id="senha" type="password" autoComplete="current-password" required value={senha}
          onChange={(evento) => setSenha(evento.target.value)}
          aria-invalid={Boolean(erroDaSenha)} aria-describedby={erroDaSenha ? 'erro-senha' : undefined}
          className={classeDoCampo}
        />
        {erroDaSenha && <p id="erro-senha" className="mt-1 text-sm text-red-800">{erroDaSenha}</p>}

        <button type="submit" disabled={enviando} className="site-button mt-7 w-full disabled:opacity-70">
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}
