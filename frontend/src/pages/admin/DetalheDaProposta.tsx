import { CopyPlus, FilePlus2, Printer, Send, Trash2 } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Ajustes } from '../../components/admin/orcamento/Ajustes.tsx';
import { Condicoes } from '../../components/admin/orcamento/Condicoes.tsx';
import { DocumentoDoOrcamento } from '../../components/admin/orcamento/DocumentoDoOrcamento.tsx';
import { EquipamentosERevisao } from '../../components/admin/orcamento/EquipamentosERevisao.tsx';
import { HistoricoEVersoes } from '../../components/admin/orcamento/HistoricoEVersoes.tsx';
import { Aviso, BotaoComConfirmacao, Cartao, classeDoBotaoPerigoso, classeDoBotaoSecundario, EstadoDaCarga, ROTULOS_DO_STATUS, SeloDeStatus, Titulo } from '../../components/admin/Pecas.tsx';
import { CampoDeAreaDeTexto } from '../../components/formulario/Campos.tsx';
import { useCarregar } from '../../hooks/useCarregar.ts';
import { mensagemGeral, useAcao } from '../../hooks/useAcao.ts';
import { useTituloDaPagina } from '../../hooks/useTituloDaPagina.ts';
import { buscarProposta, criarNovaVersao, duplicarProposta, editarProposta, enviarProposta, excluirProposta, mudarStatusDaProposta, type Proposta, type StatusDaProposta } from '../../services/api.ts';
import { formatarData, formatarReais } from '../../utils/formatar.ts';

const BotaoDeImprimir = ({ rotulo }: { rotulo: string }) => (
  <button type="button" onClick={() => window.print()} className={classeDoBotaoSecundario}><Printer aria-hidden="true" className="size-4" /> {rotulo}</button>
);

// Rascunho abre para edição; do envio em diante, apenas leitura do snapshot, sem recálculo.
export function DetalheDaProposta() {
  const id = Number(useParams().id);
  const carga = useCarregar(() => buscarProposta(id), String(id));
  const [atualizada, setAtualizada] = useState<Proposta | null>(null);
  // Ao abrir outra versão, os dados em memória são de outro id até a resposta chegar e, por isso, não são exibidos.
  const proposta = atualizada?.id === id ? atualizada : carga.dados?.id === id ? carga.dados : null;
  useTituloDaPagina(`Orçamento nº ${id} — Solar Gestão`);

  return (
    <>
      <div className="print:hidden"><Link to="/admin/propostas" className="site-link mb-2">← Orçamentos</Link></div>
      <EstadoDaCarga carregando={!proposta && carga.carregando} erro={carga.erro} aoTentarDeNovo={carga.recarregar} />
      {proposta && <Orcamento key={proposta.id} proposta={proposta} aoAtualizar={setAtualizada} />}
    </>
  );
}

function Orcamento({ proposta, aoAtualizar }: { proposta: Proposta; aoAtualizar: (proposta: Proposta) => void }) {
  const rascunho = proposta.status === 'rascunho';
  return (
    <div className="flex flex-col gap-8">
      <div className="print:hidden">
        <Titulo sobre={`Orçamento nº ${proposta.id} · versão ${proposta.versao}`} acoes={<Link to={`/admin/clientes/${proposta.clienteId}`} className="site-link">Ver o cliente</Link>}>
          {proposta.cliente.nome}
        </Titulo>
      </div>
      {rascunho ? <Editor proposta={proposta} aoAtualizar={aoAtualizar} /> : <AcoesDoEnviado proposta={proposta} aoAtualizar={aoAtualizar} />}
      {rascunho ? <h2 className="-mb-4 font-heading text-xl font-medium text-brand-blue print:hidden">Prévia do que o cliente recebe</h2> : null}
      <DocumentoDoOrcamento proposta={proposta} />
      <HistoricoEVersoes proposta={proposta} />
    </div>
  );
}

