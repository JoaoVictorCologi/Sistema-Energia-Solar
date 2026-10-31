import { useRef, useState, type MouseEvent } from 'react';
import { caminhoDoPortfolio, LEGENDA_DO_ACERVO, srcSetDoPortfolio, type Foto } from '../../dados/fotos.ts';

const tamanhosDaMiniatura = '(min-width: 1200px) 350px, (min-width: 1024px) 30vw, (min-width: 768px) 45vw, 100vw';

// Grade de miniaturas; a foto escolhida abre ampliada num <dialog> nativo (Esc fecha e o foco volta à miniatura).
export function GaleriaFotos({ fotos }: { fotos: Foto[] }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [ampliada, setAmpliada] = useState<Foto | null>(null);

  function ampliar(foto: Foto) {
    setAmpliada(foto);
    dialogo.current?.showModal();
  }

  function fecharAoClicarFora(evento: MouseEvent<HTMLDialogElement>) {
    if (evento.target === dialogo.current) dialogo.current.close();
  }

  return (
    <>
      <div className="grid gap-x-7 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
        {fotos.map((foto) => (
          <figure key={foto.numero}>
            <button
              type="button" onClick={() => ampliar(foto)} aria-haspopup="dialog"
              aria-label={`Ampliar fotografia ${foto.numero}: ${foto.alt}`}
              className="group relative block w-full overflow-hidden rounded-md bg-brand-soft text-brand-blue"
            >
              <img
                src={caminhoDoPortfolio(foto, 480)} srcSet={srcSetDoPortfolio(foto)} sizes={tamanhosDaMiniatura}
                width={480} height={Math.round((480 * foto.altura) / foto.largura)} alt="" loading="lazy" decoding="async"
                className="aspect-[3/2] w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none"
              />
              <span className="absolute right-3 bottom-3 inline-flex min-h-11 items-center gap-3 rounded-sm bg-brand-deep px-4 text-xs font-semibold text-white">
                Ampliar <span aria-hidden="true">↗</span>
              </span>
            </button>
            <figcaption className="mt-4 text-xs leading-relaxed text-muted-foreground">{LEGENDA_DO_ACERVO}</figcaption>
          </figure>
        ))}
      </div>

      <dialog
        ref={dialogo} onClose={() => setAmpliada(null)} onClick={fecharAoClicarFora} aria-labelledby="titulo-da-foto"
        className="m-auto max-h-[calc(100%-2rem)] w-[calc(100%-2rem)] max-w-6xl overflow-auto rounded-md border border-white/20 bg-brand-deep text-white shadow-xl backdrop:bg-brand-deep/85"
      >
        {ampliada && (
          <>
            <div className="flex flex-col items-start justify-between gap-3 border-b border-white/20 px-4 py-3 sm:flex-row sm:items-center sm:px-6">
              <h2 id="titulo-da-foto" className="font-heading text-base font-medium">Fotografia {ampliada.numero}</h2>
              <button
                type="button" autoFocus onClick={() => dialogo.current?.close()} aria-label="Fechar fotografia"
                className="inline-flex min-h-11 shrink-0 items-center rounded-sm border border-white/60 px-4 text-sm font-semibold hover:bg-white/10"
              >
                Fechar <span aria-hidden="true" className="ml-3">×</span>
              </button>
            </div>
            <figure className="p-3 sm:p-5">
              <img
                src={caminhoDoPortfolio(ampliada, 1440)} srcSet={srcSetDoPortfolio(ampliada)} sizes="(min-width: 1200px) 1100px, 95vw"
                width={1440} height={Math.round((1440 * ampliada.altura) / ampliada.largura)} alt={ampliada.alt}
                className="max-h-[70svh] w-full object-contain"
              />
              <figcaption className="pt-4 text-center text-xs leading-relaxed text-white/90">{LEGENDA_DO_ACERVO}</figcaption>
            </figure>
          </>
        )}
      </dialog>
    </>
  );
}
