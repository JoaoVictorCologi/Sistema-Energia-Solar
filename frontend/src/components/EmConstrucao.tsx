import { Construction } from 'lucide-react';
import { useTituloDaPagina } from '../hooks/useTituloDaPagina.ts';

// Tela provisória de um módulo cuja API ainda não existe: mantém a navegação completa.
// Quando a API estiver pronta, a rota passa a apontar para a tela definitiva.
export function EmConstrucao({ titulo, origem, descricao }: { titulo: string; origem: string; descricao: string }) {
  useTituloDaPagina(`${titulo} — Solar Gestão`);

  return (
    <>
      <p className="site-eyebrow">{origem}</p>
      <h1 className="font-heading text-3xl font-medium tracking-tight text-brand-blue">{titulo}</h1>
      <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">{descricao}</p>
      <p className="mt-8 inline-flex items-center gap-3 rounded-sm border border-brand-blue/25 bg-white px-4 py-3 text-sm font-semibold text-brand-blue">
        <Construction aria-hidden="true" className="size-5" /> Em construção: a tela entra junto com a API desta parte.
      </p>
    </>
  );
}
