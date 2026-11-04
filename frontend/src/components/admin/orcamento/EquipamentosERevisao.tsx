import { useState, type FormEvent } from 'react';
import { comoOpcoes, NOMES_DA_INCLINACAO, NOMES_DA_ORIENTACAO, NOMES_DAS_HORAS } from '../../../dados/perguntasDoSimulador.ts';
import { useCarregar } from '../../../hooks/useCarregar.ts';
import { mensagemGeral, useAcao } from '../../../hooks/useAcao.ts';
import { editarProposta, listarEquipamentos, type EdicaoDoRascunho, type Equipamento, type HorasDeSol, type Inclinacao, type Orientacao, type Proposta, type RevisaoDePremissas } from '../../../services/api.ts';
import { fracaoParaCampo, lerNumeroOpcional, percentualParaFracao } from '../../../utils/numeros.ts';
import { CampoDeAreaDeTexto, CampoDeSelecao, CampoDeTexto } from '../../formulario/Campos.tsx';
import { descreverEquipamento } from '../GerarProposta.tsx';
import { Aviso, Cartao, classeDoBotaoSecundario } from '../Pecas.tsx';

interface CamposDaRevisao {
  moduloId: string;
  inversorId: string;
  performanceRatio: string;
  simultaneidade: string;
  quantidadeDeModulos: string;
  horasDeSol: HorasDeSol | '';
  orientacao: Orientacao | '';
  inclinacao: Inclinacao | '';
  justificativa: string;
}

function camposIniciais({ escolhas }: Proposta): CamposDaRevisao {
  const revisao = escolhas.revisao ?? {};
  return {
    moduloId: String(escolhas.moduloId), inversorId: String(escolhas.inversorId),
    performanceRatio: fracaoParaCampo(revisao.performanceRatio), simultaneidade: fracaoParaCampo(revisao.simultaneidade),
    quantidadeDeModulos: revisao.quantidadeDeModulos === undefined ? '' : String(revisao.quantidadeDeModulos),
    horasDeSol: revisao.telhado?.horasDeSol ?? '', orientacao: revisao.telhado?.orientacao ?? '', inclinacao: revisao.telhado?.inclinacao ?? '', justificativa: '',
  };
}

// Campo vazio significa sem revisão: vale o que o cliente informou ou o valor típico. A API substitui a revisão anterior por inteiro.
function montarRevisao(campos: CamposDaRevisao): RevisaoDePremissas {
  const performanceRatio = lerNumeroOpcional(campos.performanceRatio);
  const simultaneidade = lerNumeroOpcional(campos.simultaneidade);
  const quantidade = lerNumeroOpcional(campos.quantidadeDeModulos);
  const telhado = {
    ...(campos.horasDeSol && { horasDeSol: campos.horasDeSol }),
    ...(campos.orientacao && { orientacao: campos.orientacao }),
    ...(campos.inclinacao && { inclinacao: campos.inclinacao }),
  };
  return {
    ...(performanceRatio !== undefined && { performanceRatio: percentualParaFracao(performanceRatio) }),
    ...(simultaneidade !== undefined && { simultaneidade: percentualParaFracao(simultaneidade) }),
    ...(quantidade !== undefined && { quantidadeDeModulos: quantidade }),
    ...(Object.keys(telhado).length > 0 && { telhado }),
  };
}

// Compara campo a campo, porque a ordem das chaves do JSON gravado pode variar.
function mesmaRevisao(a: RevisaoDePremissas, b: RevisaoDePremissas = {}): boolean {
  const normalizar = ({ performanceRatio, simultaneidade, quantidadeDeModulos, telhado }: RevisaoDePremissas) =>
    JSON.stringify([performanceRatio, simultaneidade, quantidadeDeModulos, telhado?.horasDeSol, telhado?.orientacao, telhado?.inclinacao]);
  return normalizar(a) === normalizar(b);
}

// Envia apenas o que mudou; sem mudança, a edição volta vazia.
function montarEdicao(campos: CamposDaRevisao, { escolhas }: Proposta): EdicaoDoRascunho {
  const revisao = montarRevisao(campos);
  return {
    ...(Number(campos.moduloId) !== escolhas.moduloId && { moduloId: Number(campos.moduloId) }),
    ...(Number(campos.inversorId) !== escolhas.inversorId && { inversorId: Number(campos.inversorId) }),
    ...(!mesmaRevisao(revisao, escolhas.revisao) && { revisao }),
  };
}

// Equipamentos ativos e também o já escolhido, que pode ter sido desativado depois.
function opcoesDoTipo(catalogo: Equipamento[], tipo: Equipamento['tipo'], escolhido: number): Equipamento[] {
  return catalogo.filter((item) => item.tipo === tipo && (item.ativo || item.id === escolhido));
}

function SelecaoDeTelhado<Valor extends string>({ id, rotulo, nomes, valor, aoMudar, erro }: {
  id: string; rotulo: string; nomes: Record<Valor, string>; valor: string; aoMudar: (valor: Valor | '') => void; erro?: string;
}) {
  return (
    <CampoDeSelecao id={id} rotulo={rotulo} value={valor} erro={erro} onChange={(evento) => aoMudar(evento.target.value as Valor | '')}>
      <option value="">Sem revisão</option>
      {comoOpcoes(nomes).map((opcao) => <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>)}
    </CampoDeSelecao>
  );
}

