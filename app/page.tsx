import Link from "next/link";
import { localBusiness } from "@/lib/site-config";
import { ContatoProgressivo } from "@/components/contato-progressivo";
import { Hero } from "@/components/hero";
import { ObrasGallery } from "@/components/obras-gallery";
import { Servicos } from "@/components/servicos";
import { FotoAcervo } from "@/components/foto-acervo";

export default function Home() {
  return <main id="conteudo" tabIndex={-1} className="flex flex-1 flex-col">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusiness).replace(/</g, "\u003c") }} />
    <Hero />
    <section aria-labelledby="sobre-titulo" className="site-section"><div className="site-shell grid items-center gap-10 md:grid-cols-2 lg:gap-24"><div><p className="site-eyebrow">A Don Energy</p><h2 id="sobre-titulo" className="site-title">Um projeto solar começa por entender você.</h2><p className="mt-7 leading-relaxed text-muted-foreground">Energia solar residencial, comercial, rural e usinas de investimento em Mococa e região. Conte sobre o seu consumo, o local e o que você espera do projeto.</p><Link prefetch={false} href="/contato/" className="site-link mt-6">Converse com a Don Energy <span aria-hidden="true">↗</span></Link></div><figure><FotoAcervo numero="03" /><figcaption className="mt-3 text-xs text-muted-foreground">Fotografia do acervo Don Energy.</figcaption></figure></div></section>
    <Servicos /><ObrasGallery />
    <section className="site-section bg-brand-soft"><div className="site-shell"><p className="site-eyebrow">Antes da primeira conversa</p><h2 className="site-title">Comece pelo que você já sabe.</h2><div className="mt-12 grid gap-9 md:grid-cols-3">{[
      ["01", "Seu contexto", "Conte sua cidade, o perfil do projeto e as características do local."],
      ["02", "Seu consumo", "Se possível, reúna contas de energia. Esse dado é opcional para iniciar o contato."],
      ["03", "Suas dúvidas", "Anote o que deseja esclarecer sobre escopo, condições e próximos passos."],
    ].map(([n,t,p]) => <article key={n} className="border-t border-border pt-6"><span aria-hidden="true" className="text-xs font-semibold text-brand-blue">{n}</span><h3 className="mt-6 font-heading text-xl font-medium text-brand-blue">{t}</h3><p className="mt-4 text-sm leading-relaxed text-muted-foreground">{p}</p></article>)}</div><Link prefetch={false} href="/simulador/" className="site-link mt-10">Prepare os dados do seu projeto <span aria-hidden="true">↗</span></Link><p className="mt-2 text-xs text-muted-foreground">Simulador solar com cálculo em preparação, sem resultados numéricos.</p></div></section>
    <section className="bg-brand-deep py-14 text-white"><div className="site-shell"><p className="mb-4 text-xs font-semibold tracking-widest uppercase">Vamos conversar</p><h2 className="max-w-2xl font-heading text-3xl leading-snug font-medium">Seu projeto começa com uma conversa.</h2><Link prefetch={false} href="/contato/" className="mt-6 inline-flex min-h-11 items-center gap-3 text-sm font-semibold underline underline-offset-8">Veja contatos e localização <span aria-hidden="true">↗</span></Link></div></section>
    <ContatoProgressivo />
  </main>;
}