// Resumo de preço e ações, comum ao rascunho e ao orçamento enviado.
function ResumoDoPreco({ proposta, children }: { proposta: Proposta; children: ReactNode }) {
  const { precos } = proposta;
  return (
    <Cartao className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <SeloDeStatus status={proposta.status} />
        <div className="flex flex-wrap gap-2">{children}</div>
      </div>
      <dl className="grid gap-4 text-sm sm:grid-cols-3">
        <div><dt className="text-muted-foreground">Preço calculado</dt><dd className="mt-1 font-medium tabular-nums">{formatarReais(precos.calculado ?? precos.investimento)}</dd></div>
        <div><dt className="text-muted-foreground">Ajustes</dt><dd className="mt-1 font-medium tabular-nums">{formatarReais(precos.ajustes ?? 0)}</dd></div>
        <div><dt className="text-muted-foreground">Valor final</dt><dd className="mt-1 font-heading text-2xl font-medium text-brand-blue">{formatarReais(proposta.investimento)}</dd></div>
      </dl>
      <p className="text-sm text-muted-foreground">Válido até {formatarData(proposta.validaAte)}.</p>
      <ComposicaoDoPreco proposta={proposta} />
    </Cartao>
  );
}

// Uso interno: a margem não vai para o documento entregue ao cliente.
function ComposicaoDoPreco({ proposta }: { proposta: Proposta }) {
  const { precos, configuracaoUsada } = proposta;
  const itens = [['Módulos', precos.modulos], ['Inversor', precos.inversor], ['Instalação', precos.instalacao], ['Margem', precos.margem]] as const;
  return (
    <details>
      <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-brand-blue">Composição do preço (uso interno)</summary>
      <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
        {itens.map(([rotulo, valor]) => <div key={rotulo}><dt className="text-muted-foreground">{rotulo}</dt><dd className="font-medium tabular-nums">{formatarReais(valor)}</dd></div>)}
      </dl>
      {configuracaoUsada && <p className="mt-2 text-xs text-muted-foreground">Calculado com a configuração comercial do dia: instalação de {formatarReais(configuracaoUsada.instalacaoPorKwp)} por kWp.</p>}
    </details>
  );
}

function Editor({ proposta, aoAtualizar }: { proposta: Proposta; aoAtualizar: (proposta: Proposta) => void }) {
  return (
    <div className="flex flex-col gap-6 print:hidden">
      <AcoesDoRascunho proposta={proposta} aoAtualizar={aoAtualizar} />
      <EquipamentosERevisao proposta={proposta} aoAtualizar={aoAtualizar} />
      <Ajustes proposta={proposta} aoAtualizar={aoAtualizar} />
      <Condicoes proposta={proposta} aoAtualizar={aoAtualizar} />
      <Observacoes proposta={proposta} aoAtualizar={aoAtualizar} />
    </div>
  );
}

// O envio é irreversível e a exclusão apaga o rascunho: as duas ações pedem confirmação.
function AcoesDoRascunho({ proposta, aoAtualizar }: { proposta: Proposta; aoAtualizar: (proposta: Proposta) => void }) {
  const navegar = useNavigate();
  const { executar, ocupado, erro } = useAcao();
  const semCondicao = (proposta.condicoes ?? []).length === 0;

  async function enviar() {
    const enviada = await executar(() => enviarProposta(proposta.id));
    if (enviada) aoAtualizar(enviada);
  }

  async function excluir() {
    const pronto = await executar(async () => { await excluirProposta(proposta.id); return true; });
    if (pronto) navegar('/admin/propostas?status=rascunho');
  }

  return (
    <ResumoDoPreco proposta={proposta}>
      <BotaoDeImprimir rotulo="Imprimir prévia" />
      <BotaoComConfirmacao rotulo={<><Trash2 aria-hidden="true" className="size-4" /> Excluir rascunho</>} pergunta="Excluir este rascunho?" ocupado={ocupado} aoConfirmar={excluir} classe={classeDoBotaoPerigoso} />
      <BotaoComConfirmacao rotulo={<><Send aria-hidden="true" className="size-4" /> Enviar orçamento</>} pergunta="Depois de enviado, o orçamento não muda. Enviar?" ocupado={ocupado || semCondicao} aoConfirmar={enviar} classe="site-button min-h-11 disabled:opacity-60" />
      {semCondicao && <p className="w-full text-right text-sm text-muted-foreground">Para enviar, inclua uma condição de pagamento.</p>}
      {mensagemGeral(erro) && <div className="w-full"><Aviso>{mensagemGeral(erro)}</Aviso></div>}
    </ResumoDoPreco>
  );
}

