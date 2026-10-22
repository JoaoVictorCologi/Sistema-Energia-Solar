// Estrutura para agrupamentos confirmados. Não há rota de detalhe ativa nesta entrega.
import Link from "next/link";
import { fotosDaObra, type ObraConfirmada } from "@/lib/obras-data";
import { fotoPorId } from "@/lib/fotos-data";
import { ImagemPortfolio } from "@/components/imagem-portfolio";
import { GaleriaFotos } from "@/components/galeria-fotos";
import { ChamadaContato } from "@/components/chamada-contato";

export function DetalheObra({ obra }: { obra: ObraConfirmada }) {
  const fotos = fotosDaObra(obra);
  if (obra.potenciaKwp !== undefined && obra.potenciaKwp <= 0) throw new Error("Potência deve ser um dado confirmado positivo.");
  return <>
    <section className="site-shell pt-10 pb-16"><Link prefetch={false} href="/obras/" className="site-link mb-8">← Voltar ao portfólio</Link><p className="site-eyebrow">Acervo Don Energy</p><h1 className="site-title">{obra.titulo}</h1><p className="mt-6 max-w-2xl leading-relaxed text-muted-foreground">{obra.descricao}</p><dl className="mt-6 flex flex-wrap gap-8">{obra.cidade && <div><dt className="text-xs text-muted-foreground">Localidade</dt><dd className="mt-2 font-medium text-brand-blue">{obra.cidade}{obra.uf ? " · " + obra.uf : ""}</dd></div>}{obra.potenciaKwp !== undefined && <div><dt className="text-xs text-muted-foreground">Potência</dt><dd className="mt-2 font-medium text-brand-blue">{obra.potenciaKwp} kWp</dd></div>}</dl><div className="mt-9 overflow-hidden rounded-md bg-brand-soft"><ImagemPortfolio foto={fotoPorId(obra.capaFotoId)} ampliada /></div></section>
    <section aria-label="Fotografias do projeto" className="site-shell pb-20"><GaleriaFotos fotos={fotos} id={"galeria-" + obra.id} /></section><ChamadaContato />
  </>;
}
