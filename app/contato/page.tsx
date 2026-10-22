import type { Metadata } from "next";
import { Suspense } from "react";
import { Clock, MapPin, Phone } from "lucide-react";
import { ContatoPagina } from "@/components/contato-pagina";
import { ContatoAlternativo } from "@/components/contato-progressivo";
import { MapaContato } from "@/components/mapa-contato";
import { contato } from "@/lib/contato-data";
import { siteConfig } from "@/lib/site-config";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

const description = "Fale com a Don Energy em Mococa: endereço, telefone, horários e formulário para solicitar sua proposta de energia solar pelo WhatsApp.";
export const metadata: Metadata = {
  title: "Contato — Don Energy", description,
  alternates: { canonical: "/contato/" },
  openGraph: { title: "Contato — Don Energy", description, url: "/contato/", images: ["/og-image.png"] },
  twitter: { card: "summary_large_image", title: "Contato — Don Energy", description, images: ["/og-image.png"] },
};

export default function ContatoPage() {
  return <main id="conteudo" tabIndex={-1} className="flex-1"><section className="site-shell pt-14 pb-10 md:pt-20"><p className="site-eyebrow">Vamos conversar</p><h1 className="max-w-3xl font-heading text-4xl leading-tight font-medium tracking-[-0.04em] text-brand-blue sm:text-5xl">Qual é o seu próximo passo?</h1><p className="mt-6 max-w-2xl leading-relaxed text-muted-foreground">Conte sobre o seu projeto solar. Prepare uma mensagem pelo formulário ou fale diretamente com a Don Energy.</p></section><div className="site-shell grid items-start gap-10 pb-20 lg:grid-cols-[1.3fr_0.8fr] lg:gap-20"><section id="formulario-proposta" aria-label="Solicitar proposta solar" className="min-h-[850px] scroll-mt-[calc(var(--header-height)+1rem)]"><Suspense fallback={<ContatoAlternativo />}><ContatoPagina /></Suspense></section><aside aria-label="Informações de contato" className="space-y-8 lg:pt-6"><div><Phone aria-hidden="true" className="mb-4 size-5 text-brand-blue" /><h2 className="font-heading text-xl font-medium text-brand-blue">Fale com a Don Energy</h2><a href={buildWhatsAppUrl()} target="_blank" rel="noopener noreferrer" className="site-link mt-3">Conversar no WhatsApp <span aria-hidden="true">↗</span></a><p className="mt-2 text-sm text-muted-foreground">Ou ligue: <a href={"tel:"+siteConfig.telefoneInternacional} className="underline underline-offset-4">{contato.telefoneExibicao}</a></p></div><div className="border-t border-border pt-7"><MapPin aria-hidden="true" className="mb-4 size-5 text-brand-blue" /><h2 className="font-heading text-xl font-medium text-brand-blue">Encontre a gente</h2><address className="mt-4 text-sm leading-relaxed text-muted-foreground not-italic">{contato.endereco.linha1}<br />{contato.endereco.linha2}</address></div><div className="border-t border-border pt-7"><Clock aria-hidden="true" className="mb-4 size-5 text-brand-blue" /><h2 className="font-heading text-xl font-medium text-brand-blue">Atendimento</h2><dl className="mt-4 space-y-4 text-sm">{contato.horarios.map(item => <div key={item.dias}><dt className="font-medium">{item.dias}</dt><dd className="mt-1 text-muted-foreground">{item.horario}</dd></div>)}</dl></div></aside></div><MapaContato /></main>;
}
