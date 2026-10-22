import { fotosAcervo } from "@/lib/fotos-data";
import { GaleriaFotos } from "@/components/galeria-fotos";

export function PortfolioObras() {
  return <section aria-labelledby="acervo-titulo" className="site-shell pb-20 md:pb-24"><div className="mb-9 flex flex-col justify-between gap-4 border-t border-border pt-8 sm:flex-row sm:items-end"><h2 id="acervo-titulo" className="font-heading text-2xl font-medium tracking-tight text-brand-blue">Um olhar para as instalações.</h2><p className="max-w-sm text-sm leading-relaxed text-muted-foreground">Escolha uma fotografia para ver o enquadramento completo.</p></div><GaleriaFotos fotos={fotosAcervo} /></section>;
}
