import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DetalheServico } from "@/components/detalhe-servico";
import { servicos } from "@/lib/servicos-data";
import { localBusiness, SITE_URL } from "@/lib/site-config";

export const dynamicParams = false;
export function generateStaticParams() { return servicos.map(({ slug }) => ({ slug })); }
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const servico = servicos.find((item) => item.slug === slug);
  if (!servico) notFound();
  const title = `${servico.nome} — Don Energy`;
  const url = `/servicos/${servico.slug}/`;
  return { title, description: servico.resumo, alternates: { canonical: url }, openGraph: { title, description: servico.resumo, url, images: ["/og-image.png"] }, twitter: { card: "summary_large_image", title, description: servico.resumo, images: ["/og-image.png"] } };
}

export default async function ServicoPage({ params }: Props) {
  const { slug } = await params;
  const servico = servicos.find((item) => item.slug === slug);
  if (!servico) notFound();
  const url = `${SITE_URL}/servicos/${servico.slug}/`;
  const jsonLd = { "@context": "https://schema.org", "@type": "Service", "@id": url + "#servico", name: servico.nome, description: servico.resumo, serviceType: servico.nome, url, provider: localBusiness };
  return <main id="conteudo" tabIndex={-1} className="flex-1"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} /><DetalheServico servico={servico} /></main>;
}
