import { Link } from 'react-router';

// Faixa azul do fim das páginas. Leva ao formulário da página de contato (módulo site), já com o perfil escolhido.
export function linkDoContato(slugDaSolucao?: string): string {
  return '/contato' + (slugDaSolucao ? `?servico=${slugDaSolucao}` : '') + '#formulario-proposta';
}

export function ChamadaFinal({ titulo = 'Seu projeto começa com uma conversa.', slugDaSolucao }: { titulo?: string; slugDaSolucao?: string }) {
  return (
    <section className="bg-brand-deep py-16 text-white">
      <div className="site-shell flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
        <div>
          <p className="mb-4 text-xs font-semibold tracking-widest uppercase">Próximo passo</p>
          <h2 className="max-w-2xl font-heading text-3xl leading-snug font-medium">{titulo}</h2>
        </div>
        <Link to={linkDoContato(slugDaSolucao)} className="site-button shrink-0">
          Conversar sobre meu projeto <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </section>
  );
}
