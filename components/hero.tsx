import Link from "next/link";

export function Hero() {
  return <section className="relative isolate flex min-h-[680px] flex-col justify-center overflow-hidden bg-brand-deep pt-[calc(var(--header-height)+4rem)] pb-28 text-white sm:min-h-[760px]">
    <picture>
      <source type="image/avif" srcSet="/obras/otimizadas/hero-640.avif 640w, /obras/otimizadas/hero-960.avif 960w, /obras/otimizadas/hero-1440.avif 1440w" sizes="100vw" />
      {/* Arquivos responsivos locais: nenhum otimizador de servidor. */}
      <img src="/obras/otimizadas/hero-1440.webp" srcSet="/obras/otimizadas/hero-640.webp 640w, /obras/otimizadas/hero-960.webp 960w, /obras/otimizadas/hero-1440.webp 1440w" sizes="100vw" width="1440" height="960" alt="" fetchPriority="high" loading="eager" className="absolute inset-0 -z-20 h-full w-full object-cover object-[58%_center]" />
    </picture>
    <div className="absolute inset-0 -z-10 bg-linear-to-r from-brand-deep/90 via-brand-deep/65 to-brand-deep/35" />
    <div className="absolute inset-0 -z-10 bg-linear-to-b from-black/45 via-transparent to-brand-deep/40" />
    <div className="site-shell"><p className="mb-7 text-xs font-semibold tracking-[0.15em] uppercase">Don Energy · Mococa e região</p><h1 className="max-w-3xl font-heading text-[clamp(2.4rem,4.8vw,4.4rem)] leading-[1.13] font-medium tracking-[-0.04em]">Energia solar para<br className="hidden sm:block" /> o seu próximo passo.</h1><p className="mt-7 max-w-lg text-base leading-relaxed text-white/95 sm:text-lg">Da sua casa ao seu projeto de investimento.<br className="hidden sm:block" /> Conheça as possibilidades para a sua realidade.</p><div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4"><Link prefetch={false} href="/servicos/" className="site-button">Conheça as soluções <span aria-hidden="true">↗</span></Link><Link prefetch={false} href="/contato/" className="inline-flex min-h-12 items-center gap-3 text-sm font-medium underline underline-offset-8">Converse com a gente <span aria-hidden="true">↗</span></Link></div></div>
    <div className="absolute inset-x-0 bottom-0"><div className="site-shell"><p className="border-t border-white/30 py-6 text-xs leading-relaxed tracking-wide">Residencial · Comercial · Rural · Investimento</p></div></div>
  </section>;
}
