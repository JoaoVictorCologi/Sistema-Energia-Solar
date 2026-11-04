import { Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useCarregar } from '../../../hooks/useCarregar.ts';
import { mensagemGeral, useAcao } from '../../../hooks/useAcao.ts';
import { adicionarCondicao, ErroDaApi, listarFormas, removerCondicao, type CondicaoDaProposta, type FormaDePagamento, type Proposta } from '../../../services/api.ts';
import { formatarPercentual, formatarReais } from '../../../utils/formatar.ts';
import { lerNumeroOpcional } from '../../../utils/numeros.ts';
import { CampoDeSelecao, CampoDeTexto } from '../../formulario/Campos.tsx';
import { Aviso, Cartao, classeDoBotaoSecundario } from '../Pecas.tsx';

// Texto da condição, usado no editor e no documento impresso.
export function descreverCondicao(condicao: CondicaoDaProposta): string {
  if (condicao.tipo === 'avista') return `${formatarReais(condicao.valorTotal)} à vista`;
  const entrada = condicao.entrada > 0 ? `Entrada de ${formatarReais(condicao.entrada)} + ` : '';
  return `${entrada}${condicao.parcelas}x de ${formatarReais(condicao.valorParcela)}`;
}

function limitesDaForma(forma: FormaDePagamento): string {
  if (forma.tipo === 'avista') return `Desconto de ${formatarPercentual(forma.descontoAvista)} à vista.`;
  const partes = [
    `De ${forma.parcelasMinimas} a ${forma.parcelasMaximas} parcelas`,
    `taxa de ${formatarPercentual(forma.taxaMensal ?? 0)} ao mês`,
    `entrada mínima de ${formatarPercentual(forma.entradaMinima)}`,
    ...(forma.carenciaMaximaDias > 0 ? [`carência de até ${forma.carenciaMaximaDias} dias`] : []),
  ];
  return `${partes.join(', ')}.`;
}

function LinhaDaCondicao({ condicao, aoRemover, ocupado }: { condicao: CondicaoDaProposta; aoRemover: () => void; ocupado: boolean }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div>
        <p className="font-medium">{condicao.nome}: {descreverCondicao(condicao)}</p>
        <p className="text-xs text-muted-foreground">
          Total de {formatarReais(condicao.valorTotal)}
          {condicao.carenciaDias > 0 && ` · carência de ${condicao.carenciaDias} dias`}
          {condicao.economiaMensalMenosParcela !== null && ` · economia mensal menos a parcela: ${formatarReais(condicao.economiaMensalMenosParcela)}`}
        </p>
      </div>
      <button type="button" onClick={aoRemover} disabled={ocupado} aria-label={`Remover ${condicao.nome}`} className="inline-flex size-11 items-center justify-center rounded-sm text-red-800 hover:bg-red-50 disabled:opacity-60">
        <Trash2 aria-hidden="true" className="size-4" />
      </button>
    </li>
  );
}

// Condições de pagamento do rascunho. A parcela é calculada no backend (tabela Price, com a carência capitalizada); a tela apenas escolhe a forma e os limites.
export function Condicoes({ proposta, aoAtualizar }: { proposta: Proposta; aoAtualizar: (proposta: Proposta) => void }) {
  const formas = useCarregar(listarFormas, 'formas-do-orcamento');
  const [formaId, setFormaId] = useState('');
  const [entrada, setEntrada] = useState('');
  const [parcelas, setParcelas] = useState('');
  const [carencia, setCarencia] = useState('');
  const { executar, ocupado, erro, setErro } = useAcao();

  const ativas = (formas.dados ?? []).filter((forma) => forma.ativa);
  const forma = ativas.find((item) => item.id === Number(formaId));
  const condicoes = proposta.condicoes ?? [];

  async function incluir(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!forma) return;
    const valores = { entrada: lerNumeroOpcional(entrada), parcelas: lerNumeroOpcional(parcelas), carenciaDias: lerNumeroOpcional(carencia) };
    // Os limites vêm da forma escolhida: a tela os aponta sem esperar a API, que confere de novo.
    if (forma.tipo !== 'avista' && valores.parcelas !== undefined && !(valores.parcelas >= forma.parcelasMinimas && valores.parcelas <= forma.parcelasMaximas)) {
      setErro(new ErroDaApi(400, 'ENTRADA_INVALIDA', '', { parcelas: `Escolha de ${forma.parcelasMinimas} a ${forma.parcelasMaximas} parcelas.` }));
      return;
    }
    const salva = await executar(() => adicionarCondicao(proposta.id, {
      formaPagamentoId: forma.id,
      ...(forma.tipo !== 'avista' && valores),
    }));
    if (salva) { aoAtualizar(salva); setFormaId(''); setEntrada(''); setParcelas(''); setCarencia(''); }
  }

  async function remover(itemId: number) {
    const salva = await executar(() => removerCondicao(proposta.id, itemId));
    if (salva) aoAtualizar(salva);
  }

  return (
    <Cartao>
      <h2 className="font-heading text-lg font-medium text-brand-blue">Condições de pagamento</h2>
      <p className="mt-1 text-sm text-muted-foreground">Ao menos uma é obrigatória para enviar. Um novo ajuste refaz as condições já escolhidas.</p>
      {condicoes.length > 0 && (
        <ul className="mt-4 divide-y divide-border border-y border-border text-sm">
          {condicoes.map((condicao) => <LinhaDaCondicao key={condicao.id} condicao={condicao} ocupado={ocupado} aoRemover={() => remover(condicao.id)} />)}
        </ul>
      )}
      <form onSubmit={incluir} noValidate className="mt-5 flex flex-col gap-4">
        <CampoDeSelecao id="condicao-forma" rotulo="Forma de pagamento" value={formaId} erro={erro?.campos.formaPagamentoId} onChange={(evento) => setFormaId(evento.target.value)}
          ajuda={forma ? limitesDaForma(forma) : formas.erro ?? undefined}>
          <option value="">Escolha…</option>
          {ativas.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
        </CampoDeSelecao>
        {forma && forma.tipo !== 'avista' && (
          <div className="grid gap-4 sm:grid-cols-3">
            <CampoDeTexto id="condicao-entrada" rotulo="Entrada (R$)" inputMode="decimal" value={entrada} placeholder="A mínima" erro={erro?.campos.entrada} onChange={(evento) => setEntrada(evento.target.value)} />
            <CampoDeTexto id="condicao-parcelas" rotulo="Parcelas" inputMode="numeric" value={parcelas} placeholder={String(forma.parcelasMaximas)} erro={erro?.campos.parcelas} onChange={(evento) => setParcelas(evento.target.value)} />
            {forma.carenciaMaximaDias > 0 && (
              <CampoDeTexto id="condicao-carencia" rotulo="Carência (dias)" inputMode="numeric" value={carencia} placeholder="0" erro={erro?.campos.carenciaDias} onChange={(evento) => setCarencia(evento.target.value)} />
            )}
          </div>
        )}
        {mensagemGeral(erro) && <Aviso>{mensagemGeral(erro)}</Aviso>}
        <button type="submit" disabled={ocupado || !forma} className={classeDoBotaoSecundario + ' self-start'}>{ocupado ? 'Calculando…' : 'Incluir condição'}</button>
      </form>
    </Cartao>
  );
}
