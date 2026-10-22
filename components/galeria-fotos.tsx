import type { Foto } from "@/lib/fotos-data";
import { ImagemPortfolio } from "@/components/imagem-portfolio";
import { AmpliacaoGaleria } from "@/components/ampliacao-galeria";

export function GaleriaFotos({ fotos, id = "galeria-acervo" }: { fotos: readonly Foto[]; id?: string }) {
  return (
    <div id={id}>
      <div className="grid gap-x-7 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
        {fotos.map(foto => (
          <figure key={foto.id}>
            <a href={foto.ampliacao} data-foto-id={foto.id} aria-haspopup="dialog" aria-label={"Ampliar fotografia " + foto.numero + ": " + foto.alt} className="group relative block overflow-hidden rounded-md bg-brand-soft focus-visible:outline-brand-blue">
              <ImagemPortfolio foto={foto} />
              <span className="absolute right-3 bottom-3 inline-flex min-h-11 items-center gap-3 rounded-sm bg-brand-deep px-4 text-xs font-semibold text-white">Ampliar <span aria-hidden="true">↗</span></span>
            </a>
            <figcaption className="mt-4 text-xs leading-relaxed text-muted-foreground">{foto.legenda}</figcaption>
          </figure>
        ))}
      </div>
      <AmpliacaoGaleria containerId={id} fotos={fotos} />
    </div>
  );
}
