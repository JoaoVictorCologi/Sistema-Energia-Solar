import { Link } from 'react-router';
import type { Solucao } from '../../dados/solucoes.ts';
import { FotoAcervo } from './FotoAcervo.tsx';

// Cartão de uma solução. `naInicial`: versão curta para a página inicial (título e introdução), com h3 por estar dentro de uma seção.
export function CartaoSolucao({ solucao, naInicial = false, carregarJa = false }: { solucao: Solucao; naInicial?: boolean; carregarJa?: boolean }) {
  const Titulo = naInicial ? 'h3' : 'h2';
  return (
    <article className="relative overflow-hidden rounded-md border border-border bg-background focus-within:ring-2 focus-within:ring-brand-blue">
      <FotoAcervo numero={solucao.foto} carregarJa={carregarJa} className="aspect-[16/9] rounded-none" />
      <div className="p-6 sm:p-8">
        <Titulo className="font-heading text-2xl font-medium tracking-tight text-brand-blue">{naInicial ? solucao.titulo : solucao.nome}</Titulo>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">{naInicial ? solucao.intro : solucao.resumo}</p>
        {/* O ::after estende a área clicável do link a todo o cartão. */}
        <Link
          to={`/solucoes/${solucao.slug}`} aria-label={`Conhecer solução — ${solucao.nome.toLowerCase()}`}
          className="site-link mt-6 after:absolute after:inset-0"
        >
          Conhecer solução <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </article>
  );
}
