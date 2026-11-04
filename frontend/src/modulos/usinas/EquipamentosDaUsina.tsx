// Lista e formulário de equipamentos de uma usina. Cada registro é um equipamento físico, com a própria série.
import { Plus } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Aviso, Cartao, classeDaLinha, classeDoBotaoSecundario, classeDoCabecalho, Tabela } from '../../components/admin/Pecas.tsx';
import { CampoDeTexto, GrupoDeOpcoes } from '../../components/formulario/Campos.tsx';
import type { ErroDaApi, TipoDeEquipamento } from '../../services/api.ts';
import { alterarEquipamentoDaUsina, cadastrarEquipamentoDaUsina } from './api.ts';
import { comoErroDaApi, Confirmacao, focarPrimeiroInvalido, formatarDataOuTraco, mensagemGeralDoErro, type CampoNaTela } from './PecasDaUsina.tsx';
import type { CorpoDoEquipamento, EquipamentoDaUsina } from './tipos.ts';

const NOMES_DO_TIPO: Record<TipoDeEquipamento, string> = { modulo: 'Módulo', inversor: 'Inversor' };

// Campos como a tela os guarda: tudo em texto, inclusive os números, até o envio.
interface CamposDoEquipamento {
  tipo: TipoDeEquipamento;
  marca: string;
  modelo: string;
  numeroSerie: string;
  dataInstalacao: string;
  garantiaProdutoMeses: string;
  garantiaDesempenhoAnos: string;
}

// outroIgual grava como cadastro novo, reaproveitando os dados comuns.
type ModoDoFormulario = 'novo' | 'editar' | 'outroIgual';

// abertura muda a cada exibição: usada como key, ela recria o formulário com os campos novos.
interface FormularioAberto {
  modo: ModoDoFormulario;
  campos: CamposDoEquipamento;
  idDoEquipamento: number | null;
  abertura: number;
}

const CAMPOS_VAZIOS: CamposDoEquipamento = {
  tipo: 'modulo', marca: '', modelo: '', numeroSerie: '', dataInstalacao: '', garantiaProdutoMeses: '', garantiaDesempenhoAnos: '',
};

// Na ordem da tela: o foco vai para o primeiro campo recusado pela API.
const CAMPOS_NA_TELA: CampoNaTela[] = [
  { campo: 'tipo', seletor: 'input[name="tipo-equipamento"]' },
  { campo: 'marca', seletor: '#equipamento-marca' },
  { campo: 'modelo', seletor: '#equipamento-modelo' },
  { campo: 'numeroSerie', seletor: '#equipamento-serie' },
  { campo: 'dataInstalacao', seletor: '#equipamento-instalacao' },
  { campo: 'garantiaProdutoMeses', seletor: '#equipamento-garantia-produto' },
  { campo: 'garantiaDesempenhoAnos', seletor: '#equipamento-garantia-desempenho' },
];

// Do equipamento salvo para os campos da tela; sem garantia de desempenho, o campo fica vazio.
function camposDoEquipamento(equipamento: EquipamentoDaUsina): CamposDoEquipamento {
  return {
    tipo: equipamento.tipo, marca: equipamento.marca, modelo: equipamento.modelo, numeroSerie: equipamento.numeroSerie,
    dataInstalacao: equipamento.dataInstalacao, garantiaProdutoMeses: String(equipamento.garantiaProdutoMeses),
    garantiaDesempenhoAnos: equipamento.garantiaDesempenhoAnos === null ? '' : String(equipamento.garantiaDesempenhoAnos),
  };
}

// Cada registro é um equipamento físico: mantém os dados comuns e só a série fica para preencher.
function dadosParaOutroIgual(campos: CamposDoEquipamento): CamposDoEquipamento {
  return { ...campos, numeroSerie: '' };
}

// Só dígitos viram número ("1e3" viraria 1000 com Number direto); o resto vai como null, para a API recusar no campo.
function lerInteiro(texto: string): number | null {
  const limpo = texto.trim();
  return /^\d+$/.test(limpo) ? Number(limpo) : null;
}

// A API recusa garantia de desempenho em inversor e null no POST; no PATCH, null é o que limpa o valor antigo.
function montarCorpo(campos: CamposDoEquipamento, cadastrando: boolean): CorpoDoEquipamento {
  const { tipo, marca, modelo, numeroSerie, dataInstalacao, garantiaProdutoMeses, garantiaDesempenhoAnos } = campos;
  const comuns = { tipo, marca, modelo, numeroSerie, dataInstalacao, garantiaProdutoMeses: lerInteiro(garantiaProdutoMeses) };
  if (tipo === 'inversor') return cadastrando ? comuns : { ...comuns, garantiaDesempenhoAnos: null };
  if (cadastrando && garantiaDesempenhoAnos.trim() === '') return comuns;
  return { ...comuns, garantiaDesempenhoAnos: lerInteiro(garantiaDesempenhoAnos) };
}

