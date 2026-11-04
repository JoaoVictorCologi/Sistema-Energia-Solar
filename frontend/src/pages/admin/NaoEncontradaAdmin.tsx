import { Link } from 'react-router';
import { useTituloDaPagina } from '../../hooks/useTituloDaPagina.ts';

// Rota inexistente dentro da área restrita: mantém o menu à vista.
export function NaoEncontradaAdmin() {
  useTituloDaPagina('Página não encontrada — Solar Gestão');

  return (
    <>
      <p className="font-semibold text-brand-blue">Erro 404</p>
      <h1 className="mt-3 font-heading text-3xl font-medium text-brand-blue">Página não encontrada</h1>
      <p className="mt-4 text-muted-foreground">Esta tela não existe na área restrita. Use o menu ao lado ou volte ao painel.</p>
      <Link to="/admin" className="site-button mt-6">Voltar ao painel</Link>
    </>
  );
}
