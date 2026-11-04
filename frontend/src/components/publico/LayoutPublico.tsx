import { Outlet } from 'react-router';
import { Cabecalho } from './Cabecalho.tsx';
import { Rodape } from './Rodape.tsx';
import { WhatsAppFlutuante } from './WhatsAppFlutuante.tsx';

// Estrutura comum das páginas públicas: cabeçalho, rodapé, atalho de WhatsApp e link para pular ao conteúdo.
export function LayoutPublico() {
  return (
    <div className="flex min-h-svh flex-col wrap-anywhere">
      <a href="#conteudo" className="sr-only fixed top-2 left-2 z-[100] rounded-md bg-white px-4 py-3 text-brand-blue focus:not-sr-only">
        Pular para o conteúdo
      </a>
      <Cabecalho />
      <main id="conteudo" tabIndex={-1} className="flex-1">
        <Outlet />
      </main>
      <Rodape />
      <WhatsAppFlutuante />
    </div>
  );
}
