import type { Metadata } from "next";
import { SimuladorSolar } from "@/components/simulador-solar";
import { ExplicacaoSimulador } from "@/components/explicacao-simulador";
import { estadoSimulador } from "@/lib/simulador-config";

const description = "Prepare os dados para conversar sobre seu projeto solar. Cálculo em preparação: esta página não apresenta estimativas de potência, geração ou economia.";
export const metadata: Metadata = {
  title: "Simulador solar — preparação do projeto | Don Energy", description,
  alternates: { canonical: "/simulador/" },
  openGraph: { title: "Simulador solar — Don Energy", description, url: "/simulador/", images: ["/og-image.png"] },
  twitter: { card: "summary_large_image", title: "Simulador solar — Don Energy", description, images: ["/og-image.png"] },
};

export default function SimuladorPage() {
  return <main id="conteudo" tabIndex={-1} className="flex-1">
    <section className="site-shell pt-14 pb-12 md:pt-20 md:pb-16">
      <p className="site-eyebrow">Simulador solar · Preparação do projeto</p>
      <p className="mb-6 inline-flex rounded-sm border border-brand-blue/25 bg-brand-soft px-4 py-2 text-sm font-semibold text-brand-blue">{estadoSimulador.titulo}</p>
      <h1 className="max-w-3xl font-heading text-4xl leading-tight font-medium tracking-[-0.04em] text-brand-blue sm:text-5xl">Um primeiro olhar.<br />Uma conversa mais clara.</h1>
      <p className="mt-7 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">{estadoSimulador.descricao}</p>
    </section>
    <SimuladorSolar explicacao={<ExplicacaoSimulador />} />
  </main>;
}
