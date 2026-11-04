import { Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { mensagemGeral, useAcao } from '../../../hooks/useAcao.ts';
import { adicionarAjuste, removerAjuste, type NovoAjuste, type Proposta } from '../../../services/api.ts';
import { formatarPercentual, formatarReais } from '../../../utils/formatar.ts';
import { lerNumero, percentualParaFracao } from '../../../utils/numeros.ts';
import { CampoDeTexto, GrupoDeOpcoes } from '../../formulario/Campos.tsx';
import { Aviso, Cartao, classeDoBotaoSecundario } from '../Pecas.tsx';

// Sugestões do campo de descrição; o texto continua livre.
const SUGESTOES = ['Estrutura especial', 'Adequação do padrão de entrada', 'Frete', 'Desconto comercial'];

const AJUSTE_VAZIO = { tipo: 'desconto' as NovoAjuste['tipo'], modo: 'valor' as NovoAjuste['modo'], descricao: '', valor: '', justificativa: '' };

// Descontos e acréscimos do rascunho. Vão para a API apenas a descrição e o valor: o total é sempre somado no backend.
export function Ajustes({ proposta, aoAtualizar }: { proposta: Proposta; aoAtualizar: (proposta: Proposta) => void }) {
  const [novo, setNovo] = useState(AJUSTE_VAZIO);
  const { executar, ocupado, erro } = useAcao();
  const mudar = (mudanca: Partial<typeof AJUSTE_VAZIO>) => setNovo((atual) => ({ ...atual, ...mudanca }));
  const ajustes = proposta.ajustes ?? [];
  const limite = proposta.configuracaoUsada?.limiteDesconto;

  async function incluir(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const digitado = lerNumero(novo.valor);
    const salva = await executar(() => adicionarAjuste(proposta.id, {
      tipo: novo.tipo, modo: novo.modo, descricao: novo.descricao.trim(),
      valor: novo.modo === 'percentual' ? percentualParaFracao(digitado) : digitado,
      ...(novo.justificativa.trim() && { justificativa: novo.justificativa.trim() }),
    }));
    if (salva) { aoAtualizar(salva); setNovo(AJUSTE_VAZIO); }
  }

  async function remover(itemId: number) {
    const salva = await executar(() => removerAjuste(proposta.id, itemId));
    if (salva) aoAtualizar(salva);
  }

  return (
    <Cartao>
      <h2 className="font-heading text-lg font-medium text-brand-blue">Descontos e acréscimos</h2>
      {ajustes.length > 0 && (
        <ul className="mt-4 divide-y divide-border border-y border-border text-sm">
          {ajustes.map((ajuste) => (
            <li key={ajuste.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium">{ajuste.descricao}{ajuste.modo === 'percentual' && <span className="text-muted-foreground"> ({formatarPercentual(ajuste.valor)})</span>}</p>
                {ajuste.justificativa && <p className="text-xs text-muted-foreground">Motivo: {ajuste.justificativa}</p>}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold tabular-nums">{ajuste.valorEmReais > 0 ? '+ ' : ''}{formatarReais(ajuste.valorEmReais)}</span>
                <button type="button" onClick={() => remover(ajuste.id)} disabled={ocupado} aria-label={`Remover ${ajuste.descricao}`} className="inline-flex size-11 items-center justify-center rounded-sm text-red-800 hover:bg-red-50 disabled:opacity-60">
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={incluir} noValidate className="mt-5 flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <GrupoDeOpcoes nome="ajuste-tipo" legenda="Tipo" valor={novo.tipo} aoMudar={(tipo) => mudar({ tipo })} erro={erro?.campos.tipo}
            opcoes={[{ valor: 'desconto', rotulo: 'Desconto' }, { valor: 'acrescimo', rotulo: 'Acréscimo' }]} />
          <GrupoDeOpcoes nome="ajuste-modo" legenda="Em" valor={novo.modo} aoMudar={(modo) => mudar({ modo })} erro={erro?.campos.modo}
            opcoes={[{ valor: 'valor', rotulo: 'Reais (R$)' }, { valor: 'percentual', rotulo: 'Percentual (%)' }]} />
        </div>
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <CampoDeTexto id="ajuste-descricao" rotulo="Descrição" list="sugestoes-de-ajuste" value={novo.descricao} erro={erro?.campos.descricao} onChange={(evento) => mudar({ descricao: evento.target.value })} />
          <datalist id="sugestoes-de-ajuste">{SUGESTOES.map((sugestao) => <option key={sugestao} value={sugestao} />)}</datalist>
          <CampoDeTexto id="ajuste-valor" rotulo={novo.modo === 'percentual' ? 'Percentual (%)' : 'Valor (R$)'} inputMode="decimal" value={novo.valor} erro={erro?.campos.valor} onChange={(evento) => mudar({ valor: evento.target.value })} />
        </div>
        <CampoDeTexto id="ajuste-justificativa" rotulo="Justificativa" value={novo.justificativa} erro={erro?.campos.justificativa} onChange={(evento) => mudar({ justificativa: evento.target.value })}
          ajuda={limite === undefined ? 'Obrigatória para descontos acima do limite do painel.' : `Obrigatória quando os descontos somam mais de ${formatarPercentual(limite)} do preço calculado.`} />
        {mensagemGeral(erro) && <Aviso>{mensagemGeral(erro)}</Aviso>}
        <button type="submit" disabled={ocupado} className={classeDoBotaoSecundario + ' self-start'}>{ocupado ? 'Recalculando…' : 'Incluir ajuste'}</button>
      </form>
    </Cartao>
  );
}
