// Botão e diálogo de confirmação para desativar a usina. Desativar não apaga nada; a falta de reativação nesta versão não a torna irreversível por regra.
import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { Aviso, classeDoBotaoSecundario } from '../../components/admin/Pecas.tsx';
import { desativarUsina } from './api.ts';
import { comoErroDaApi } from './PecasDaUsina.tsx';
import type { UsinaDetalhada } from './tipos.ts';

// <dialog> nativo: Esc fecha sozinho, e o onClose devolve o foco ao botão de origem.
export function ConfirmarDesativacao({ idDaUsina, aoDesativar }: { idDaUsina: number; aoDesativar: (usina: UsinaDetalhada) => void }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const botaoDeOrigem = useRef<HTMLButtonElement>(null);
  const botaoCancelar = useRef<HTMLButtonElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // O botão de confirmar perde o foco ao ser desabilitado no envio: sem isto, o foco ficaria perdido depois do erro.
  useEffect(() => {
    if (erro) botaoCancelar.current?.focus();
  }, [erro]);

  // Cada abertura começa sem o erro da tentativa anterior.
  function abrir() {
    setErro(null);
    dialogo.current?.showModal();
  }

  // Fechar durante o envio esconderia o resultado do pedido ainda em curso.
  function impedirEscDuranteOEnvio(evento: SyntheticEvent<HTMLDialogElement>) {
    if (enviando) evento.preventDefault();
  }

  // Só avisa a tela depois de a API confirmar. Os botões desabilitados durante o envio evitam pedido duplicado.
  async function confirmar() {
    setEnviando(true);
    setErro(null);
    try {
      const usina = await desativarUsina(idDaUsina);
      dialogo.current?.close();
      aoDesativar(usina);
    } catch (falha) {
      setErro(comoErroDaApi(falha).message);
      // O navegador pode fechar o diálogo num segundo Esc, mesmo com o cancel impedido: o erro precisa continuar à vista.
      if (!dialogo.current?.open) dialogo.current?.showModal();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <button ref={botaoDeOrigem} type="button" aria-haspopup="dialog" onClick={abrir} className={classeDoBotaoSecundario}>
        Desativar
      </button>
      <dialog
        ref={dialogo} onClose={() => botaoDeOrigem.current?.focus()} onCancel={impedirEscDuranteOEnvio}
        aria-labelledby="titulo-desativar" aria-describedby="texto-desativar"
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-md bg-white p-6 text-brand-ink shadow-xl backdrop:bg-brand-deep/85"
      >
        <h2 id="titulo-desativar" className="font-heading text-xl font-medium text-brand-blue">Desativar esta usina?</h2>
        <p id="texto-desativar" className="mt-3 text-sm leading-relaxed">
          A usina sai das listagens de ativas. Dados, equipamentos e histórico são preservados. Esta versão não oferece reativação.
        </p>
        {erro && <div className="mt-4"><Aviso>{erro}</Aviso></div>}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button ref={botaoCancelar} type="button" disabled={enviando} onClick={() => dialogo.current?.close()} className={classeDoBotaoSecundario}>Cancelar</button>
          <button type="button" disabled={enviando} onClick={() => void confirmar()} className={classeDoBotaoSecundario}>{enviando ? 'Desativando…' : 'Desativar'}</button>
        </div>
      </dialog>
    </>
  );
}
