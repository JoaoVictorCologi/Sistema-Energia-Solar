// Cadastro e edição da usina. A tela só confere o formato do kWp; as validações numéricas e as demais ficam na API.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Aviso, Cartao, classeDoBotaoSecundario, EstadoDaCarga, Titulo } from '../../components/admin/Pecas.tsx';
import { CampoDeTexto, GrupoDeOpcoes } from '../../components/formulario/Campos.tsx';
import { useCarregar } from '../../hooks/useCarregar.ts';
import { useTituloDaPagina } from '../../hooks/useTituloDaPagina.ts';
import type { ErroDaApi } from '../../services/api.ts';
import { formatarNumero } from '../../utils/formatar.ts';
import { alterarUsina, buscarUsina, cadastrarUsina } from './api.ts';
import { EscolhaDeCliente, EscolhaDeMunicipio } from './BuscasDoFormulario.tsx';
import { comoErroDaApi, dadosProntos, focarPrimeiroInvalido, mensagemGeralDoErro, type CampoNaTela } from './PecasDaUsina.tsx';
import type { ClienteDaUsina, CorpoDaUsina, MunicipioDaUsina, UsinaDetalhada } from './tipos.ts';

// "10", "10,5", "1234,567", "1.234,567" ou "1.234.567,89". Ponto sem vírgula é ambíguo ("1.234") e fica de fora.
// O formato é conferido antes de converter em número, para nada ser lido errado; casas a mais seguem para a API recusar.
const FORMATO_BRASILEIRO_DO_KWP = /^(\d+(,\d+)?|\d{1,3}(\.\d{3})+,\d+)$/;
const MENSAGEM_DO_FORMATO_DO_KWP = 'Use o formato brasileiro: 10,5 ou 1.234,567.';
// Acima disto, o número seria arredondado antes de chegar à API.
const MAXIMO_DE_DIGITOS_DO_KWP = 15;

// Na ordem da tela; cliente e município recebem o foco pelo campo de busca de cada um.
const CAMPOS_NA_TELA: CampoNaTela[] = [
  { campo: 'clienteId', seletor: '#busca-cliente' },
  { campo: 'codigoIbge', seletor: '#busca-municipio' },
  { campo: 'kwp', seletor: '#kwp' },
  { campo: 'dataProtocolo', seletor: '#data-protocolo' },
  { campo: 'dataConexao', seletor: '#data-conexao' },
  { campo: 'intervaloLimpezaMeses', seletor: 'input[name="intervalo-limpeza"]' },
];

// Campo vazio passa: segue como null para a API recusar no campo.
function kwpTemFormatoValido(texto: string): boolean {
  const limpo = texto.trim();
  if (limpo === '') return true;
  return FORMATO_BRASILEIRO_DO_KWP.test(limpo) && limpo.replace(/\D/g, '').length <= MAXIMO_DE_DIGITOS_DO_KWP;
}

// Chamada só com o formato já conferido: tira os pontos de milhar e troca a vírgula.
function lerKwp(texto: string): number | null {
  const limpo = texto.trim();
  return limpo === '' ? null : Number(limpo.replace(/\./g, '').replace(',', '.'));
}

// Sem opção marcada, vai null e a API responde no campo.
function lerIntervalo(texto: string): CorpoDaUsina['intervaloLimpezaMeses'] {
  if (texto === '6') return 6;
  return texto === '12' ? 12 : null;
}

// Tela de nova usina; depois de salvar, segue para o detalhe.
export function CadastroDeUsina() {
  useTituloDaPagina('Nova usina — Solar Gestão');
  return (
    <>
      <Link to="/admin/usinas" className="site-link mb-2">← Usinas</Link>
      <Titulo sobre="Usinas">Nova usina</Titulo>
      <FormularioDaUsina caminhoDeVolta="/admin/usinas" />
    </>
  );
}

// O key recria a carga ao trocar de usina.
export function EdicaoDeUsina() {
  const id = Number(useParams().id);
  return <CargaDaEdicao key={id} id={id} />;
}

// Só monta o formulário com os dados carregados, para os campos nascerem preenchidos.
function CargaDaEdicao({ id }: { id: number }) {
  const carga = useCarregar(() => buscarUsina(id), String(id));
  const usina = dadosProntos(carga);
  useTituloDaPagina(`Editar ${usina?.cliente.nome ?? 'usina'} — Solar Gestão`);
  const caminhoDoDetalhe = `/admin/usinas/${id}`;
  return (
    <>
      <Link to={caminhoDoDetalhe} className="site-link mb-2">← Detalhe da usina</Link>
      <EstadoDaCarga carregando={carga.carregando} erro={carga.erro} aoTentarDeNovo={carga.recarregar} />
      {usina && (
        <>
          <Titulo sobre="Editar usina"><span className="[overflow-wrap:anywhere]">{usina.cliente.nome}</span></Titulo>
          <FormularioDaUsina key={usina.id} inicial={usina} caminhoDeVolta={caminhoDoDetalhe} />
        </>
      )}
    </>
  );
}

