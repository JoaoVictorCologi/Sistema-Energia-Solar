import Link from "next/link";
import { ServicoCard } from "@/components/servico-card";
import { servicos } from "@/lib/servicos-data";

export function Servicos() {
  return <section id="servicos" className="site-section scroll-mt-[var(--header-height)] bg-brand-soft"><div className="site-shell"><div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end"><div><p className="site-eyebrow">Soluções solares</p><h2 className="site-title">Qual é o seu próximo passo?</h2></div><Link prefetch={false} href="/servicos/" className="site-link shrink-0">Explore as soluções <span aria-hidden="true">↗</span></Link></div><p className="mt-6 max-w-2xl leading-relaxed text-muted-foreground">Quatro perfis. Necessidades diferentes. Conheça o que considerar em cada um.</p><div className="mt-10 grid gap-7 md:grid-cols-2">{servicos.map(servico => <ServicoCard key={servico.id} servico={servico} inicial />)}</div><p className="mt-5 text-xs leading-relaxed text-muted-foreground">Fotografias do acervo Don Energy. A classificação das instalações por perfil está em conferência.</p></div></section>;
}
