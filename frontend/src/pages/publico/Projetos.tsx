import { ChamadaFinal } from '../../components/publico/ChamadaFinal.tsx';
import { GaleriaFotos } from '../../components/publico/GaleriaFotos.tsx';
import { fotosDoAcervo } from '../../dados/fotos.ts';
import { useTituloDaPagina } from '../../hooks/useTituloDaPagina.ts';

export function Projetos() {
  useTituloDaPagina('Projetos — Don Energy');

  return (
    <>
      <section className="site-shell pt-14 pb-12 md:pt-20 md:pb-16">
        <p className="site-eyebrow">Portfólio · Acervo Don Energy</p>
        <h1 className="max-w-3xl font-heading text-4xl leading-tight font-medium tracking-[-0.04em] text-brand-blue sm:text-5xl">
          A energia solar<br /> em imagens.
        </h1>
        <p className="mt-7 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Fotografias de instalações solares, com diferentes perspectivas e detalhes. Conheça o acervo e converse com a Don Energy sobre o seu projeto.
        </p>
      </section>

      <section aria-labelledby="titulo-do-acervo" className="site-shell pb-20 md:pb-24">
        <div className="mb-9 flex flex-col justify-between gap-4 border-t border-border pt-8 sm:flex-row sm:items-end">
          <h2 id="titulo-do-acervo" className="font-heading text-2xl font-medium tracking-tight text-brand-blue">Um olhar para as instalações.</h2>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">Escolha uma fotografia para ver o enquadramento completo.</p>
        </div>
        <GaleriaFotos fotos={fotosDoAcervo} />
      </section>

      <ChamadaFinal />
    </>
  );
}