const TITULOS_DO_FORMULARIO: Record<ModoDoFormulario, string> = {
  novo: 'Cadastrar equipamento', editar: 'Editar equipamento', outroIgual: 'Cadastrar outro igual',
};

// Controla qual formulário está aberto e, ao fechar, devolve o foco a quem o abriu.
// Durante o envio, as demais ações ficam bloqueadas, para o formulário em envio não ser trocado.
export function EquipamentosDaUsina({ idDaUsina, equipamentos, aoGravar }: { idDaUsina: number; equipamentos: EquipamentoDaUsina[]; aoGravar: (equipamento: EquipamentoDaUsina) => void }) {
  const [formulario, setFormulario] = useState<FormularioAberto | null>(null);
  const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [pedidosDeFoco, setPedidosDeFoco] = useState(0);
  const aberturas = useRef(0);
  const origem = useRef<HTMLElement | null>(null);
  const titulo = useRef<HTMLHeadingElement>(null);

  // Depois da renderização: durante o envio a origem está desabilitada e não recebe foco.
  useEffect(() => {
    if (pedidosDeFoco === 0) return;
    const destino = origem.current;
    if (destino && destino !== document.body && destino.isConnected) destino.focus();
    else titulo.current?.focus();
  }, [pedidosDeFoco]);

  // Cada exibição ganha um número novo, mesmo que o modo se repita.
  function mostrar(modo: ModoDoFormulario, campos: CamposDoEquipamento, idDoEquipamento: number | null) {
    aberturas.current += 1;
    setFormulario({ modo, campos, idDoEquipamento, abertura: aberturas.current });
  }

  // Guarda quem abriu o formulário, para devolver o foco ao fechar.
  function abrir(modo: ModoDoFormulario, campos: CamposDoEquipamento, idDoEquipamento: number | null = null) {
    origem.current = document.activeElement as HTMLElement | null;
    setConfirmacao(null);
    mostrar(modo, campos, idDoEquipamento);
  }

  // O foco volta pelo efeito acima, depois que a tela atualizar.
  function fechar() {
    setFormulario(null);
    setPedidosDeFoco((pedidos) => pedidos + 1);
  }

  // Atualiza a tabela primeiro; depois fecha ou reabre o formulário para o próximo equipamento igual.
  function aoSalvar(salvo: EquipamentoDaUsina, campos: CamposDoEquipamento, cadastrarOutro: boolean) {
    aoGravar(salvo);
    if (cadastrarOutro) {
      // Sem chamar abrir: o elemento ativo agora é um botão que vai sumir, e a origem precisa continuar a inicial.
      setConfirmacao(`Equipamento ${salvo.numeroSerie} salvo. Informe a série do próximo.`);
      mostrar('outroIgual', dadosParaOutroIgual(campos), null);
      return;
    }
    setConfirmacao(`Equipamento ${salvo.numeroSerie} salvo.`);
    fechar();
  }

  return (
    <section aria-labelledby="titulo-equipamentos">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 ref={titulo} id="titulo-equipamentos" tabIndex={-1} className="font-heading text-xl font-medium text-brand-blue">Equipamentos</h2>
        <button type="button" disabled={enviando} onClick={() => abrir('novo', CAMPOS_VAZIOS)} className={classeDoBotaoSecundario}>
          <Plus aria-hidden="true" className="size-4" /> Cadastrar equipamento
        </button>
      </div>
      {equipamentos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum equipamento cadastrado nesta usina.</p> : (
        <TabelaDeEquipamentos
          equipamentos={equipamentos} acoesBloqueadas={enviando}
          aoEditar={(equipamento) => abrir('editar', camposDoEquipamento(equipamento), equipamento.id)}
          aoCadastrarOutroIgual={(equipamento) => abrir('outroIgual', dadosParaOutroIgual(camposDoEquipamento(equipamento)))}
        />
      )}
      <Confirmacao texto={confirmacao} className="mt-4" />
      {formulario && (
        <FormularioDoEquipamento key={formulario.abertura} idDaUsina={idDaUsina} aberto={formulario} aoSalvar={aoSalvar} aoFechar={fechar} aoMudarEnvio={setEnviando} />
      )}
    </section>
  );
}

