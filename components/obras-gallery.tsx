import Link from "next/link";
import { fotosDestaque } from "@/lib/fotos-data";
import { FotoAcervo } from "@/components/foto-acervo";

export function ObrasGallery() {
  return <section id="obras" className="site-section scroll-mt-[var(--header-height)]"><div className="site-shell"><div className="flex flex-col items-start justify-between gap-5 md:flex-row md:items-end"><div><p className="site-eyebrow">Fotografias do acervo</p><h2 className="site-title">A energia solar ganha forma.</h2></div><Link prefetch={false} href="/obras/" className="site-link shrink-0">Ver portfólio <span aria-hidden="true">↗</span></Link></div><p className="mt-6 max-w-xl leading-relaxed text-muted-foreground">Um olhar sobre as instalações. Explore mais fotografias no acervo da Don Energy.</p><div className="mt-10 grid gap-8 md:grid-cols-3">{fotosDestaque.map(foto => <figure key={foto.id}><FotoAcervo numero={foto.numero} sizes="(min-width: 1200px) 355px, (min-width: 768px) 30vw, 100vw" /><figcaption className="mt-4 text-xs leading-relaxed text-muted-foreground">{foto.legenda}</figcaption></figure>)}</div></div></section>;
}
