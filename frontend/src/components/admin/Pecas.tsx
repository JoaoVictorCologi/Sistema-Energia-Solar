import { CircleCheck, CircleX, PencilLine, Send } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { StatusDaProposta } from '../../services/api.ts';

// Peças comuns das telas da área restrita.

export function Titulo({ sobre, children, acoes }: { sobre?: string; children: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {sobre && <p className="site-eyebrow">{sobre}</p>}
        <h1 className="font-heading text-3xl font-medium tracking-tight text-brand-blue">{children}</h1>
      </div>
      {acoes}
    </div>
  );
}

// Estado de uma busca: exibido no lugar do conteúdo enquanto carrega ou quando há erro.
export function EstadoDaCarga({ carregando, erro, aoTentarDeNovo }: { carregando: boolean; erro: string | null; aoTentarDeNovo: () => void }) {
  if (erro) {
    return (
      <div role="alert" className="rounded-md border border-red-700/30 bg-red-50 p-4 text-sm text-red-800">
        {erro}{' '}
        <button type="button" onClick={aoTentarDeNovo} className="font-semibold underline underline-offset-4">Tentar de novo</button>
      </div>
    );
  }
  return carregando ? <p role="status" className="text-sm text-muted-foreground">Carregando…</p> : null;
}

export function Aviso({ children }: { children: ReactNode }) {
  return <p role="alert" className="rounded-sm border border-red-700/30 bg-red-50 px-3 py-2 text-sm text-red-800">{children}</p>;
}

export function Cartao({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={'rounded-md border border-border bg-white p-5 sm:p-6 ' + className}>{children}</div>;
}

const STATUS = {
  rascunho: { rotulo: 'Rascunho', Icone: PencilLine, classe: 'border-border text-muted-foreground' },
  enviada: { rotulo: 'Enviada', Icone: Send, classe: 'border-brand-blue/30 text-brand-blue' },
  aceita: { rotulo: 'Aceita', Icone: CircleCheck, classe: 'border-green-700/40 text-green-800' },
  recusada: { rotulo: 'Recusada', Icone: CircleX, classe: 'border-red-700/30 text-red-800' },
} as const;

export const ROTULOS_DO_STATUS: Record<StatusDaProposta, string> = { rascunho: 'Rascunho', enviada: 'Enviada', aceita: 'Aceita', recusada: 'Recusada' };

// Ícone e texto acompanham a cor: o status nunca depende apenas dela.
export function SeloDeStatus({ status, vencida = false }: { status: StatusDaProposta; vencida?: boolean }) {
  const { rotulo, Icone, classe } = STATUS[status];
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className={'inline-flex items-center gap-1.5 rounded-full border bg-white px-2.5 py-0.5 text-xs font-semibold ' + classe}>
        <Icone aria-hidden="true" className="size-3.5" /> {rotulo}
      </span>
      {vencida && status === 'enviada' && <span className="text-xs font-semibold text-muted-foreground">validade vencida</span>}
    </span>
  );
}

// Não aparece quando tudo cabe em uma página. `linkDaPagina` preserva os filtros da URL.
export function Paginacao({ pagina, porPagina, total, linkDaPagina }: { pagina: number; porPagina: number; total: number; linkDaPagina: (pagina: number) => string }) {
  const ultima = Math.max(1, Math.ceil(total / porPagina));
  if (ultima === 1) return null;
  const classe = 'inline-flex min-h-11 items-center rounded-sm border border-border bg-white px-4 text-sm font-semibold text-brand-blue';
  return (
    <nav aria-label="Páginas" className="mt-6 flex flex-wrap items-center gap-3 text-sm">
      {pagina > 1 && <Link to={linkDaPagina(pagina - 1)} className={classe}>Anterior</Link>}
      <span className="text-muted-foreground">Página {pagina} de {ultima} · {total} no total</span>
      {pagina < ultima && <Link to={linkDaPagina(pagina + 1)} className={classe}>Próxima</Link>}
    </nav>
  );
}

export const classeDaTabela = 'w-full min-w-[640px] text-left text-sm';
export const classeDoCabecalho = 'border-b border-border text-xs text-muted-foreground [&_th]:py-2 [&_th]:pr-4 [&_th]:font-medium';
export const classeDaLinha = 'border-b border-border last:border-0 [&_td]:py-3 [&_td]:pr-4';

export function Tabela({ legenda, children }: { legenda: string; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-white px-4">
      <table className={classeDaTabela}>
        <caption className="sr-only">{legenda}</caption>
        {children}
      </table>
    </div>
  );
}

export const classeDoBotaoSecundario =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border border-brand-blue px-4 text-sm font-semibold text-brand-blue hover:bg-brand-soft disabled:opacity-60';

export const classeDoBotaoPerigoso =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border border-red-700/50 px-4 text-sm font-semibold text-red-800 hover:bg-red-50 disabled:opacity-60';

// Ação irreversível: o primeiro clique apenas pede a confirmação, ao lado do botão.
export function BotaoComConfirmacao({ rotulo, pergunta, aoConfirmar, ocupado, classe = classeDoBotaoSecundario }: {
  rotulo: ReactNode; pergunta: string; aoConfirmar: () => void; ocupado: boolean; classe?: string;
}) {
  const [confirmando, setConfirmando] = useState(false);
  if (!confirmando) return <button type="button" onClick={() => setConfirmando(true)} disabled={ocupado} className={classe}>{rotulo}</button>;
  return (
    <span role="group" aria-label={pergunta} className="inline-flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold text-brand-ink">{pergunta}</span>
      <button type="button" onClick={() => { setConfirmando(false); aoConfirmar(); }} disabled={ocupado} className={classe}>Confirmar</button>
      <button type="button" onClick={() => setConfirmando(false)} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-muted-foreground underline underline-offset-4">Cancelar</button>
    </span>
  );
}
