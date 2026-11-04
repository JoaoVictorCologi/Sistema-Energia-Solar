import { LogOut } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { empresa } from '../../dados/empresa.ts';
import { menuAdminDosModulos, ordenarMenu, type ItemDeMenu } from '../../modulos/index.ts';
import { ROTULOS_DO_PAPEL, temAcesso, type NivelDeAcesso } from '../../utils/papeis.ts';

// Itens do núcleo, filtrados pelo papel de quem está logado. Os itens dos módulos entram depois deles.
const menuDoNucleo: (ItemDeMenu & { nivel: NivelDeAcesso })[] = [
  { rotulo: 'Painel', caminho: '/admin', nivel: 'equipe' },
  { rotulo: 'Clientes', caminho: '/admin/clientes', nivel: 'equipe' },
  { rotulo: 'Simulações', caminho: '/admin/simulacoes', nivel: 'equipe' },
  { rotulo: 'Orçamentos', caminho: '/admin/propostas', nivel: 'equipe' },
  { rotulo: 'Equipamentos', caminho: '/admin/equipamentos', nivel: 'gestao' },
  { rotulo: 'Configurações', caminho: '/admin/configuracoes', nivel: 'gestao' },
  { rotulo: 'Usuários', caminho: '/admin/usuarios', nivel: 'gestao' },
  { rotulo: 'Importações', caminho: '/admin/importacoes', nivel: 'admin' },
];

export function LayoutAdmin() {
  const { usuario, sair } = useAuth();
  const [saindo, setSaindo] = useState(false);
  const itensDoMenu = ordenarMenu([...menuDoNucleo.filter((item) => temAcesso(usuario?.papel, item.nivel)), ...menuAdminDosModulos]);

  async function encerrarSessao() {
    setSaindo(true);
    // Em caso de sucesso, o usuário sai do contexto e o RotaProtegida leva ao login. Em caso de falha, o cookie continua válido e é possível tentar de novo.
    await sair().catch(() => setSaindo(false));
  }

  return (
    <div className="flex min-h-svh flex-col bg-brand-soft print:bg-white">
      <a href="#conteudo" className="sr-only fixed top-2 left-2 z-[100] rounded-md bg-white px-4 py-3 text-brand-blue focus:not-sr-only">
        Pular para o conteúdo
      </a>
      {/* Na impressão do orçamento, cabeçalho e menu saem, e fica apenas o documento. */}
      <header className="bg-brand-deep text-white print:hidden">
        <div className="site-shell flex flex-wrap items-center justify-between gap-x-8 gap-y-2 py-2">
          <div className="flex items-center gap-4">
            <img src={empresa.logo.src} alt="Don Energy" width={empresa.logo.largura} height={empresa.logo.altura} className="h-12 w-auto" />
            <span className="font-heading text-sm font-medium text-white/90">Solar Gestão</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-white/90">{usuario?.nome}{usuario && <span className="text-white/70"> · {ROTULOS_DO_PAPEL[usuario.papel]}</span>}</span>
            <button
              type="button" onClick={encerrarSessao} disabled={saindo}
              className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-white/60 px-4 font-semibold hover:bg-white/10"
            >
              <LogOut aria-hidden="true" className="size-4" /> Sair
            </button>
          </div>
        </div>
      </header>
      <div className="site-shell flex flex-1 flex-col gap-8 py-8 md:flex-row md:gap-12 print:max-w-none print:p-0">
        {/* No celular, os itens quebram em linhas; a partir de 768 px, formam uma coluna à esquerda. */}
        <nav aria-label="Menu da área restrita" className="md:w-48 md:shrink-0 print:hidden">
          <ul className="flex flex-wrap gap-2 md:flex-col">
            {itensDoMenu.map((item) => (
              <li key={item.caminho}>
                <NavLink
                  to={item.caminho} end={item.caminho === '/admin'}
                  className="flex min-h-11 items-center rounded-sm px-3 text-sm font-medium text-brand-ink hover:bg-white aria-[current=page]:bg-white aria-[current=page]:font-semibold aria-[current=page]:text-brand-blue aria-[current=page]:shadow-sm"
                >
                  {item.rotulo}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <main id="conteudo" tabIndex={-1} className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
