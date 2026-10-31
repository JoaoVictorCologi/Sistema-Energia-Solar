import { LockKeyhole } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { empresa, linkDoWhatsApp } from '../../dados/empresa.ts';
import { menuPublicoDosModulos, ordenarMenu, type ItemDeMenu } from '../../modulos/index.ts';
import { MenuMovel } from './MenuMovel.tsx';

const menuDoNucleo: ItemDeMenu[] = [
  { rotulo: 'Soluções', caminho: '/solucoes', ordem: 20 },
  { rotulo: 'Projetos', caminho: '/projetos', ordem: 30 },
  { rotulo: 'Simulador', caminho: '/simulador', ordem: 40 },
];

export const itensDoMenuPublico = ordenarMenu([...menuDoNucleo, ...menuPublicoDosModulos]);

const classeDoItemDeMenu =
  'inline-flex min-h-11 items-center rounded-sm text-sm font-medium underline-offset-8 hover:underline aria-[current=page]:underline';

function observarRolagem(aoMudar: () => void) {
  window.addEventListener('scroll', aoMudar, { passive: true });
  return () => window.removeEventListener('scroll', aoMudar);
}

const rolouAlem16px = () => window.scrollY > 16;

// Transparente só sobre a foto da página inicial e com a página no topo; nas demais, sólido desde o início.
export function Cabecalho() {
  const { pathname } = useLocation();
  const naInicial = pathname === '/';
  const rolou = useSyncExternalStore(observarRolagem, rolouAlem16px);
  const solido = !naInicial || rolou;

  return (
    <>
      <header
        className={
          'fixed inset-x-0 top-0 z-50 text-white transition-[background-color,box-shadow] duration-200 motion-reduce:transition-none ' +
          (solido ? 'bg-brand-blue-header shadow-sm' : 'bg-transparent')
        }
      >
        <div className="site-shell flex items-center justify-between gap-4 py-[var(--header-py)]">
          <Link to="/" aria-label="Don Energy — página inicial" className="flex min-h-11 items-center rounded-sm">
            <img
              src={empresa.logo.src} alt="Don Energy" width={empresa.logo.largura} height={empresa.logo.altura}
              className="h-[var(--header-logo-size)] w-auto object-contain"
            />
          </Link>
          <nav aria-label="Navegação principal" className="hidden items-center gap-3 md:flex lg:gap-5">
            {itensDoMenuPublico.map((item) => (
              <NavLink key={item.caminho} to={item.caminho} end={item.caminho === '/'} className={classeDoItemDeMenu}>{item.rotulo}</NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            {/* Entre 768 e 1024 px só o cadeado, para o cabeçalho caber numa linha. */}
            <Link
              to="/admin" aria-label="Área restrita"
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md border border-white/40 px-3 text-sm font-semibold hover:bg-white/10"
            >
              <LockKeyhole aria-hidden="true" className="size-4" />
              <span aria-hidden="true" className="hidden lg:inline">Área restrita</span>
            </Link>
            <a
              href={linkDoWhatsApp()} target="_blank" rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center rounded-md bg-brand-orange px-4 text-sm font-semibold text-brand-ink hover:bg-brand-orange/90"
            >
              Falar no WhatsApp
            </a>
          </div>
          <MenuMovel itens={itensDoMenuPublico} />
        </div>
      </header>
      {/* Nas páginas internas, reserva a altura do cabeçalho fixo para o conteúdo não ficar por baixo. */}
      {!naInicial && <div aria-hidden="true" className="h-[var(--header-height)] shrink-0" />}
    </>
  );
}