// Os vencimentos vêm calculados da API. O aria-label com a série distingue as ações de cada linha.
function TabelaDeEquipamentos({ equipamentos, acoesBloqueadas, aoEditar, aoCadastrarOutroIgual }: {
  equipamentos: EquipamentoDaUsina[]; acoesBloqueadas: boolean; aoEditar: (equipamento: EquipamentoDaUsina) => void; aoCadastrarOutroIgual: (equipamento: EquipamentoDaUsina) => void;
}) {
  const classeDaAcao = 'inline-flex min-h-11 min-w-11 items-center justify-center font-semibold text-brand-blue underline underline-offset-4 disabled:opacity-60';
  return (
    <Tabela legenda="Equipamentos da usina">
      <thead className={classeDoCabecalho}>
        <tr>
          <th scope="col">Tipo</th><th scope="col">Marca e modelo</th><th scope="col">Número de série</th><th scope="col">Instalação</th>
          <th scope="col">Garantia do produto vence</th><th scope="col">Garantia de desempenho vence</th><th scope="col">Ações</th>
        </tr>
      </thead>
      <tbody>
        {equipamentos.map((equipamento) => (
          <tr key={equipamento.id} className={classeDaLinha}>
            <td>{NOMES_DO_TIPO[equipamento.tipo]}</td>
            <td className="whitespace-nowrap">{equipamento.marca} {equipamento.modelo}</td>
            <td className="whitespace-nowrap">{equipamento.numeroSerie}</td>
            <td className="whitespace-nowrap">{formatarDataOuTraco(equipamento.dataInstalacao)}</td>
            <td className="whitespace-nowrap">{formatarDataOuTraco(equipamento.vencimentoGarantiaProduto)}</td>
            <td className="whitespace-nowrap">{formatarDataOuTraco(equipamento.vencimentoGarantiaDesempenho)}</td>
            <td>
              <div className="flex gap-4 whitespace-nowrap">
                <button type="button" disabled={acoesBloqueadas} aria-label={`Editar ${equipamento.numeroSerie}`} onClick={() => aoEditar(equipamento)} className={classeDaAcao}>Editar</button>
                <button type="button" disabled={acoesBloqueadas} aria-label={`Cadastrar outro igual a ${equipamento.numeroSerie}`} onClick={() => aoCadastrarOutroIgual(equipamento)} className={classeDaAcao}>Cadastrar outro igual</button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </Tabela>
  );
}

// Usa a rota de cadastro ou de alteração, conforme exista id. Em erro, o formulário fica aberto com o que foi digitado.
function useEnvioDoEquipamento({ idDaUsina, aberto, aoSalvar, aoMudarEnvio }: Pick<PropriedadesDoFormulario, 'idDaUsina' | 'aberto' | 'aoSalvar' | 'aoMudarEnvio'>) {
  const [erro, setErro] = useState<ErroDaApi | null>(null);
  const [acaoEmEnvio, setAcaoEmEnvio] = useState<'salvar' | 'salvarEOutro' | null>(null);

  async function salvar(campos: CamposDoEquipamento, cadastrarOutro: boolean) {
    setAcaoEmEnvio(cadastrarOutro ? 'salvarEOutro' : 'salvar');
    aoMudarEnvio(true);
    setErro(null);
    const { idDoEquipamento } = aberto;
    try {
      const salvo = idDoEquipamento === null
        ? await cadastrarEquipamentoDaUsina(idDaUsina, montarCorpo(campos, true))
        : await alterarEquipamentoDaUsina(idDaUsina, idDoEquipamento, montarCorpo(campos, false));
      aoSalvar(salvo, campos, cadastrarOutro);
    } catch (falha) {
      setErro(comoErroDaApi(falha));
    } finally {
      setAcaoEmEnvio(null);
      aoMudarEnvio(false);
    }
  }

  return { erro, acaoEmEnvio, salvar };
}

interface PropriedadesDoFormulario {
  idDaUsina: number;
  aberto: FormularioAberto;
  aoSalvar: (salvo: EquipamentoDaUsina, campos: CamposDoEquipamento, cadastrarOutro: boolean) => void;
  aoFechar: () => void;
  aoMudarEnvio: (enviando: boolean) => void;
}

// noValidate: quem valida é a API, e os erros aparecem nos campos. O fieldset desabilitado no envio impede pedido duplicado.
function FormularioDoEquipamento({ idDaUsina, aberto, aoSalvar, aoFechar, aoMudarEnvio }: PropriedadesDoFormulario) {
  const { modo } = aberto;
  const [campos, setCampos] = useState(aberto.campos);
  const { erro, acaoEmEnvio, salvar } = useEnvioDoEquipamento({ idDaUsina, aberto, aoSalvar, aoMudarEnvio });
  const titulo = useRef<HTMLHeadingElement>(null);
  const formulario = useRef<HTMLFormElement>(null);
  const blocoDoErro = useRef<HTMLDivElement>(null);
  // Em inversor, um erro na garantia de desempenho não tem campo na tela e vai para a mensagem geral.
  const camposVisiveis = campos.tipo === 'modulo' ? CAMPOS_NA_TELA : CAMPOS_NA_TELA.filter(({ campo }) => campo !== 'garantiaDesempenhoAnos');
  const alterar = (campo: keyof CamposDoEquipamento, valor: string) => setCampos((atuais) => ({ ...atuais, [campo]: valor }));

  // Em "outro igual" o foco vai para a série, a única coisa a preencher; nos outros modos, para o início do formulário.
  useEffect(() => {
    if (modo !== 'outroIgual') titulo.current?.focus();
  }, [modo]);

  // Depois da renderização: durante o envio os campos estão desabilitados e não recebem foco.
  useEffect(() => {
    if (erro) focarPrimeiroInvalido(erro, camposVisiveis, formulario.current, blocoDoErro.current);
  }, [erro]);

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    void salvar(campos, false);
  }

  return (
    <Cartao className="mt-6">
      <h3 ref={titulo} tabIndex={-1} className="mb-5 font-heading text-lg font-medium text-brand-blue">{TITULOS_DO_FORMULARIO[modo]}</h3>
      <form ref={formulario} onSubmit={enviar} noValidate className="flex flex-col gap-5">
        {erro && <div ref={blocoDoErro} tabIndex={-1}><Aviso>{mensagemGeralDoErro(erro, camposVisiveis)}</Aviso></div>}
        <fieldset disabled={acaoEmEnvio !== null} className="flex min-w-0 flex-col gap-5">
          <CamposDoFormulario campos={campos} erros={erro?.campos ?? {}} alterar={alterar} focarSerie={modo === 'outroIgual'} />
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className={classeDoBotaoSecundario}>{acaoEmEnvio === 'salvar' ? 'Salvando…' : modo === 'editar' ? 'Salvar' : 'Salvar equipamento'}</button>
            {modo !== 'editar' && (
              <button type="button" onClick={() => void salvar(campos, true)} className={classeDoBotaoSecundario}>{acaoEmEnvio === 'salvarEOutro' ? 'Salvando…' : 'Salvar e cadastrar outro igual'}</button>
            )}
            <button type="button" onClick={aoFechar} className="site-link disabled:opacity-60">Cancelar</button>
          </div>
        </fieldset>
      </form>
    </Cartao>
  );
}

// A garantia de desempenho só aparece para módulo; trocar para inversor a esconde, e montarCorpo não envia o valor digitado.
function CamposDoFormulario({ campos, erros, alterar, focarSerie }: { campos: CamposDoEquipamento; erros: Record<string, string>; alterar: (campo: keyof CamposDoEquipamento, valor: string) => void; focarSerie: boolean }) {
  return (
    <>
      <GrupoDeOpcoes<TipoDeEquipamento>
        nome="tipo-equipamento" legenda="Tipo" valor={campos.tipo} aoMudar={(tipo) => alterar('tipo', tipo)} erro={erros.tipo}
        opcoes={[{ valor: 'modulo', rotulo: 'Módulo' }, { valor: 'inversor', rotulo: 'Inversor' }]}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoDeTexto id="equipamento-marca" rotulo="Marca" value={campos.marca} onChange={(evento) => alterar('marca', evento.target.value)} erro={erros.marca} />
        <CampoDeTexto id="equipamento-modelo" rotulo="Modelo" value={campos.modelo} onChange={(evento) => alterar('modelo', evento.target.value)} erro={erros.modelo} />
        <CampoDeTexto
          id="equipamento-serie" rotulo="Número de série" autoFocus={focarSerie} value={campos.numeroSerie}
          onChange={(evento) => alterar('numeroSerie', evento.target.value)} erro={erros.numeroSerie}
        />
        <CampoDeTexto id="equipamento-instalacao" rotulo="Data de instalação" type="date" value={campos.dataInstalacao} onChange={(evento) => alterar('dataInstalacao', evento.target.value)} erro={erros.dataInstalacao} />
        <CampoDeTexto id="equipamento-garantia-produto" rotulo="Garantia do produto (meses)" inputMode="numeric" value={campos.garantiaProdutoMeses} onChange={(evento) => alterar('garantiaProdutoMeses', evento.target.value)} erro={erros.garantiaProdutoMeses} />
        {campos.tipo === 'modulo' && (
          <CampoDeTexto id="equipamento-garantia-desempenho" rotulo="Garantia de desempenho (anos)" inputMode="numeric" value={campos.garantiaDesempenhoAnos} onChange={(evento) => alterar('garantiaDesempenhoAnos', evento.target.value)} erro={erros.garantiaDesempenhoAnos} />
        )}
      </div>
    </>
  );
}
