import { Link } from 'react-router';
import { CartaoSolucao } from '../../../components/publico/CartaoSolucao.tsx';
import { FotoAcervo } from '../../../components/publico/FotoAcervo.tsx';
import { LEGENDA_DO_ACERVO } from '../../../dados/fotos.ts';
import { solucoes } from '../../../dados/solucoes.ts';
import { useTituloDaPagina } from '../../../hooks/useTituloDaPagina.ts';
import { FormularioContato } from '../components/FormularioContato.tsx';

// Página inicial herdada do site Don Energy (app/page.tsx da branch legado/site-don-energy).
export function Inicio() {
  useTituloDaPagina('Don Energy — Energia Solar em Mococa e Região');

  return (
    <>
      <Hero />
      <SecaoSobre />
      <SecaoSolucoes />
      <SecaoFotos />
      <SecaoPrimeirosPassos />
      <section className="bg-brand-deep py-14 text-white">
        <div className="site-shell">
          <p className="mb-4 text-xs font-semibold tracking-widest uppercase">Vamos conversar</p>
          <h2 className="max-w-2xl font-heading text-3xl leading-snug font-medium">Seu projeto começa com uma conversa.</h2>
          <Link to="/contato" className="mt-6 inline-flex min-h-11 items-center gap-3 text-sm font-semibold underline underline-offset-8">
            Veja contatos e localização <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>
      <section id="contato" className="site-section scroll-mt-[var(--header-height)] bg-brand-soft px-6 pb-24">
        <FormularioContato />
      </section>
    </>
  );
}

const srcSetDoHero = (formato: 'avif' | 'webp') =>
  [640, 960, 1440].map((largura) => `/fotos/otimizadas/hero-${largura}.${formato} ${largura}w`).join(', ');

// Foto de fundo com dois degradês por cima; o cabeçalho fica transparente sobre ela.
function Hero() {
  return (
    <section className="relative isolate flex min-h-[680px] flex-col justify-center overflow-hidden bg-brand-deep pt-[calc(var(--header-height)+4rem)] pb-28 text-white sm:min-h-[760px]">
      <picture>
        <source type="image/avif" srcSet={srcSetDoHero('avif')} sizes="100vw" />
        <img
          src="/fotos/otimizadas/hero-1440.webp" srcSet={srcSetDoHero('webp')} sizes="100vw" width={1440} height={960} alt=""
          fetchPriority="high" className="absolute inset-0 -z-20 h-full w-full object-cover object-[58%_center]"
        />
      </picture>
      <div className="absolute inset-0 -z-10 bg-linear-to-r from-brand-deep/90 via-brand-deep/65 to-brand-deep/35" />
      <div className="absolute inset-0 -z-10 bg-linear-to-b from-black/45 via-transparent to-brand-deep/40" />
      <div className="site-shell">
        <p className="mb-7 text-xs font-semibold tracking-[0.15em] uppercase">Don Energy · Mococa e região</p>
        <h1 className="max-w-3xl font-heading text-[clamp(2.4rem,4.8vw,4.4rem)] leading-[1.13] font-medium tracking-[-0.04em]">
          Energia solar para<br className="hidden sm:block" /> o seu próximo passo.
        </h1>
        <p className="mt-7 max-w-lg text-base leading-relaxed text-white/95 sm:text-lg">
          Da sua casa ao seu projeto de investimento.<br className="hidden sm:block" /> Conheça as possibilidades para a sua realidade.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
          <Link to="/solucoes" className="site-button">Conheça as soluções <span aria-hidden="true">↗</span></Link>
          <Link to="/contato" className="inline-flex min-h-12 items-center gap-3 text-sm font-medium underline underline-offset-8">
            Converse com a gente <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0">
        <div className="site-shell">
          <p className="border-t border-white/30 py-6 text-xs leading-relaxed tracking-wide">Residencial · Comercial · Rural · Investimento</p>
        </div>
      </div>
    </section>
  );
}

