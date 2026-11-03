import { Link } from 'react-router';
import { useTituloDaPagina } from '../../hooks/useTituloDaPagina.ts';

export function NaoEncontrada() {
  useTituloDaPagina('Página não encontrada — Don Energy');

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-start gap-5 px-6 py-20">
      <p className="font-semibold text-brand-blue">Erro 404</p>
      <h1 className="font-heading text-3xl font-medium text-brand-blue">Página não encontrada</h1>
      <p>Confira o endereço ou volte à página inicial da Don Energy.</p>
      <Link to="/" className="inline-flex min-h-11 items-center rounded-md bg-brand-orange px-5 font-semibold text-brand-ink">Voltar ao início</Link>
    </div>
  );
}