// Visíveis apenas para a equipe: não entram no documento impresso.
function Observacoes({ proposta, aoAtualizar }: { proposta: Proposta; aoAtualizar: (proposta: Proposta) => void }) {
  const [texto, setTexto] = useState(proposta.observacoes ?? '');
  const [salvo, setSalvo] = useState(false);
  const { executar, ocupado, erro } = useAcao();
  useEffect(() => setSalvo(false), [texto]);

  async function salvar() {
    const salva = await executar(() => editarProposta(proposta.id, { observacoes: texto.trim() || null }));
    if (salva) { aoAtualizar(salva); setSalvo(true); }
  }

  return (
    <Cartao className="flex flex-col gap-3">
      <CampoDeAreaDeTexto id="orcamento-observacoes" rotulo="Observações internas" value={texto} erro={erro?.campos.observacoes} ajuda="Só a equipe vê. Não vão na impressão." onChange={(evento) => setTexto(evento.target.value)} />
      {mensagemGeral(erro) && <Aviso>{mensagemGeral(erro)}</Aviso>}
      <div className="flex items-center gap-3">
        <button type="button" onClick={salvar} disabled={ocupado} className={classeDoBotaoSecundario}>{ocupado ? 'Salvando…' : 'Salvar observações'}</button>
        {salvo && <span role="status" className="text-sm text-muted-foreground">Salvas.</span>}
      </div>
    </Cartao>
  );
}

function AcoesDoEnviado({ proposta, aoAtualizar }: { proposta: Proposta; aoAtualizar: (proposta: Proposta) => void }) {
  const navegar = useNavigate();
  const { executar, ocupado, erro } = useAcao();
  // Orçamento vencido não pode ser aceito: o caminho é criar uma nova versão.
  const status = (['enviada', 'aceita', 'recusada'] as const).filter((item) => item !== proposta.status && !(item === 'aceita' && proposta.vencida));

  async function mudar(novo: Exclude<StatusDaProposta, 'rascunho'>) {
    const salva = await executar(() => mudarStatusDaProposta(proposta.id, novo));
    if (salva) aoAtualizar(salva);
  }

  async function copiar(criar: (id: number) => Promise<Proposta>) {
    const nova = await executar(() => criar(proposta.id));
    if (nova) navegar(`/admin/propostas/${nova.id}`);
  }

  return (
    <div className="print:hidden">
      <ResumoDoPreco proposta={proposta}>
        {status.map((item) => <button key={item} type="button" onClick={() => mudar(item)} disabled={ocupado} className={classeDoBotaoSecundario}>Marcar como {ROTULOS_DO_STATUS[item].toLowerCase()}</button>)}
        <button type="button" onClick={() => copiar(criarNovaVersao)} disabled={ocupado} className={classeDoBotaoSecundario}><FilePlus2 aria-hidden="true" className="size-4" /> Nova versão</button>
        <button type="button" onClick={() => copiar(duplicarProposta)} disabled={ocupado} className={classeDoBotaoSecundario}><CopyPlus aria-hidden="true" className="size-4" /> Duplicar</button>
        <button type="button" onClick={() => window.print()} className="site-button min-h-11"><Printer aria-hidden="true" className="size-4" /> Imprimir ou salvar PDF</button>
        {proposta.vencida && <p className="w-full text-right text-sm font-semibold text-muted-foreground">Validade vencida: para o cliente aceitar, crie uma nova versão.</p>}
        {mensagemGeral(erro) && <div className="w-full"><Aviso>{mensagemGeral(erro)}</Aviso></div>}
      </ResumoDoPreco>
    </div>
  );
}