function SecaoSobre() {
  return (
    <section aria-labelledby="titulo-sobre" className="site-section">
      <div className="site-shell grid items-center gap-10 md:grid-cols-2 lg:gap-24">
        <div>
          <p className="site-eyebrow">A Don Energy</p>
          <h2 id="titulo-sobre" className="site-title">Um projeto solar começa por entender você.</h2>
          <p className="mt-7 leading-relaxed text-muted-foreground">
            Energia solar residencial, comercial, rural e usinas de investimento em Mococa e região. Conte sobre o seu consumo, o local e o que você espera do projeto.
          </p>
          <Link to="/contato" className="site-link mt-6">Converse com a Don Energy <span aria-hidden="true">↗</span></Link>
        </div>
        <figure>
          <FotoAcervo numero="03" />
          <figcaption className="mt-3 text-xs text-muted-foreground">Fotografia do acervo Don Energy.</figcaption>
        </figure>
      </div>
    </section>
  );
}

function SecaoSolucoes() {
  return (
    <section id="solucoes" className="site-section scroll-mt-[var(--header-height)] bg-brand-soft">
      <div className="site-shell">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="site-eyebrow">Soluções solares</p>
            <h2 className="site-title">Qual é o seu próximo passo?</h2>
          </div>
          <Link to="/solucoes" className="site-link shrink-0">Explore as soluções <span aria-hidden="true">↗</span></Link>
        </div>
        <p className="mt-6 max-w-2xl leading-relaxed text-muted-foreground">Quatro perfis. Necessidades diferentes. Conheça o que considerar em cada um.</p>
        <div className="mt-10 grid gap-7 md:grid-cols-2">
          {solucoes.map((solucao) => <CartaoSolucao key={solucao.slug} solucao={solucao} naInicial />)}
        </div>
        <p className="mt-5 text-xs leading-relaxed text-muted-foreground">Fotografias do acervo Don Energy. A classificação das instalações por perfil está em conferência.</p>
      </div>
    </section>
  );
}

// Destaque editorial de três fotos; não é contagem nem classificação de projetos.
const fotosEmDestaque = ['09', '01', '11'];

function SecaoFotos() {
  return (
    <section id="projetos" className="site-section scroll-mt-[var(--header-height)]">
      <div className="site-shell">
        <div className="flex flex-col items-start justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="site-eyebrow">Fotografias do acervo</p>
            <h2 className="site-title">A energia solar ganha forma.</h2>
          </div>
          <Link to="/projetos" className="site-link shrink-0">Ver portfólio <span aria-hidden="true">↗</span></Link>
        </div>
        <p className="mt-6 max-w-xl leading-relaxed text-muted-foreground">Um olhar sobre as instalações. Explore mais fotografias no acervo da Don Energy.</p>
        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {fotosEmDestaque.map((numero) => (
            <figure key={numero}>
              <FotoAcervo numero={numero} />
              <figcaption className="mt-4 text-xs leading-relaxed text-muted-foreground">{LEGENDA_DO_ACERVO}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

const primeirosPassos = [
  { numero: '01', titulo: 'Seu contexto', texto: 'Conte sua cidade, o perfil do projeto e as características do local.' },
  { numero: '02', titulo: 'Seu consumo', texto: 'Se possível, reúna contas de energia. Esse dado é opcional para iniciar o contato.' },
  { numero: '03', titulo: 'Suas dúvidas', texto: 'Anote o que deseja esclarecer sobre escopo, condições e próximos passos.' },
];

function SecaoPrimeirosPassos() {
  return (
    <section className="site-section bg-brand-soft">
      <div className="site-shell">
        <p className="site-eyebrow">Antes da primeira conversa</p>
        <h2 className="site-title">Comece pelo que você já sabe.</h2>
        <div className="mt-12 grid gap-9 md:grid-cols-3">
          {primeirosPassos.map((passo) => (
            <article key={passo.numero} className="border-t border-border pt-6">
              <span aria-hidden="true" className="text-xs font-semibold text-brand-blue">{passo.numero}</span>
              <h3 className="mt-6 font-heading text-xl font-medium text-brand-blue">{passo.titulo}</h3>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{passo.texto}</p>
            </article>
          ))}
        </div>
        <Link to="/simulador" className="site-link mt-10">Conheça o simulador solar <span aria-hidden="true">↗</span></Link>
        <p className="mt-2 text-xs text-muted-foreground">Simulador em construção: o cálculo da economia pela Lei 14.300 chega em breve.</p>
      </div>
    </section>
  );
}
