import type { InputHTMLAttributes, ReactNode } from 'react';

// Campos dos formulários públicos (simulador, proposta e contato): rótulo visível, erro ligado ao campo por aria-describedby.

export const classeDoCampo =
  'mt-2 block min-h-12 w-full rounded-sm border border-border bg-white px-3 text-base text-brand-ink aria-[invalid=true]:border-red-700';

export function MensagemDeErro({ id, texto }: { id: string; texto?: string }) {
  return texto ? <p id={id} className="mt-1 text-sm text-red-800">{texto}</p> : null;
}

type PropriedadesDoCampo = { id: string; rotulo: string; erro?: string; ajuda?: ReactNode } & InputHTMLAttributes<HTMLInputElement>;

export function CampoDeTexto({ id, rotulo, erro, ajuda, ...propriedades }: PropriedadesDoCampo) {
  const descricoes = [ajuda ? `ajuda-${id}` : '', erro ? `erro-${id}` : ''].filter(Boolean).join(' ');
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-brand-ink">{rotulo}</label>
      <input id={id} aria-invalid={Boolean(erro)} aria-describedby={descricoes || undefined} className={classeDoCampo} {...propriedades} />
      {ajuda && <p id={`ajuda-${id}`} className="mt-1 text-sm text-muted-foreground">{ajuda}</p>}
      <MensagemDeErro id={`erro-${id}`} texto={erro} />
    </div>
  );
}

interface Opcao<Valor extends string> {
  valor: Valor;
  rotulo: string;
}

// Grupo de botões de rádio em cartões, como no formulário de contato do site anterior.
export function GrupoDeOpcoes<Valor extends string>({ nome, legenda, opcoes, valor, aoMudar, erro }: {
  nome: string; legenda: string; opcoes: Opcao<Valor>[]; valor: string; aoMudar: (valor: Valor) => void; erro?: string;
}) {
  return (
    <fieldset aria-describedby={erro ? `erro-${nome}` : undefined}>
      <legend className="text-sm font-semibold text-brand-ink">{legenda}</legend>
      <div className={'mt-2 grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 ' + (opcoes.length === 3 ? 'sm:grid-cols-3' : '')}>
        {opcoes.map((opcao) => (
          <label key={opcao.valor} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-border bg-white px-3 text-sm has-[:checked]:border-brand-blue has-[:checked]:text-brand-blue">
            <input type="radio" name={nome} value={opcao.valor} checked={valor === opcao.valor}
              onChange={() => aoMudar(opcao.valor)} className="size-4 accent-brand-blue" />
            {opcao.rotulo}
          </label>
        ))}
      </div>
      <MensagemDeErro id={`erro-${nome}`} texto={erro} />
    </fieldset>
  );
}

export function CaixaDeAceite({ id, marcado, aoMudar, erro, children }: {
  id: string; marcado: boolean; aoMudar: (marcado: boolean) => void; erro?: string; children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="flex items-start gap-3 text-sm">
        <input id={id} type="checkbox" checked={marcado} onChange={(evento) => aoMudar(evento.target.checked)}
          aria-invalid={Boolean(erro)} aria-describedby={erro ? `erro-${id}` : undefined}
          className="mt-0.5 size-5 shrink-0 accent-brand-blue" />
        <span>{children}</span>
      </label>
      <MensagemDeErro id={`erro-${id}`} texto={erro} />
    </div>
  );
}
