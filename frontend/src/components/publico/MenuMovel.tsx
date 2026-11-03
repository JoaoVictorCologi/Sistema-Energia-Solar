import { LockKeyhole, Menu, X } from 'lucide-react';
import { useEffect, useRef, type MouseEvent } from 'react';
import { Link, NavLink } from 'react-router';
import { linkDoWhatsApp } from '../../dados/empresa.ts';
import type { ItemDeMenu } from '../../modulos/index.ts';

// <dialog> nativo: prende o foco, fecha com Esc e devolve o foco ao botão que o abriu.
export function MenuMovel({ itens }: { itens: ItemDeMenu[] }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const fechar = () => dialogo.current?.close();

  useEffect(() => {
    // Ao ampliar a tela, o menu de celular some; um diálogo aberto e invisível prenderia o foco.
    const telaGrande = window.matchMedia('(min-width: 768px)');
    const fecharNaTelaGrande = () => { if (telaGrande.matches) dialogo.current?.close(); };
    telaGrande.addEventListener('change', fecharNaTelaGrande);
    return () => telaGrande.removeEventListener('change', fecharNaTelaGrande);
  }, []);

  function fecharAoClicarFora(evento: MouseEvent<HTMLDialogElement>) {
    if (evento.target === dialogo.current) fechar();
  }

  return (
    <>
      <button
        type="button" aria-haspopup="dialog" aria-label="Abrir menu" onClick={() => dialogo.current?.showModal()}
        className="flex size-11 items-center justify-center rounded-md border border-white/40 md:hidden"
      >
        <Menu aria-hidden="true" className="size-5" />
      </button>
      <dialog
        ref={dialogo} aria-label="Menu de navegação" onClick={fecharAoClicarFora}
        className="fixed inset-y-0 right-0 left-auto m-0 h-svh max-h-none w-72 max-w-[85vw] bg-brand-deep text-white backdrop:bg-brand-deep/70 md:hidden"
      >
        <div className="flex h-full flex-col gap-4 p-6">
          <button
            type="button" onClick={fechar}
            className="inline-flex min-h-11 items-center justify-between rounded-sm border border-white/40 px-4 text-sm font-semibold"
          >
            Fechar menu <X aria-hidden="true" className="size-5" />
          </button>
          <nav aria-label="Navegação no celular" className="flex flex-col gap-1">
            {itens.map((item) => (
              <NavLink
                key={item.caminho} to={item.caminho} end={item.caminho === '/'} onClick={fechar}
                className="flex min-h-11 items-center rounded-sm px-3 text-base font-medium hover:bg-white/10 aria-[current=page]:underline aria-[current=page]:underline-offset-8"
              >
                {item.rotulo}
              </NavLink>
            ))}
            <a
              href={linkDoWhatsApp()} target="_blank" rel="noopener noreferrer" onClick={fechar}
              className="mt-3 flex min-h-11 items-center rounded-sm bg-brand-orange px-3 text-base font-semibold text-brand-ink"
            >
              Falar no WhatsApp
            </a>
            <Link
              to="/admin" onClick={fechar}
              className="mt-1 flex min-h-11 items-center gap-2 rounded-sm border border-white/40 px-3 text-base font-semibold hover:bg-white/10"
            >
              <LockKeyhole aria-hidden="true" className="size-4" /> Área restrita
            </Link>
          </nav>
        </div>
      </dialog>
    </>
  );
}
