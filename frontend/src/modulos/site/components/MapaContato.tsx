import { MapPin } from 'lucide-react';
import { useState } from 'react';
import { empresa, linkDaRota, linkDoMapaIncorporado } from '../../../dados/empresa.ts';

const endereco = `${empresa.endereco.linha1}, ${empresa.endereco.linha2}`;

// O mapa do Google só carrega quando o visitante pede: abrir o mapa conecta o navegador ao Google (ver Privacidade).
export function MapaContato() {
  const [visivel, setVisivel] = useState(false);

  return (
    <section aria-labelledby="titulo-da-localizacao" className="site-shell pb-20">
      <h2 id="titulo-da-localizacao" className="site-title">Onde estamos</h2>
      <p className="mt-4 leading-relaxed text-muted-foreground">{endereco}</p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        O mapa do Google só é carregado quando você escolher exibi-lo. Essa ação conecta seu navegador ao Google.
      </p>
      <div className="my-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        <button
          type="button" aria-expanded={visivel} aria-controls="mapa-da-localizacao" onClick={() => setVisivel((atual) => !atual)}
          className="inline-flex min-h-12 items-center rounded-md border border-brand-blue px-5 font-semibold text-brand-blue hover:bg-brand-soft"
        >
          {visivel ? 'Ocultar mapa' : 'Carregar mapa'}
        </button>
        <a href={linkDaRota} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold text-brand-blue underline underline-offset-4">
          Como chegar no Google Maps <span aria-hidden="true" className="ml-2">↗</span>
        </a>
      </div>
      <div id="mapa-da-localizacao" className="flex h-80 items-center justify-center overflow-hidden rounded-xl border border-border bg-brand-soft sm:h-96">
        {visivel ? (
          <iframe
            title="Mapa do endereço da Don Energy em Mococa" src={linkDoMapaIncorporado}
            loading="lazy" referrerPolicy="no-referrer" allowFullScreen className="h-full w-full border-0"
          />
        ) : (
          <div className="max-w-sm px-6 text-center text-muted-foreground">
            <MapPin aria-hidden="true" className="mx-auto mb-4 size-8 text-brand-blue" />
            <p>{endereco}</p>
            <p className="mt-2 text-sm">Escolha carregar o mapa ou use o link de localização.</p>
          </div>
        )}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">Se o mapa não aparecer, o endereço e o link “Como chegar” continuam disponíveis.</p>
    </section>
  );
}