// Trocar equipamento ou premissa recalcula o orçamento e exige o motivo, que fica registrado no histórico.
export function EquipamentosERevisao({ proposta, aoAtualizar }: { proposta: Proposta; aoAtualizar: (proposta: Proposta) => void }) {
  const catalogo = useCarregar(() => listarEquipamentos(), 'catalogo-do-orcamento');
  const [campos, setCampos] = useState(() => camposIniciais(proposta));
  const [semMudanca, setSemMudanca] = useState(false);
  const { executar, ocupado, erro } = useAcao();
  const mudar = (mudanca: Partial<CamposDaRevisao>) => { setCampos((atual) => ({ ...atual, ...mudanca })); setSemMudanca(false); };
  const campoComErro = (nome: string) => erro?.campos[nome];

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const edicao = montarEdicao(campos, proposta);
    if (Object.keys(edicao).length === 0) { setSemMudanca(true); return; }
    const salva = await executar(() => editarProposta(proposta.id, { ...edicao, ...(campos.justificativa.trim() && { justificativa: campos.justificativa.trim() }) }));
    if (salva) { aoAtualizar(salva); setCampos(camposIniciais(salva)); }
  }

  const lista = catalogo.dados ?? [];
  const { premissas, dimensionamento } = proposta;
  return (
    <Cartao>
      <h2 className="font-heading text-lg font-medium text-brand-blue">Equipamentos e revisão de premissas</h2>
      <p className="mt-1 text-sm text-muted-foreground">Depois da análise ou da visita. Campo vazio mantém o valor atual do cálculo.</p>
      <form onSubmit={salvar} noValidate className="mt-5 flex flex-col gap-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <CampoDeSelecao id="revisao-modulo" rotulo="Módulo" value={campos.moduloId} erro={campoComErro('moduloId')} onChange={(evento) => mudar({ moduloId: evento.target.value })}>
            {opcoesDoTipo(lista, 'modulo', proposta.escolhas.moduloId).map((item) => <option key={item.id} value={item.id}>{descreverEquipamento(item)}</option>)}
          </CampoDeSelecao>
          <CampoDeSelecao id="revisao-inversor" rotulo="Inversor" value={campos.inversorId} erro={campoComErro('inversorId')} onChange={(evento) => mudar({ inversorId: evento.target.value })}>
            {opcoesDoTipo(lista, 'inversor', proposta.escolhas.inversorId).map((item) => <option key={item.id} value={item.id}>{descreverEquipamento(item)}</option>)}
          </CampoDeSelecao>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <CampoDeTexto id="revisao-modulos" rotulo="Quantidade de módulos" inputMode="numeric" placeholder={String(dimensionamento.numeroModulos)} value={campos.quantidadeDeModulos}
            erro={campoComErro('revisao.quantidadeDeModulos')} onChange={(evento) => mudar({ quantidadeDeModulos: evento.target.value })} />
          <CampoDeTexto id="revisao-pr" rotulo="Aproveitamento do sistema (%)" inputMode="decimal" placeholder={fracaoParaCampo(premissas.performanceRatio)} value={campos.performanceRatio}
            erro={campoComErro('revisao.performanceRatio')} ajuda="De 70 a 85" onChange={(evento) => mudar({ performanceRatio: evento.target.value })} />
          <CampoDeTexto id="revisao-simultaneidade" rotulo="Consumo na hora da geração (%)" inputMode="decimal" placeholder={fracaoParaCampo(premissas.simultaneidade)} value={campos.simultaneidade}
            erro={campoComErro('revisao.simultaneidade')} ajuda="De 10 a 70" onChange={(evento) => mudar({ simultaneidade: evento.target.value })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <SelecaoDeTelhado id="revisao-horas" rotulo="Sol direto no telhado" nomes={NOMES_DAS_HORAS} valor={campos.horasDeSol} aoMudar={(horasDeSol) => mudar({ horasDeSol })} />
          <SelecaoDeTelhado id="revisao-orientacao" rotulo="Direção do telhado" nomes={NOMES_DA_ORIENTACAO} valor={campos.orientacao} aoMudar={(orientacao) => mudar({ orientacao })} />
          <SelecaoDeTelhado id="revisao-inclinacao" rotulo="Inclinação" nomes={NOMES_DA_INCLINACAO} valor={campos.inclinacao} aoMudar={(inclinacao) => mudar({ inclinacao })} />
        </div>
        <CampoDeAreaDeTexto id="revisao-justificativa" rotulo="Motivo da alteração" value={campos.justificativa} erro={campoComErro('justificativa')}
          ajuda="Obrigatório. Fica no histórico do orçamento." onChange={(evento) => mudar({ justificativa: evento.target.value })} />
        {semMudanca && <p role="status" className="text-sm text-muted-foreground">Nada mudou em relação ao que está salvo.</p>}
        {mensagemGeral(erro) && <Aviso>{mensagemGeral(erro)}</Aviso>}
        <button type="submit" disabled={ocupado || catalogo.carregando} className={classeDoBotaoSecundario + ' self-start'}>{ocupado ? 'Recalculando…' : 'Salvar e recalcular'}</button>
      </form>
    </Cartao>
  );
}
