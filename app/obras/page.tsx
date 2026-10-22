import type { Metadata } from "next";
import { PortfolioObras } from "@/components/portfolio-obras";
import { ChamadaContato } from "@/components/chamada-contato";

const description = "Explore fotografias do acervo Don Energy e veja instalações solares em diferentes enquadramentos.";
export const metadata: Metadata = {
  title: "Portfólio — Don Energy", description,
  alternates: { canonical: "/obras/" },
  openGraph: { title: "Portfólio — Don Energy", description, url: "/obras/", images: ["/og-image.png"] },
  twitter: { card: "summary_large_image", title: "Portfólio — Don Energy", description, images: ["/og-image.png"] },
};

export default function ObrasPage() {
  return <main id="conteudo" tabIndex={-1} className="flex-1"><section className="site-shell pt-14 pb-12 md:pt-20 md:pb-16"><p className="site-eyebrow">Portfólio · Acervo Don Energy</p><h1 className="max-w-3xl font-heading text-4xl leading-tight font-medium tracking-[-0.04em] text-brand-blue sm:text-5xl">A energia solar<br /> em imagens.</h1><p className="mt-7 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">Fotografias de instalações solares, com diferentes perspectivas e detalhes. Conheça o acervo e converse com a Don Energy sobre o seu projeto.</p></section><PortfolioObras /><ChamadaContato /></main>;
}
