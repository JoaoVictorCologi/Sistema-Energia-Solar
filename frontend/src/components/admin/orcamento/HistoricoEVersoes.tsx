import { Link } from 'react-router';
import type { Proposta } from '../../../services/api.ts';
import { formatarData, formatarDataEHora, formatarReais } from '../../../utils/formatar.ts';
import { Cartao, SeloDeStatus } from '../Pecas.tsx';

function Versoes({ proposta }: { proposta: Proposta }) {
  if (proposta.versoes.length <= 1) return null;
  return (
    <Cartao>
      <h2 className="font-heading text-lg font-medium text-brand-blue">Versões</h2>
      <ul className="mt-3 divide-y divide-border text-sm">
        {proposta.versoes.map((versao) => (
          <li key={versao.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
            {versao.id === proposta.id
              ? <span className="font-semibold">Versão {versao.versao} (esta)</span>
              : <Link to={`/admin/propostas/${versao.id}`} className="font-semibold text-brand-blue underline underline-offset-4">Versão {versao.versao}</Link>}
            <SeloDeStatus status={versao.status} />
            <span className="tabular-nums">{formatarReais(versao.investimento)} · válida até {formatarData(versao.validaAte)}</span>
          </li>
        ))}
      </ul>
    </Cartao>
  );
}

// Quem fez o quê, quando e por quê. Fica fora da impressão: o documento do cliente não leva o histórico.
export function HistoricoEVersoes({ proposta }: { proposta: Proposta }) {
  return (
    <div className="flex flex-col gap-6 print:hidden">
      <Versoes proposta={proposta} />
      <Cartao>
        <h2 className="font-heading text-lg font-medium text-brand-blue">Histórico</h2>
        {proposta.historico.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Sem eventos registrados.</p> : (
          <ol className="mt-3 divide-y divide-border text-sm">
            {proposta.historico.map((evento, indice) => (
              <li key={`${evento.criadoEm}-${indice}`} className="py-2">
                <p className="font-medium">{evento.descricao}</p>
                {evento.justificativa && <p className="text-muted-foreground">Motivo: {evento.justificativa}</p>}
                <p className="text-xs text-muted-foreground">{evento.usuario ?? 'Sistema'} · {formatarDataEHora(evento.criadoEm)}</p>
              </li>
            ))}
          </ol>
        )}
      </Cartao>
    </div>
  );
}