// No sucesso, abre o detalhe com a confirmação no state da navegação. Só reabilita em erro: no sucesso, a tela é trocada.
function useEnvioDaUsina(idDaUsina?: number) {
  const navegar = useNavigate();
  const [erro, setErro] = useState<ErroDaApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(corpo: CorpoDaUsina) {
    setEnviando(true);
    setErro(null);
    try {
      const usina = idDaUsina === undefined ? await cadastrarUsina(corpo) : await alterarUsina(idDaUsina, corpo);
      navegar(`/admin/usinas/${usina.id}`, { state: { confirmacao: idDaUsina === undefined ? 'Usina cadastrada.' : 'Alterações salvas.' } });
    } catch (falha) {
      setErro(comoErroDaApi(falha));
      setEnviando(false);
    }
  }

  return { erro, enviando, enviar, limparErro: () => setErro(null) };
}

// O regime nunca é campo daqui nem é calculado na tela, e o status não se edita por este formulário.
function FormularioDaUsina({ inicial, caminhoDeVolta }: { inicial?: UsinaDetalhada; caminhoDeVolta: string }) {
  const [cliente, setCliente] = useState<ClienteDaUsina | null>(inicial?.cliente ?? null);
  const [municipio, setMunicipio] = useState<MunicipioDaUsina | null>(inicial?.municipio ?? null);
  const [kwp, setKwp] = useState(inicial ? formatarNumero(inicial.kwp, 3) : '');
  const [kwpInvalido, setKwpInvalido] = useState(false);
  const [dataProtocolo, setDataProtocolo] = useState(inicial?.dataProtocolo ?? '');
  const [dataConexao, setDataConexao] = useState(inicial?.dataConexao ?? '');
  const [intervalo, setIntervalo] = useState(inicial ? String(inicial.intervaloLimpezaMeses) : '');
  const { erro, enviando, enviar, limparErro } = useEnvioDaUsina(inicial?.id);
  const formulario = useRef<HTMLFormElement>(null);
  const blocoDoErro = useRef<HTMLDivElement>(null);
  const campos = erro?.campos ?? {};

  // Depois da renderização: durante o envio os campos estão desabilitados e não recebem foco.
  useEffect(() => {
    if (erro) focarPrimeiroInvalido(erro, CAMPOS_NA_TELA, formulario.current, blocoDoErro.current);
  }, [erro]);

  // kWp em formato inválido nem é enviado, para não ser convertido errado. O corpo vai completo: campo limpo não é omitido.
  function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!kwpTemFormatoValido(kwp)) {
      setKwpInvalido(true);
      limparErro();
      formulario.current?.querySelector<HTMLElement>('#kwp')?.focus();
      return;
    }
    void enviar({ clienteId: cliente?.id ?? null, codigoIbge: municipio?.codigoIbge ?? null, kwp: lerKwp(kwp), dataProtocolo, dataConexao, intervaloLimpezaMeses: lerIntervalo(intervalo) });
  }

  // O fieldset desabilitado impede envio duplicado. Ele não alcança links: por isso, Cancelar se bloqueia sozinho durante o envio.
  return (
    <form ref={formulario} onSubmit={salvar} noValidate className="flex flex-col gap-8">
      {erro && <div ref={blocoDoErro} tabIndex={-1}><Aviso>{mensagemGeralDoErro(erro, CAMPOS_NA_TELA)}</Aviso></div>}
      <fieldset disabled={enviando} className="flex min-w-0 flex-col gap-8">
        <Cartao><EscolhaDeCliente escolhido={cliente} aoEscolher={setCliente} erro={campos.clienteId} /></Cartao>
        <Cartao><EscolhaDeMunicipio escolhido={municipio} aoEscolher={setMunicipio} erro={campos.codigoIbge} /></Cartao>
        <Cartao>
          <fieldset className="flex flex-col gap-5">
            <legend className="font-heading text-lg font-medium text-brand-blue">Dados da usina</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <CampoDeTexto
                id="kwp" rotulo="Potência (kWp)" inputMode="decimal" value={kwp}
                onChange={(evento) => { setKwp(evento.target.value); setKwpInvalido(false); }}
                onBlur={() => setKwpInvalido(!kwpTemFormatoValido(kwp))}
                erro={kwpInvalido ? MENSAGEM_DO_FORMATO_DO_KWP : campos.kwp}
              />
              <div className="hidden sm:block" />
              <CampoDeTexto id="data-protocolo" rotulo="Data do protocolo" type="date" value={dataProtocolo} onChange={(evento) => setDataProtocolo(evento.target.value)} erro={campos.dataProtocolo} />
              <CampoDeTexto id="data-conexao" rotulo="Data de conexão" type="date" value={dataConexao} onChange={(evento) => setDataConexao(evento.target.value)} erro={campos.dataConexao} />
            </div>
            <GrupoDeOpcoes
              nome="intervalo-limpeza" legenda="Intervalo de limpeza" valor={intervalo} aoMudar={setIntervalo} erro={campos.intervaloLimpezaMeses}
              opcoes={[{ valor: '6', rotulo: 'A cada 6 meses' }, { valor: '12', rotulo: 'A cada 12 meses' }]}
            />
          </fieldset>
        </Cartao>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={classeDoBotaoSecundario}>{enviando ? 'Salvando…' : 'Salvar usina'}</button>
          <Link
            to={caminhoDeVolta} aria-disabled={enviando} tabIndex={enviando ? -1 : undefined}
            onClick={(evento) => { if (enviando) evento.preventDefault(); }}
            className="site-link aria-disabled:pointer-events-none aria-disabled:opacity-60"
          >
            Cancelar
          </Link>
        </div>
      </fieldset>
    </form>
  );
}
